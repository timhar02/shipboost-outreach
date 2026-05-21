import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db/client";
import { processLaunch } from "@/lib/pipeline/process-launch";
import type { RawLaunch } from "@/lib/sources/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Cap per-call processing to stay under maxDuration. Email scrape ~5-10s/launch.
const MAX_PER_CALL = 5;

const Payload = z.object({
  source: z.enum(["PEERPUSH", "PEERLIST", "UNEED", "FOUNDRLIST", "SCROLLLAUNCH"]),
  launches: z.array(
    z.object({
      externalId: z.string(),
      name: z.string(),
      tagline: z.string().optional(),
      url: z.string().url(),
      launchedAt: z.string().datetime(),
    }),
  ),
});

export async function POST(req: NextRequest) {
  const secret = process.env.INGEST_SECRET;
  if (!secret || req.headers.get("x-ingest-secret") !== secret) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const parsed = Payload.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });
  }
  const { source: sourceKind, launches } = parsed.data;

  const source = await prisma.source.upsert({
    where: { kind: sourceKind },
    create: { kind: sourceKind, name: sourceKind },
    update: {},
  });

  const result = {
    received: launches.length,
    processed: 0,
    draftsCreated: 0,
    skippedDedup: 0,
    skippedNoEmail: 0,
    skippedError: 0,
    deferred: 0,
  };

  for (const item of launches) {
    const raw: RawLaunch = {
      externalId: item.externalId,
      name: item.name,
      tagline: item.tagline,
      url: item.url,
      launchedAt: new Date(item.launchedAt),
      raw: item,
    };

    if (result.processed >= MAX_PER_CALL) {
      // Persist as Launch row so a later call (or future process-pending cron)
      // can pick it up; skip the slow email-scrape step now.
      try {
        await prisma.launch.upsert({
          where: { sourceId_externalId: { sourceId: source.id, externalId: raw.externalId } },
          create: {
            sourceId: source.id,
            externalId: raw.externalId,
            name: raw.name,
            tagline: raw.tagline,
            url: raw.url,
            launchedAt: raw.launchedAt,
            raw: raw.raw as object,
          },
          update: {},
        });
        result.deferred++;
      } catch {
        result.skippedError++;
      }
      continue;
    }

    const outcome = await processLaunch(source.id, sourceKind, raw);
    result.processed++;
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

  return NextResponse.json({ ok: true, source: sourceKind, ...result });
}
