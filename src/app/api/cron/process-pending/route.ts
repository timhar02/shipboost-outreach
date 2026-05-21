import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/server/db/client";
import { processLaunch } from "@/lib/pipeline/process-launch";
import type { RawLaunch } from "@/lib/sources/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// How many Launch rows without a Contact to process per call.
// Stay under maxDuration: email scrape ~5-10s each.
const BATCH = 5;

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
    // Find oldest pending Launch rows that have never been processed.
    // (Don't re-try rows where the email scrape already failed — they'd loop forever.)
    const pending = await prisma.launch.findMany({
      where: { processedAt: null },
      include: { source: true },
      orderBy: { fetchedAt: "asc" },
      take: BATCH,
    });

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
      const outcome = await processLaunch(launch.sourceId, launch.source.kind, raw);
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

    const remaining = await prisma.launch.count({ where: { processedAt: null } });
    return NextResponse.json({ ok: true, ...result, remaining });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
