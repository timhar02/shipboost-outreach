import { request } from "undici";
import { canonicalizeUrl } from "@/lib/scrape/fetch-html";
import type { LaunchSource, RawLaunch } from "./types";

const ENDPOINT = "https://hn.algolia.com/api/v1/search_by_date";

// Hosts to skip — repos, app stores, and HN itself.
const SKIP_HOSTS = [
  "github.com",
  "gitlab.com",
  "gist.github.com",
  "chrome.google.com",
  "apps.apple.com",
  "play.google.com",
  "news.ycombinator.com",
];

// Tagline keyword rejects — mirrors PeerPush filter.
const TAGLINE_DENY = [
  /\b(buy|shop|store)\b/i,
  /\b(course|guide|template)\s+(on|for|to)\b/i,
  /\b(agency|consulting|freelancer)\b/i,
  /\b(apparel|clothing|t-shirt|hoodie|merch)\b/i,
  /\btest\b/i,
];

type HnHit = {
  objectID: string;
  title: string;
  url?: string | null;
  created_at_i: number;
  story_text?: string | null;
  author?: string | null;
};

type ApiResponse = { hits?: HnHit[] };

function stripShowHn(title: string): string {
  return title.replace(/^Show HN[:\s]+[-–—]?\s*/i, "").trim();
}

function splitNameTagline(title: string): { name: string; tagline?: string } {
  const sep = /\s[–—-]\s|:\s/.exec(title);
  if (sep) {
    const idx = sep.index;
    const name = title.slice(0, idx).trim();
    const tagline = title.slice(idx + sep[0].length).trim() || undefined;
    return { name, tagline };
  }
  return { name: title };
}

export class HackerNewsSource implements LaunchSource {
  kind = "HACKER_NEWS" as const;

  async fetchSince(since: Date): Promise<RawLaunch[]> {
    const unixTs = Math.floor(since.getTime() / 1000);
    const url = `${ENDPOINT}?tags=show_hn&hitsPerPage=50&numericFilters=created_at_i>${unixTs}`;

    const { statusCode, body } = await request(url, {
      method: "GET",
      headers: { accept: "application/json", "user-agent": "ShipBoost-Outreach/1.0" },
      headersTimeout: 10_000,
      bodyTimeout: 10_000,
    });
    if (statusCode !== 200) throw new Error(`HN Algolia API ${statusCode}`);

    const payload = (await body.json()) as ApiResponse;
    const hits = payload.hits ?? [];

    const out: RawLaunch[] = [];

    for (const hit of hits) {
      if (!hit.url) continue;

      let cleanUrl: string;
      try {
        cleanUrl = canonicalizeUrl(hit.url);
      } catch {
        continue;
      }

      let host: string;
      try {
        host = new URL(cleanUrl).hostname.toLowerCase();
      } catch {
        continue;
      }
      if (SKIP_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))) continue;

      const strippedTitle = stripShowHn(hit.title);
      const { name, tagline } = splitNameTagline(strippedTitle);

      const haystack = `${name} ${tagline ?? ""}`;
      if (TAGLINE_DENY.some((re) => re.test(haystack))) continue;

      out.push({
        externalId: hit.objectID,
        name,
        tagline,
        url: cleanUrl,
        launchedAt: new Date(hit.created_at_i * 1000),
        topics: ["show-hn"],
        raw: hit,
      });
    }

    return out;
  }
}
