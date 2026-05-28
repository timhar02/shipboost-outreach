import { prisma } from "@/server/db/client";
import { sendDraft } from "@/lib/gmail/send";
import {
  autoSendDailyCap,
  autoSendEnabled,
  autoSendMaxPerRun,
  nextAutoSendDelayMinutes,
} from "./config";
import { followUpsEnabled } from "@/lib/pipeline/process-follow-ups";

const STATE_ID = "default";

export type AutoSendResult =
  | { sent: true; sentCount: number; draftIds: string[]; nextAllowedAt: string; sentToday: number; dailyCap: number }
  | { sent: false; reason: string; nextAllowedAt?: string; sentToday?: number; dailyCap?: number; pendingDrafts?: number };

export async function runAutoSend(now = new Date()): Promise<AutoSendResult> {
  if (!autoSendEnabled()) return { sent: false, reason: "disabled" };

  const state = await prisma.autoSendState.upsert({
    where: { id: STATE_ID },
    update: {},
    create: { id: STATE_ID },
  });

  if (state.nextAllowedAt && state.nextAllowedAt > now) {
    return { sent: false, reason: "waiting", nextAllowedAt: state.nextAllowedAt.toISOString() };
  }

  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const dailyCap = autoSendDailyCap();
  let sentToday = await prisma.outreachDraft.count({ where: { status: "SENT", sentAt: { gte: todayStart } } });
  if (sentToday >= dailyCap) return { sent: false, reason: "daily_cap_reached", sentToday, dailyCap };

  const pendingWhere = {
    status: "PENDING_REVIEW" as const,
    ...(followUpsEnabled() ? {} : { parentDraftId: null }),
  };

  const pendingDrafts = await prisma.outreachDraft.count({ where: pendingWhere });
  if (!pendingDrafts) return { sent: false, reason: "no_pending_drafts", sentToday, dailyCap, pendingDrafts };

  const draftIds: string[] = [];
  const maxPerRun = Math.min(autoSendMaxPerRun(), dailyCap - sentToday);
  let scheduleCursor = state.nextAllowedAt ?? now;

  while (draftIds.length < maxPerRun && sentToday < dailyCap && scheduleCursor <= now) {
    const draft = await prisma.outreachDraft.findFirst({
      where: pendingWhere,
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    if (!draft) break;

    await sendDraft(draft.id);
    draftIds.push(draft.id);
    sentToday++;
    scheduleCursor = new Date(scheduleCursor.getTime() + nextAutoSendDelayMinutes() * 60_000);
  }

  if (!draftIds.length) {
    return { sent: false, reason: "no_pending_drafts", sentToday, dailyCap, pendingDrafts };
  }

  const nextAllowedAt = scheduleCursor > now ? scheduleCursor : new Date(now.getTime() + nextAutoSendDelayMinutes() * 60_000);
  await prisma.autoSendState.update({
    where: { id: STATE_ID },
    data: { lastSentAt: now, nextAllowedAt },
  });

  return { sent: true, sentCount: draftIds.length, draftIds, nextAllowedAt: nextAllowedAt.toISOString(), sentToday, dailyCap };
}
