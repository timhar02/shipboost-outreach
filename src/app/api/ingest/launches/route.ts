import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db/client";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Receive a batch of scraped launches from GitHub Actions (e.g. Uneed scraper).
 * We persist them as Launch rows with processedAt=null and let
 * /api/cron/process-pending drain them later in 5-at-a-time batches. Keeps
 * this endpoint fast (under Vercel 60s) regardless of batch size.
 */

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

  let stored = 0;
  let failed = 0;
  for (const item of launches) {
    try {
      await prisma.launch.upsert({
        where: { sourceId_externalId: { sourceId: source.id, externalId: item.externalId } },
        create: {
          sourceId: source.id,
          externalId: item.externalId,
          name: item.name,
          tagline: item.tagline,
          url: item.url,
          launchedAt: new Date(item.launchedAt),
          raw: item,
          // processedAt stays null so process-pending picks it up
        },
        update: {},
      });
      stored++;
    } catch {
      failed++;
    }
  }

  return NextResponse.json({ ok: true, source: sourceKind, received: launches.length, stored, failed });
}
