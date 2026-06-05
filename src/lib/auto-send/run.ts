import { prisma } from "@/server/db/client";
import { sendDraft } from "@/lib/gmail/send";
import {
  autoSendEnabled,
  autoSendFirstDailyCap,
  autoSendFollowUpDailyCap,
  autoSendMaxPerRun,
  nextAutoSendDelayMinutes,
} from "./config";
import { followUpsEnabled } from "@/lib/pipeline/process-follow-ups";

const CONVERSION_BLOCK_STATUSES = ["MATCHED_DOMAIN", "MATCHED_EMAIL", "POSSIBLE", "CONFIRMED"] as const;

type LaneKey = "first" | "followUp";

type LaneConfig = {
  key: LaneKey;
  stateId: string;
  dailyCap: number;
  enabled: boolean;
};

export type LaneSendResult = {
  sent: boolean;
  reason?: string;
  sentCount: number;
  draftIds: string[];
  failedDraftIds: string[];
  nextAllowedAt?: string;
  sentToday: number;
  dailyCap: number;
  pendingDrafts: number;
};

export type AutoSendResult =
  | { sent: true; sentCount: number; draftIds: string[]; lanes: Record<LaneKey, LaneSendResult> }
  | { sent: false; reason: string; lanes?: Record<LaneKey, LaneSendResult> };

export type LaneStatus = {
  enabled: boolean;
  pending: number;
  sentToday: number;
  dailyCap: number;
  due: boolean;
  nextAllowedAt: string | null;
  lastSentAt: string | null;
};

export type AutoSendStatus = {
  enabled: boolean;
  now: string;
  pendingDrafts: number;
  followUpsEnabled: boolean;
  maxPerRun: number;
  lanes: Record<LaneKey, LaneStatus>;
  lastSent: { id: string; sentAt: Date | null; contact: { email: string } } | null;
};

type BlockedRecipients = {
  contactIds: string[];
  draftIds: string[];
};

export async function getAutoSendStatus(now = new Date()): Promise<AutoSendStatus> {
  const blocked = await getBlockedRecipients();
  const firstConfig = {
    key: "first" as const,
    stateId: "first-email",
    dailyCap: autoSendFirstDailyCap(),
    enabled: true,
  };
  const followUpConfig = {
    key: "followUp" as const,
    stateId: "follow-up",
    dailyCap: autoSendFollowUpDailyCap(),
    enabled: followUpsEnabled(),
  };
  const [first, followUp, lastSent] = await Promise.all([
    getLaneStatus(firstConfig, blocked, now),
    getLaneStatus(followUpConfig, blocked, now),
    prisma.outreachDraft.findFirst({
      where: { status: "SENT" },
      orderBy: { sentAt: "desc" },
      select: { id: true, sentAt: true, contact: { select: { email: true } } },
    }),
  ]);

  return {
    enabled: autoSendEnabled(),
    now: now.toISOString(),
    pendingDrafts: first.pending + followUp.pending,
    followUpsEnabled: followUpsEnabled(),
    maxPerRun: autoSendMaxPerRun(),
    lanes: { first, followUp },
    lastSent,
  };
}

export async function runAutoSend(now = new Date()): Promise<AutoSendResult> {
  if (!autoSendEnabled()) return { sent: false, reason: "disabled" };

  const blocked = await getBlockedRecipients();
  const lanes = {
    first: await runLane(
      {
        key: "first",
        stateId: "first-email",
        dailyCap: autoSendFirstDailyCap(),
        enabled: true,
      },
      blocked,
      now,
    ),
    followUp: await runLane(
      {
        key: "followUp",
        stateId: "follow-up",
        dailyCap: autoSendFollowUpDailyCap(),
        enabled: followUpsEnabled(),
      },
      blocked,
      now,
    ),
  };

  const draftIds = [...lanes.first.draftIds, ...lanes.followUp.draftIds];
  const sentCount = draftIds.length;
  if (!sentCount) {
    return { sent: false, reason: lanes.first.reason === lanes.followUp.reason ? lanes.first.reason ?? "idle" : "idle", lanes };
  }

  return { sent: true, sentCount, draftIds, lanes };
}

async function getLaneStatus(config: LaneConfig, blocked: BlockedRecipients, now: Date): Promise<LaneStatus> {
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const [state, pending, sentToday] = await Promise.all([
    prisma.autoSendState.findUnique({ where: { id: config.stateId } }),
    config.enabled ? prisma.outreachDraft.count({ where: laneDraftWhere(config.key, blocked) }) : Promise.resolve(0),
    prisma.outreachDraft.count({
      where: {
        status: "SENT",
        sentAt: { gte: todayStart },
        ...(config.key === "first" ? { parentDraftId: null } : { parentDraftId: { not: null } }),
      },
    }),
  ]);

  return {
    enabled: config.enabled,
    pending,
    sentToday,
    dailyCap: config.dailyCap,
    due: config.enabled && (!state?.nextAllowedAt || state.nextAllowedAt <= now),
    nextAllowedAt: state?.nextAllowedAt?.toISOString() ?? null,
    lastSentAt: state?.lastSentAt?.toISOString() ?? null,
  };
}

