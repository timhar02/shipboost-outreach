import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db/client";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
export const maxDuration = 60;

/**
 * Receive a batch of scraped launches from GitHub Actions (e.g. Uneed scraper).
 * We persist them as Launch rows with processedAt=null and let
 * /api/cron/process-pending drain them later in 5-at-a-time batches. Keeps
 * this endpoint fast (under Vercel 60s) regardless of batch size.
 */

const Payload = z.object({
  source: z.enum([
    "PEERPUSH",
    "PEERLIST",
    "UNEED",
    "FOUNDRLIST",
    "SCROLLLAUNCH",
    "STARTUPBASE",
    "PITCHWALL",
    "LAUNCHING_NEXT",
    "SAASHUB",
  ]),
  launches: z.array(
    z.object({
      externalId: z.string(),
      name: z.string(),
      tagline: z.string().optional(),
      url: z.string().url(),
      launchedAt: z.string().min(1),
    }),
  ),
});

export async function POST(req: NextRequest) {
  try {
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
    const failures: Array<{ externalId: string; error: string }> = [];
    for (const item of launches) {
      try {
        const launchedAt = parseLaunchDate(item.launchedAt);
        await prisma.launch.upsert({
          where: { sourceId_externalId: { sourceId: source.id, externalId: item.externalId } },
          create: {
            sourceId: source.id,
            externalId: item.externalId,
            name: item.name,
            tagline: item.tagline,
            url: item.url,
            launchedAt,
            raw: item,
            // processedAt stays null so process-pending picks it up
          },
          update: {},
        });
        stored++;
      } catch (err) {
        failures.push({ externalId: item.externalId, error: err instanceof Error ? err.message : String(err) });
      }
    }

    return NextResponse.json({
      ok: true,
      source: sourceKind,
      received: launches.length,
      stored,
      failed: failures.length,
      failures: failures.slice(0, 20),
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

function parseLaunchDate(raw: string): Date {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? new Date(`${raw}T00:00:00.000Z`) : new Date(raw);
  if (Number.isNaN(date.getTime())) throw new Error(`invalid launchedAt: ${raw}`);
  return date;
}
