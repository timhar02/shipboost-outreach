import { prisma } from "@/server/db/client";
import { listConnectedGmailAccounts } from "./client";

/** Thrown when every sender has hit its daily cap; the send loop stops for the day. */
export class NoSenderCapacityError extends Error {
  constructor() {
    super("all sender accounts reached their daily cap");
  }
}

/** The original sender. Drafts sent before multi-sender support belong to it. */
export function primarySender(): string {
  const primary = process.env.SENDER_EMAIL ?? configuredSenders()[0];
  if (!primary) throw new Error("SENDER_EMAIL missing");
  return primary.toLowerCase();
}

/** Accounts allowed to send: SENDER_EMAILS (comma-separated), else SENDER_EMAIL. */
export function configuredSenders(): string[] {
  const list = process.env.SENDER_EMAILS ?? process.env.SENDER_EMAIL ?? "";
  return [...new Set(list.split(",").map((email) => email.trim().toLowerCase()).filter(Boolean))];
}

export function perSenderDailyCap(): number {
  const parsed = Number.parseInt(process.env.AUTO_SEND_PER_SENDER_DAILY_CAP ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 25;
}

/** Configured senders that also have a connected Gmail credential. */
export async function availableSenders(): Promise<string[]> {
  const connected = new Set((await listConnectedGmailAccounts()).map((email) => email.toLowerCase()));
  return configuredSenders().filter((email) => connected.has(email));
}

export async function sentTodayBySender(senders: string[], now = new Date()): Promise<Map<string, number>> {
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const primary = primarySender();
  const counts = new Map<string, number>();
  for (const sender of senders) {
    counts.set(
      sender,
      await prisma.outreachDraft.count({
        where: {
          status: "SENT",
          sentAt: { gte: todayStart },
          OR: sender === primary ? [{ senderEmail: sender }, { senderEmail: null }] : [{ senderEmail: sender }],
        },
      }),
    );
  }
  return counts;
}

/** The connected sender with the fewest sends today, still under its daily cap. */
export async function pickSender(now = new Date()): Promise<string> {
  const senders = await availableSenders();
  if (!senders.length) throw new Error("No Gmail credential - visit /api/gmail/authorize");
  const counts = await sentTodayBySender(senders, now);
  const cap = perSenderDailyCap();
  const open = senders.filter((sender) => (counts.get(sender) ?? 0) < cap);
  if (!open.length) throw new NoSenderCapacityError();
  return open.sort((a, b) => (counts.get(a) ?? 0) - (counts.get(b) ?? 0))[0];
}