async function runLane(config: LaneConfig, blocked: BlockedRecipients, now: Date): Promise<LaneSendResult> {
  if (!config.enabled) {
    return {
      sent: false,
      reason: "disabled",
      sentCount: 0,
      draftIds: [],
      failedDraftIds: [],
      sentToday: 0,
      dailyCap: config.dailyCap,
      pendingDrafts: 0,
    };
  }

  const state = await prisma.autoSendState.upsert({
    where: { id: config.stateId },
    update: {},
    create: { id: config.stateId },
  });

  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const laneWhere = laneDraftWhere(config.key, blocked);
  const [sentToday, pendingDrafts] = await Promise.all([
    prisma.outreachDraft.count({
      where: {
        status: "SENT",
        sentAt: { gte: todayStart },
        ...(config.key === "first" ? { parentDraftId: null } : { parentDraftId: { not: null } }),
      },
    }),
    prisma.outreachDraft.count({ where: laneWhere }),
  ]);

  if (sentToday >= config.dailyCap) {
    return {
      sent: false,
      reason: "daily_cap_reached",
      sentCount: 0,
      draftIds: [],
      failedDraftIds: [],
      sentToday,
      dailyCap: config.dailyCap,
      pendingDrafts,
    };
  }

  if (!pendingDrafts) {
    return {
      sent: false,
      reason: "no_pending_drafts",
      sentCount: 0,
      draftIds: [],
      failedDraftIds: [],
      sentToday,
      dailyCap: config.dailyCap,
      pendingDrafts,
    };
  }

  if (state.nextAllowedAt && state.nextAllowedAt > now) {
    return {
      sent: false,
      reason: "waiting",
      sentCount: 0,
      draftIds: [],
      failedDraftIds: [],
      nextAllowedAt: state.nextAllowedAt.toISOString(),
      sentToday,
      dailyCap: config.dailyCap,
      pendingDrafts,
    };
  }

  const draftIds: string[] = [];
  const failedDraftIds: string[] = [];
  const maxPerRun = Math.min(autoSendMaxPerRun(), config.dailyCap - sentToday);
  let sentCount = sentToday;
  let scheduleCursor = state.nextAllowedAt ?? now;
  let attempts = 0;
  const maxAttempts = maxPerRun + 10;

  while (draftIds.length < maxPerRun && sentCount < config.dailyCap && scheduleCursor <= now && attempts < maxAttempts) {
    attempts++;
    const draft = await prisma.outreachDraft.findFirst({
      where: laneWhere,
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    if (!draft) break;

    try {
      await sendDraft(draft.id, { skipDailyCap: true });
    } catch (err) {
      if (!isPermanentDraftFailure(err)) throw err;
      await prisma.outreachDraft.update({ where: { id: draft.id }, data: { status: "FAILED" } });
      failedDraftIds.push(draft.id);
      continue;
    }

    draftIds.push(draft.id);
    sentCount++;
    scheduleCursor = new Date(scheduleCursor.getTime() + nextAutoSendDelayMinutes() * 60_000);
  }

  if (!draftIds.length) {
    return {
      sent: false,
      reason: failedDraftIds.length ? "send_failed" : "no_pending_drafts",
      sentCount: 0,
      draftIds,
      failedDraftIds,
      sentToday,
      dailyCap: config.dailyCap,
      pendingDrafts,
    };
  }

  const nextAllowedAt = scheduleCursor > now ? scheduleCursor : new Date(now.getTime() + nextAutoSendDelayMinutes() * 60_000);
  await prisma.autoSendState.update({
    where: { id: config.stateId },
    data: { lastSentAt: now, nextAllowedAt },
  });

  return {
    sent: true,
    sentCount: draftIds.length,
    draftIds,
    failedDraftIds,
    nextAllowedAt: nextAllowedAt.toISOString(),
    sentToday: sentCount,
    dailyCap: config.dailyCap,
    pendingDrafts,
  };
}

function laneDraftWhere(key: LaneKey, blocked: BlockedRecipients) {
  const blockedContactFilter = blocked.contactIds.length ? { contactId: { notIn: blocked.contactIds } } : {};

  if (key === "first") {
    return {
      status: "PENDING_REVIEW" as const,
      parentDraftId: null,
      ...blockedContactFilter,
    };
  }

  return {
    status: "PENDING_REVIEW" as const,
    parentDraftId: blocked.draftIds.length ? { not: null, notIn: blocked.draftIds } : { not: null },
    ...blockedContactFilter,
    parentDraft: { events: { none: { kind: "REPLY" as const } } },
  };
}

async function getBlockedRecipients(): Promise<BlockedRecipients> {
  const conversions = await prisma.conversion.findMany({
    where: {
      matchStatus: { in: [...CONVERSION_BLOCK_STATUSES] },
      OR: [{ matchedContactId: { not: null } }, { matchedDraftId: { not: null } }],
    },
    select: { matchedContactId: true, matchedDraftId: true },
  });

  return {
    contactIds: conversions
      .map((conversion) => conversion.matchedContactId)
      .filter((id): id is string => Boolean(id)),
    draftIds: conversions
      .map((conversion) => conversion.matchedDraftId)
      .filter((id): id is string => Boolean(id)),
  };
}

function isPermanentDraftFailure(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return message.includes("Invalid To header") || message.includes('"reason": "invalidArgument"');
}
