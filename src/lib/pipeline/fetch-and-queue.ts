import { prisma } from "@/server/db/client";
import { PeerPushSource } from "@/lib/sources/peerpush";
import { HackerNewsSource } from "@/lib/sources/hacker-news";
import { BetaListSource } from "@/lib/sources/betalist";
import { StartupBaseSource } from "@/lib/sources/startupbase";
import { LaunchingNextSource } from "@/lib/sources/launching-next";

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
  sourceErrors: Record<string, string>;
  sourceTimingsMs: Record<string, number>;
};
const SOURCE_TIMEOUT_MS = 30_000;
const UPSERT_PARALLELISM = 10;

const SOURCES = [
  new PeerPushSource(),
  new HackerNewsSource(),
  new BetaListSource(),
  new StartupBaseSource(),
  new LaunchingNextSource(),
];

export async function runFetchAndQueue(): Promise<FetchResult> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const result: FetchResult = {
    launchesSeen: 0,
    launchesStored: 0,
    bySource: {},
    sourceErrors: {},
    sourceTimingsMs: {},
  };

  const settled = await Promise.all(SOURCES.map((sourceAdapter) => fetchAndStoreSource(sourceAdapter, since)));
  for (const item of settled) {
    result.launchesSeen += item.launchesSeen;
    result.launchesStored += item.launchesStored;
    result.sourceTimingsMs[item.source] = item.timingMs;
    if (item.error) result.sourceErrors[item.source] = item.error;
    else result.bySource[item.source] = item.launchesStored;
  }

  return result;
}

async function fetchAndStoreSource(
  sourceAdapter: (typeof SOURCES)[number],
  since: Date,
): Promise<{ source: string; launchesSeen: number; launchesStored: number; timingMs: number; error?: string }> {
  const started = Date.now();
  const source = await prisma.source.upsert({
    where: { kind: sourceAdapter.kind },
    create: { kind: sourceAdapter.kind, name: sourceAdapter.kind },
    update: {},
  });

  let launches: Awaited<ReturnType<typeof sourceAdapter.fetchSince>>;
  try {
    launches = await withTimeout(sourceAdapter.fetchSince(since), SOURCE_TIMEOUT_MS);
  } catch (err) {
    return {
      source: sourceAdapter.kind,
      launchesSeen: 0,
      launchesStored: 0,
      timingMs: Date.now() - started,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  let launchesStored = 0;
  for (let i = 0; i < launches.length; i += UPSERT_PARALLELISM) {
    const batch = launches.slice(i, i + UPSERT_PARALLELISM);
    const stored = await Promise.all(
      batch.map(async (raw) => {
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
          return 1;
        } catch {
          // ignore individual upsert errors so one bad row doesn't kill the batch
          return 0;
        }
      }),
    );
    for (const count of stored) {
      launchesStored += count;
    }
  }

  return {
    source: sourceAdapter.kind,
    launchesSeen: launches.length,
    launchesStored,
    timingMs: Date.now() - started,
  };
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => reject(new Error(`source timeout after ${timeoutMs}ms`)), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}
