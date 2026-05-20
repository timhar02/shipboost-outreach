import { request } from "undici";
import { canonicalizeUrl } from "@/lib/scrape/fetch-html";
import type { LaunchSource, RawLaunch } from "./types";

const ENDPOINT = "https://peerpush.net/api/v1/launches";

// PeerPush category allowlist for SaaS-relevant launches.
// Categories that don't fit ShipBoost's audience (apparel, games, etc.) are excluded
// implicitly by not being in this set.
const ALLOW_CATEGORIES = new Set<string>([
  "AI", "AI Tools", "AI Chat", "AI Writing", "AI Productivity Tools",
  "AI Governance", "AI Infrastructure", "AI Song Generator",
  "Developer Tools", "No-Code / Low-Code", "Automation & Workflow",
  "Analytics & Monitoring", "SaaS Tools", "Productivity",
  "Marketing", "Product Marketing", "Sales", "CRM", "Customer Support",
  "Project Management", "Task Management",
  "Design Tools", "Email", "Forms", "Newsletters",
  "Website & Landing Page Builders", "Web Hosting",
  "Legal & Compliance", "Accounting", "Finance", "Fintech",
  "HR", "Recruiting",
  "Education Tools", "Online Learning Platforms",
  "Security", "Privacy", "Cybersecurity",
  "Social Media & Influencer Tools",
  "Video & Audio Tools",
  "Visitor Management",
  "Collaboration", "Team Communication",
  "API & Integrations",
  "Data & Databases",
  "DevOps",
  "E-commerce Tools",
  "Writing & Content",
  "Note Taking",
  "Browser Extensions Tools",
  "Open Source Tools",
]);

// Tagline keyword rejects — catches launches the categories miss.
const TAGLINE_DENY = [
  /\b(buy|shop|store|order)\b/i,
  /\b(book|ebook|course|guide)\s+(on|for|to|about)\b/i,
  /\b(agency|consulting|consultancy|freelancer)\b/i,
  /\b(handmade|handcrafted|artisan)\b/i,
  /\b(apparel|clothing|t-shirt|hoodie|merch)\b/i,
  /\b(NFT|crypto wallet|token sale)\b/i,
  /\btest\b/i,                  // "SBTI Test" — PeerPush has obvious test entries
];

type PeerPushLaunch = {
  id: string;
  slug: string;
  name: string;
  tagline?: string | null;
  description?: string | null;
  websiteUrl: string;
  peerpushUrl?: string;
  publishedAt: string;
  categories?: string[];
  useCases?: string[];
  audiences?: string[];
  community?: { upvotes?: number };
  social?: { twitterUsername?: string; linkedinUrl?: string };
};

type ApiResponse = { data?: PeerPushLaunch[] };

export class PeerPushSource implements LaunchSource {
  kind = "PEERPUSH" as const;

  async fetchSince(date: Date): Promise<RawLaunch[]> {
    const { statusCode, body } = await request(ENDPOINT, {
      method: "GET",
      headers: { accept: "application/json", "user-agent": "ShipBoost-Outreach/1.0" },
      headersTimeout: 10_000,
      bodyTimeout: 10_000,
    });
    if (statusCode !== 200) throw new Error(`PeerPush API ${statusCode}`);
    const payload = (await body.json()) as ApiResponse;
    const items = payload.data ?? [];

    const cutoff = date.getTime();
    const out: RawLaunch[] = [];

    for (const item of items) {
      if (!item.websiteUrl) continue;

      // Date window — only launches inside the requested period.
      const publishedAt = new Date(item.publishedAt);
      if (Number.isNaN(publishedAt.getTime()) || publishedAt.getTime() < cutoff) continue;

      // Category allowlist (at least one match required).
      const cats = item.categories ?? [];
      if (!cats.some((c) => ALLOW_CATEGORIES.has(c))) continue;

      // Tagline/name keyword reject.
      const haystack = `${item.name} ${item.tagline ?? ""}`;
      if (TAGLINE_DENY.some((re) => re.test(haystack))) continue;

      // Clean the website URL: PeerPush appends utm_source=peerpush&ref=peerpush.
      let cleanUrl: string;
      try {
        const u = new URL(item.websiteUrl);
        u.searchParams.delete("ref");
        for (const k of [...u.searchParams.keys()]) {
          if (k.startsWith("utm_")) u.searchParams.delete(k);
        }
        cleanUrl = canonicalizeUrl(u.toString());
      } catch {
        continue;
      }

      // Sanity host filters.
      const host = new URL(cleanUrl).hostname;
      if (host.endsWith("peerpush.net")) continue;
      if (host.endsWith("chrome.google.com")) continue;
      if (host.endsWith("apps.apple.com") || host.endsWith("play.google.com")) continue;

      out.push({
        externalId: item.id,
        name: item.name,
        tagline: item.tagline ?? undefined,
        url: cleanUrl,
        launchedAt: publishedAt,
        votesCount: item.community?.upvotes,
        topics: cats,
        raw: item,
      });
    }

    return out;
  }
}
