import { request } from "undici";
import { canonicalizeUrl } from "@/lib/scrape/fetch-html";
import type { LaunchSource, RawLaunch } from "./types";

const PH_ENDPOINT = "https://api.producthunt.com/v2/api/graphql";

// Positive allowlist: a post must have at least one of these topics to be considered SaaS-relevant.
const ALLOW_TOPICS = new Set([
  "saas",
  "developer-tools",
  "productivity",
  "marketing",
  "analytics",
  "design-tools",
  "no-code",
  "web-app",
  "api",
  "automation",
  "workflow-automation",
  "crm",
  "email",
  "project-management",
  "task-management",
  "customer-support",
  "customer-communication",
  "collaboration",
  "remote-work",
  "data-visualization",
  "artificial-intelligence",
  "machine-learning",
  "open-source",
  "developer-utilities",
  "tech",
  "saas-tools",
  "sales",
  "growth-hacking",
  "user-experience",
  "user-research",
  "writing-tools",
  "video-tools",
  "social-media",
  "seo",
  "ecommerce", // ecommerce TOOLS, paired with denylist below to exclude actual stores
  "education-tools",
  "fintech",
  "developer-experience",
  "monitoring",
  "security",
  "ai",
]);

// Deny topics: even if an allow-topic matches, these always disqualify.
const DENY_TOPICS = new Set([
  "chrome-extensions", "firefox-extensions", "browser-extensions",
  "ios", "android", "mobile-apps", "physical-products", "books",
  "podcasts", "newsletters", "notion-templates", "figma-plugins",
  "merch", "hardware", "toys-games", "food-drink", "fashion", "music",
  "pets", "travel", "art", "fitness", "health-and-fitness",
  "courses", "education", // info products, not SaaS
  "agencies", "freelance", "consulting",
  "investing", "crypto", "nfts",
  "games", "gaming",
]);

// Tagline keyword denylist: catches launches the topic system mislabels.
// Matched word-boundary, case-insensitive, against name + tagline.
const TAGLINE_DENY = [
  /\b(buy|shop|store|order)\b/i,
  /\b(book|ebook|course|guide|template|kit)\s+(on|for|to)\b/i,
  /\bnewsletter\b/i,
  /\b(agency|consulting|consultancy|freelancer)\b/i,
  /\b(handmade|handcrafted|artisan)\b/i,
  /\b(apparel|clothing|t-shirt|hoodie|merch)\b/i,
  /\b(NFT|crypto wallet|token sale|ICO)\b/i,
  /\bphysical (product|good)/i,
];

const MIN_VOTES = 0;

const QUERY = `
  query Posts($postedAfter: DateTime!, $after: String) {
    posts(postedAfter: $postedAfter, order: NEWEST, first: 20, after: $after) {
      edges { node {
        id name tagline url website votesCount createdAt
        topics(first: 10) { edges { node { slug } } }
      } }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

const MAX_PAGES = 5;            // 5 pages × 20 = up to 100 PH posts/run
const PAGE_DELAY_MS = 1500;     // be nice to PH between paginated requests

type PhEdge = {
  node: {
    id: string; name: string; tagline?: string; url: string; website?: string;
    votesCount: number; createdAt: string;
    topics: { edges: { node: { slug: string } }[] };
  };
};

type PhResponse = {
  data?: {
    posts?: {
      edges?: PhEdge[];
      pageInfo?: { hasNextPage: boolean; endCursor: string | null };
    };
  };
};

export class ProductHuntSource implements LaunchSource {
  kind = "PRODUCT_HUNT" as const;

  async fetchSince(date: Date): Promise<RawLaunch[]> {
    const token = process.env.PRODUCT_HUNT_TOKEN;
    if (!token) throw new Error("PRODUCT_HUNT_TOKEN missing");

    const edges: PhEdge[] = [];
    let after: string | null = null;
    for (let page = 0; page < MAX_PAGES; page++) {
      if (page > 0) await new Promise((r) => setTimeout(r, PAGE_DELAY_MS));
      const { statusCode, body } = await request(PH_ENDPOINT, {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ query: QUERY, variables: { postedAfter: date.toISOString(), after } }),
      });
      if (statusCode === 429) {
        // Rate limited — return what we have so far rather than crash
        break;
      }
      if (statusCode !== 200) throw new Error(`PH API ${statusCode}`);
      const payload = (await body.json()) as PhResponse;
      const pageEdges = payload.data?.posts?.edges ?? [];
      edges.push(...pageEdges);
      const info = payload.data?.posts?.pageInfo;
      if (!info?.hasNextPage || !info.endCursor) break;
      after = info.endCursor;
    }

    const out: RawLaunch[] = [];
    for (const { node } of edges) {
      if (!node.website) continue;
      if (node.votesCount < MIN_VOTES) continue;
      const topics = node.topics.edges.map((t) => t.node.slug);

      // Must hit at least one allowed topic
      if (!topics.some((t) => ALLOW_TOPICS.has(t))) continue;
      // Any denied topic disqualifies
      if (topics.some((t) => DENY_TOPICS.has(t))) continue;

      // Tagline keyword sanity check
      const haystack = `${node.name} ${node.tagline ?? ""}`;
      if (TAGLINE_DENY.some((re) => re.test(haystack))) continue;

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
