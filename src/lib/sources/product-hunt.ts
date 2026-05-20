import { request } from "undici";
import { canonicalizeUrl } from "@/lib/scrape/fetch-html";
import type { LaunchSource, RawLaunch } from "./types";

const PH_ENDPOINT = "https://api.producthunt.com/v2/api/graphql";
const DENY_TOPICS = new Set([
  "chrome-extensions", "firefox-extensions", "browser-extensions",
  "ios", "android", "physical-products", "books", "podcasts",
  "notion-templates", "figma-plugins",
]);
const MIN_VOTES = 0;

const QUERY = `
  query Posts($postedAfter: DateTime!) {
    posts(postedAfter: $postedAfter, order: NEWEST, first: 50) {
      edges { node {
        id name tagline url website votesCount createdAt
        topics(first: 10) { edges { node { slug } } }
      } }
    }
  }
`;

type PhEdge = {
  node: {
    id: string; name: string; tagline?: string; url: string; website?: string;
    votesCount: number; createdAt: string;
    topics: { edges: { node: { slug: string } }[] };
  };
};

export class ProductHuntSource implements LaunchSource {
  kind = "PRODUCT_HUNT" as const;

  async fetchSince(date: Date): Promise<RawLaunch[]> {
    const token = process.env.PRODUCT_HUNT_TOKEN;
    if (!token) throw new Error("PRODUCT_HUNT_TOKEN missing");

    const { statusCode, body } = await request(PH_ENDPOINT, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ query: QUERY, variables: { postedAfter: date.toISOString() } }),
    });
    if (statusCode !== 200) throw new Error(`PH API ${statusCode}`);
    const payload = (await body.json()) as { data?: { posts?: { edges?: PhEdge[] } } };
    const edges = payload.data?.posts?.edges ?? [];

    const out: RawLaunch[] = [];
    for (const { node } of edges) {
      if (!node.website) continue;
      if (node.votesCount < MIN_VOTES) continue;
      const topics = node.topics.edges.map((t) => t.node.slug);
      if (topics.some((t) => DENY_TOPICS.has(t))) continue;

      let website: string;
      try {
        const resolved = await resolveDestination(node.website);
        if (!resolved) continue;
        const raw = new URL(resolved);
        raw.searchParams.delete("ref");
        for (const k of [...raw.searchParams.keys()]) if (k.startsWith("utm_")) raw.searchParams.delete(k);
        website = canonicalizeUrl(raw.toString());
      } catch { continue; }
      const host = new URL(website).hostname;
      if (host.endsWith("producthunt.com")) continue;
      if (host.endsWith("chrome.google.com") || host.endsWith("apps.apple.com") || host.endsWith("play.google.com")) continue;

      out.push({
        externalId: node.id, name: node.name, tagline: node.tagline, url: website,
        launchedAt: new Date(node.createdAt), votesCount: node.votesCount, topics, raw: node,
      });
    }
    return out;
  }
}

async function resolveDestination(url: string): Promise<string | null> {
  // PH /r/ redirects return 403 to non-browser sessions, so we can't resolve them.
  // Detect and bail fast.
  try {
    if (new URL(url).hostname.endsWith("producthunt.com") && new URL(url).pathname.startsWith("/r/")) {
      return null;
    }
  } catch { return null; }

  let current = url;
  for (let hop = 0; hop < 3; hop++) {
    try {
      const { statusCode, headers } = await request(current, {
        method: "HEAD",
        headers: { "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" },
        headersTimeout: 3_000,
        bodyTimeout: 3_000,
      });
      if (statusCode >= 300 && statusCode < 400) {
        const loc = headers["location"];
        const next = Array.isArray(loc) ? loc[0] : loc;
        if (!next) return current;
        current = new URL(next, current).toString();
        continue;
      }
      return current;
    } catch {
      return current;
    }
  }
  return current;
}
