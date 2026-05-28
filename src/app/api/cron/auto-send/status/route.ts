import { NextResponse, type NextRequest } from "next/server";
import { autoSendDailyCap, autoSendEnabled, autoSendMaxPerRun } from "@/lib/auto-send/config";
import { followUpsEnabled } from "@/lib/pipeline/process-follow-ups";
import { prisma } from "@/server/db/client";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const headerSecret = req.headers.get("x-cron-secret") ?? req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (headerSecret !== secret) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const pendingWhere = {
    status: "PENDING_REVIEW" as const,
    ...(followUpsEnabled() ? {} : { parentDraftId: null }),
  };
  const [state, pendingDrafts, sentToday, lastSent] = await Promise.all([
    prisma.autoSendState.findUnique({ where: { id: "default" } }),
    prisma.outreachDraft.count({ where: pendingWhere }),
    prisma.outreachDraft.count({ where: { status: "SENT", sentAt: { gte: todayStart } } }),
    prisma.outreachDraft.findFirst({
      where: { status: "SENT" },
      orderBy: { sentAt: "desc" },
      select: { id: true, sentAt: true, contact: { select: { email: true } } },
    }),
  ]);

  return NextResponse.json({
    ok: true,
    enabled: autoSendEnabled(),
    now: now.toISOString(),
    due: !state?.nextAllowedAt || state.nextAllowedAt <= now,
    state,
    pendingDrafts,
    followUpsEnabled: followUpsEnabled(),
    sentToday,
    dailyCap: autoSendDailyCap(),
    maxPerRun: autoSendMaxPerRun(),
    lastSent,
  });
}
