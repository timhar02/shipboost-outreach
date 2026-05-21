import { prisma } from "@/server/db/client";
import { PeerPushSource } from "@/lib/sources/peerpush";
import { HackerNewsSource } from "@/lib/sources/hacker-news";
import { BetaListSource } from "@/lib/sources/betalist";

/**
 * Lightweight daily fetch: pulls launches from each source and persists them
 * as Launch rows with processedAt=null. The slow per-launch email-scrape +
 * draft-create work is done later in batches by /api/cron/process-pending,
 * keeping each Vercel cron call comfortably under the 60s function timeout.
 */
export type FetchResult = {
  launchesSeen: number;
  launchesStored: number;
  bySource: Record<string, number>;
};

const SOURCES = [new PeerPushSource(), new HackerNewsSource(), new BetaListSource()];

export async function runFetchAndQueue(): Promise<FetchResult> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const result: FetchResult = {
    launchesSeen: 0,
    launchesStored: 0,
    bySource: {},
  };

  for (const sourceAdapter of SOURCES) {
    const source = await prisma.source.upsert({
      where: { kind: sourceAdapter.kind },
      create: { kind: sourceAdapter.kind, name: sourceAdapter.kind },
      update: {},
    });

    let launches: Awaited<ReturnType<typeof sourceAdapter.fetchSince>>;
    try {
      launches = await sourceAdapter.fetchSince(since);
    } catch {
      continue;
    }

    result.launchesSeen += launches.length;
    result.bySource[sourceAdapter.kind] = 0;

    for (const raw of launches) {
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
            // processedAt stays null so process-pending picks it up
          },
          update: {},
        });
        result.launchesStored++;
        result.bySource[sourceAdapter.kind]++;
      } catch {
        // ignore individual upsert errors so one bad row doesn't kill the batch
      }
    }
  }

  return result;
}
