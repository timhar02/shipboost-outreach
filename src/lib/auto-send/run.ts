import { prisma } from "@/server/db/client";
import { sendDraft } from "@/lib/gmail/send";
import {
  autoSendDailyCap,
  autoSendEnabled,
  nextAutoSendDelayMinutes,
} from "./config";

const STATE_ID = "default";

export type AutoSendResult =
  | { sent: true; draftId: string; nextAllowedAt: string; sentToday: number; dailyCap: number }
  | { sent: false; reason: string; nextAllowedAt?: string; sentToday?: number; dailyCap?: number };

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
  const sentToday = await prisma.outreachDraft.count({ where: { status: "SENT", sentAt: { gte: todayStart } } });
  if (sentToday >= dailyCap) return { sent: false, reason: "daily_cap_reached", sentToday, dailyCap };

  const draft = await prisma.outreachDraft.findFirst({
    where: { status: "PENDING_REVIEW" },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!draft) return { sent: false, reason: "no_pending_drafts", sentToday, dailyCap };

  await sendDraft(draft.id);

  const delayMinutes = nextAutoSendDelayMinutes();
  const nextAllowedAt = new Date(now.getTime() + delayMinutes * 60_000);
  await prisma.autoSendState.update({
    where: { id: STATE_ID },
    data: { lastSentAt: now, nextAllowedAt },
  });

  return { sent: true, draftId: draft.id, nextAllowedAt: nextAllowedAt.toISOString(), sentToday: sentToday + 1, dailyCap };
}
