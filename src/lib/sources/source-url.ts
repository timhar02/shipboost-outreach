import type { SourceKind } from "@prisma/client";

/**
 * Build the canonical "source listing" URL for a launch, so the reviewer
 * can click through to where we found it.
 *
 * Returns null if we can't derive a URL (e.g. raw JSON is missing the field).
 */
export function sourceUrl(
  kind: SourceKind,
  externalId: string,
  raw: unknown,
): string | null {
  const r = raw as Record<string, unknown> | null;

  switch (kind) {
    case "PEERPUSH": {
      // PeerPush API returns peerpushUrl directly.
      if (r && typeof r.peerpushUrl === "string") return r.peerpushUrl;
      if (r && typeof r.slug === "string") return `https://peerpush.net/p/${r.slug}`;
      return null;
    }
    case "HACKER_NEWS":
      return `https://news.ycombinator.com/item?id=${externalId}`;
    case "BETALIST": {
      const slug = externalId.startsWith("betalist:") ? externalId.slice("betalist:".length) : externalId;
      return `https://betalist.com/startups/${slug}`;
    }
    case "UNEED": {
      const slug = externalId.startsWith("uneed:") ? externalId.slice("uneed:".length) : externalId;
      return `https://www.uneed.best/tool/${slug}`;
    }
    case "PRODUCT_HUNT":
      // PH stores the post node — its `url` is the PH post URL.
      if (r && typeof r.url === "string" && r.url.includes("producthunt.com")) return r.url;
      return null;
    case "FOUNDRLIST":
    case "PEERLIST":
    case "SCROLLLAUNCH":
      return null;
  }
}

/**
 * Friendly display name for a source — used as the link text.
 */
export function sourceLabel(kind: SourceKind): string {
  switch (kind) {
    case "PRODUCT_HUNT": return "Product Hunt";
    case "PEERPUSH": return "PeerPush";
    case "PEERLIST": return "PeerList";
    case "UNEED": return "Uneed";
    case "FOUNDRLIST": return "Foundrlist";
    case "SCROLLLAUNCH": return "ScrollLaunch";
    case "HACKER_NEWS": return "Hacker News";
    case "BETALIST": return "BetaList";
  }
}
