import { request } from "undici";
import type { LaunchSource, RawLaunch } from "./types";
import { cleanExternalUrl, cleanText, isRelevantLaunch, isoWeeksSince } from "./filters";

// Public read API (OpenAPI at /api/v1/openapi.json). Reads are anonymous.
// The site's robots.txt disallows /api/ for crawlers, so we keep this to one
// or two calls per daily run.
const FEED_WEEK = (year: number, week: number) =>
  `https://nicklaunches.com/api/v1/feed/week/?year=${year}&week=${week}`;
const SOURCE_HOST = "nicklaunches.com";
const UA = "ShipBoost-Outreach/1.0 (+https://shipboost.io)";

type NickLaunchesItem = {
  slug: string;
  name: string;
  tagline?: string | null;
  url?: string | null;
  categories?: string[];
  pricing?: string | null;
  upvotes?: number;
  launchDate?: string | null;
  productUrl?: string | null;
  featured?: boolean;
};

type FeedWeekResponse = { items?: NickLaunchesItem[] };

/**
 * Nick Launches is a weekly board too. `featured` marks the paid launches;
 * it stays in raw so paid launchers can be told apart later.
 */
export class NickLaunchesSource implements LaunchSource {
  kind = "NICK_LAUNCHES" as const;

  async fetchSince(date: Date): Promise<RawLaunch[]> {
    const out: RawLaunch[] = [];
    const seen = new Set<string>();

    for (const { year, week, startsOn } of isoWeeksSince(date)) {
      const items = await fetchWeek(year, week);

      for (const item of items) {
        if (!item.url || seen.has(item.slug)) continue;
        const url = cleanExternalUrl(item.url, SOURCE_HOST);
        if (!url) continue;
        const name = cleanText(item.name);
        const tagline = item.tagline ? cleanText(item.tagline) : undefined;
        if (!isRelevantLaunch(name, tagline)) continue;
        seen.add(item.slug);

        const launchedAt = item.launchDate ? new Date(item.launchDate) : startsOn;
        out.push({
          externalId: `nick-launches:${item.slug}`,
          name,
          tagline,
          url,
          launchedAt: Number.isNaN(launchedAt.getTime()) ? startsOn : launchedAt,
          votesCount: item.upvotes,
          topics: item.categories ?? [],
          raw: item,
        });
      }
    }

    return out;
  }
}

async function fetchWeek(year: number, week: number): Promise<NickLaunchesItem[]> {
  const { statusCode, body } = await request(FEED_WEEK(year, week), {
    method: "GET",
    headers: { "user-agent": UA, accept: "application/json" },
    headersTimeout: 10_000,
    bodyTimeout: 10_000,
  });
  if (statusCode !== 200) {
    await body.dump();
    throw new Error(`Nick Launches API ${statusCode}`);
  }
  const payload = (await body.json()) as FeedWeekResponse;
  return payload.items ?? [];
}
