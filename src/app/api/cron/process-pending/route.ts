import { NextResponse, type NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db/client";
import { processLaunch } from "@/lib/pipeline/process-launch";
import { launchPriorityTiers } from "@/lib/sources/priority";
import type { RawLaunch } from "@/lib/sources/types";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
export const maxDuration = 60;

// How many Launch rows without a Contact to process per call.
// Keep the default low so external cron services with 30s timeouts complete.
const DEFAULT_BATCH = 2;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const headerSecret =
      req.headers.get("x-cron-secret") ??
      req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (headerSecret !== secret) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
  }

  try {
    const batch = readBatch(req);
    // Find the oldest pending Launch rows that have never been processed,
    // priority sources first (see launchPriorityTiers).
    // (Don't re-try rows where the email scrape already failed — they'd loop forever.)
    const pending: Prisma.LaunchGetPayload<{ include: { source: true } }>[] = [];
    for (const tier of launchPriorityTiers()) {
      if (pending.length >= batch) break;
      pending.push(
        ...(await prisma.launch.findMany({
          where: {
            AND: [tier, { processedAt: null, source: { enabled: true } }],
            id: { notIn: pending.map((launch) => launch.id) },
          },
          include: { source: true },
          orderBy: { fetchedAt: "asc" },
          take: batch - pending.length,
        })),
      );
    }

    const result = {
      claimed: pending.length,
      draftsCreated: 0,
      skippedDedup: 0,
      skippedNoEmail: 0,
      skippedError: 0,
    };

    for (const launch of pending) {
      const raw: RawLaunch = {
        externalId: launch.externalId,
        name: launch.name,
        tagline: launch.tagline ?? undefined,
        url: launch.url,
        launchedAt: launch.launchedAt,
        raw: launch.raw,
      };
      // Skip LLM here to stay under Vercel 60s. /api/admin/redraft handles
      // LLM personalization in a separate, slower batch.
      const outcome = await processLaunch(launch.sourceId, launch.source.kind, raw, { useLlm: false });
      switch (outcome.kind) {
        case "DRAFT_CREATED":
          result.draftsCreated++;
          break;
        case "SKIPPED_DEDUP":
          result.skippedDedup++;
          break;
        case "SKIPPED_NO_EMAIL":
          result.skippedNoEmail++;
          break;
        case "SKIPPED_ERROR":
          result.skippedError++;
          break;
      }
    }

    const remaining = await prisma.launch.count({ where: { processedAt: null, source: { enabled: true } } });
    return NextResponse.json({ ok: true, ...result, remaining });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

function readBatch(req: NextRequest): number {
  const raw = req.nextUrl.searchParams.get("batch") ?? process.env.PROCESS_PENDING_BATCH;
  const parsed = raw ? Number.parseInt(raw, 10) : DEFAULT_BATCH;
  if (!Number.isFinite(parsed) || parsed < 1) return DEFAULT_BATCH;
  return Math.min(parsed, 5);
}
