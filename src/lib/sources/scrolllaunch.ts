import { request } from "undici";
import type { LaunchSource, RawLaunch } from "./types";
import { cleanExternalUrl, cleanText, isRelevantLaunch, isoWeeksSince } from "./filters";

// Public, unauthenticated catalog API (OpenAPI at /openapi.json, 120 req/min per IP).
// robots.txt disallows /api/ but not /v1.
const LEADERBOARD = (week: string) =>
  `https://www.scrolllaunch.com/v1/leaderboard?week=${week}&limit=100`;
const PRODUCT = (slug: string) => `https://www.scrolllaunch.com/v1/products/${encodeURIComponent(slug)}`;
const SOURCE_HOST = "scrolllaunch.com";
const UA = "ShipBoost-Outreach/1.0 (+https://shipboost.io)";

type ScrollLaunchProduct = {
  name: string;
  slug: string;
  url: string;
  tagline?: string | null;
  website?: string | null;
  categories?: string[];
  pricingType?: string | null;
  upvotes?: number;
  launchWeek?: string | null;
  premiumListing?: boolean;
};

type LeaderboardResponse = { week?: string; products?: ScrollLaunchProduct[] };

/**
 * ScrollLaunch runs a weekly board, so we read every board the window touches
 * and let the (sourceId, externalId) upsert drop launches we already have.
 * `premiumListing` is kept in raw: those founders already paid for a launch.
 */
export class ScrollLaunchSource implements LaunchSource {
  kind = "SCROLLLAUNCH" as const;

  async fetchSince(date: Date): Promise<RawLaunch[]> {
    const out: RawLaunch[] = [];
    const seen = new Set<string>();

    for (const { year, week, startsOn } of isoWeeksSince(date)) {
      const weekLabel = `${year}-W${String(week).padStart(2, "0")}`;
      const products = await fetchLeaderboard(weekLabel);

      for (const product of products) {
        if (!product.website || seen.has(product.slug)) continue;
        const url = cleanExternalUrl(product.website, SOURCE_HOST);
        if (!url) continue;
        const name = cleanText(product.name);
        const tagline = product.tagline ? cleanText(product.tagline) : undefined;
        if (!isRelevantLaunch(name, tagline)) continue;
        seen.add(product.slug);

        out.push({
          externalId: `scrolllaunch:${product.slug}`,
          name,
          tagline,
          url,
          launchedAt: startsOn,
          votesCount: product.upvotes,
          topics: product.categories ?? [],
          raw: { ...product, week: weekLabel },
        });
      }
    }

    return out;
  }
}

async function fetchLeaderboard(week: string): Promise<ScrollLaunchProduct[]> {
  const { statusCode, body } = await request(LEADERBOARD(week), {
    method: "GET",
    headers: { "user-agent": UA, accept: "application/json" },
    headersTimeout: 10_000,
    bodyTimeout: 10_000,
  });
  if (statusCode !== 200) {
    await body.dump();
    throw new Error(`ScrollLaunch API ${statusCode}`);
  }
  const payload = (await body.json()) as LeaderboardResponse;
  return payload.products ?? [];
}

/**
 * The founder's first name from the product detail endpoint (`makerName`),
 * which the leaderboard leaves out. Returns undefined when the name doesn't
 * look like a person's (a handle, the product name, a single letter).
 */
export async function fetchScrollLaunchMakerFirstName(slug: string, productName: string): Promise<string | undefined> {
  try {
    const { statusCode, body } = await request(PRODUCT(slug), {
      method: "GET",
      headers: { "user-agent": UA, accept: "application/json" },
      headersTimeout: 10_000,
      bodyTimeout: 10_000,
    });
    if (statusCode !== 200) {
      await body.dump();
      return undefined;
    }
    const product = (await body.json()) as { makerName?: string | null };
    return personFirstName(product.makerName, productName);
  } catch {
    return undefined;
  }
}

export function personFirstName(makerName: string | null | undefined, productName: string): string | undefined {
  const name = cleanText(makerName ?? "");
  const first = name.split(" ")[0];
  if (!first || !/^\p{Lu}[\p{Ll}'-]{1,}$/u.test(first)) return undefined;
  if (name.toLowerCase() === productName.toLowerCase() || /^unknown$/i.test(first)) return undefined;
  return first;
}
