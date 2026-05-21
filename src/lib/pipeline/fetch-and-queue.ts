import { prisma } from "@/server/db/client";
import { PeerPushSource } from "@/lib/sources/peerpush";
import { HackerNewsSource } from "@/lib/sources/hacker-news";
import { BetaListSource } from "@/lib/sources/betalist";
import { processLaunch } from "@/lib/pipeline/process-launch";

// Soft cap on drafts created per cron run, across all sources combined.
// This caps *creates*, not sends. The send-side cap lives in lib/zoho/send.ts.
const DAILY_CREATE_CAP = 100;

export type FetchResult = {
  launchesSeen: number;
  emailsFound: number;
  draftsCreated: number;
  skipped: number;
  bySource: Record<string, number>;
};

const SOURCES = [new PeerPushSource(), new HackerNewsSource(), new BetaListSource()];

export async function runFetchAndQueue(): Promise<FetchResult> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const result: FetchResult = {
    launchesSeen: 0,
    emailsFound: 0,
    draftsCreated: 0,
    skipped: 0,
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
      // If one source errors, continue to next rather than aborting all.
      continue;
    }

    result.launchesSeen += launches.length;
    result.bySource[sourceAdapter.kind] = 0;

    for (const raw of launches) {
      if (result.draftsCreated >= DAILY_CREATE_CAP) break;

      const outcome = await processLaunch(source.id, sourceAdapter.kind, raw);
      switch (outcome.kind) {
        case "DRAFT_CREATED":
          result.emailsFound++;
          result.draftsCreated++;
          result.bySource[sourceAdapter.kind]++;
          break;
        case "SKIPPED_DEDUP":
        case "SKIPPED_NO_EMAIL":
        case "SKIPPED_ERROR":
          result.skipped++;
          break;
      }
    }
  }

  return result;
}
