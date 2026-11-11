import { request } from "undici";
import { load, type CheerioAPI } from "cheerio";
import type { LaunchSource, RawLaunch } from "./types";
import { cleanExternalUrl, cleanText, isRelevantLaunch } from "./filters";

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/130";
const PAID_LABEL = /^(⭐|★|👑|🔥|💎)?\s*(premium|featured|sponsored|promoted|boosted|premium launch)\s*(⭐|★)?$/i;
const MAX_LAUNCHES = 40;
const PRODUCT_PAGE_CONCURRENCY = 6;

// Hosts that show up on product pages but are never the product's own site.
const NOT_THE_PRODUCT =
  /(^|\.)(x\.com|twitter\.com|linkedin\.com|facebook\.com|instagram\.com|youtube\.com|github\.com|reddit\.com|discord\.(gg|com)|t\.me|bsky\.app|threads\.net|tiktok\.com|chatgpt\.com|openai\.com|claude\.ai|perplexity\.ai|grok\.com|gemini\.google\.com|google\.com|mistral\.ai|brave\.com|ahrefs\.com|stripe\.com|producthunt\.com)$/;

export type HtmlBoardConfig = {
  kind: "THESAASDIR" | "LAUNCHNEST" | "LIFTOFF" | "SAASBISON" | "THELAUNCHDIRECTORY" | "NOONLAUNCH";
  host: string;
  /** Path segment of product pages, e.g. "product" for /product/<slug>. */
  productPath: string;
};

/**
 * Young launch boards (registered 2025–2026) with paid launches on their
 * homepage. They all render server-side: homepage cards link to a product page
 * and carry a Featured/Premium/Sponsored label when paid; the product page
 * links out to the real website. `featured` in raw marks paid launches, the
 * same flag launchPriorityTiers() reads for Nick Launches.
 */
export const HTML_BOARDS: HtmlBoardConfig[] = [
  { kind: "THESAASDIR", host: "thesaasdir.com", productPath: "product" },
  { kind: "LAUNCHNEST", host: "launchnest.io", productPath: "p" },
  { kind: "LIFTOFF", host: "lift-off.sh", productPath: "p" },
  { kind: "SAASBISON", host: "saasbison.com", productPath: "item" },
  { kind: "THELAUNCHDIRECTORY", host: "thelaunchdirectory.com", productPath: "launch" },
  { kind: "NOONLAUNCH", host: "noonlaunch.com", productPath: "product" },
];

type Card = { slug: string; listingUrl: string; name: string; paid: boolean };

export class HtmlBoardSource implements LaunchSource {
  kind: HtmlBoardConfig["kind"];

  constructor(private readonly config: HtmlBoardConfig) {
    this.kind = config.kind;
  }

  async fetchSince(_date: Date): Promise<RawLaunch[]> {
    // Homepage boards only show the current launches, so every daily run reads
    // them all and the (sourceId, externalId) upsert drops ones already stored.
    const homepage = await fetchPage(`https://${this.config.host}/`);
    const cards = readCards(load(homepage), this.config).slice(0, MAX_LAUNCHES);
    const fetchedAt = new Date();

    const out: RawLaunch[] = [];
    let next = 0;
    const worker = async () => {
      while (next < cards.length) {
        const card = cards[next++];
        const listing = await readListing(card.listingUrl, this.config.host).catch(() => null);
        if (!listing?.website) continue;
        const name = listing.name ?? card.name;
        if (!isRelevantLaunch(name, listing.tagline)) continue;
        out.push({
          externalId: `${this.config.host}:${card.slug}`,
          name,
          tagline: listing.tagline,
          url: listing.website,
          launchedAt: fetchedAt,
          raw: { slug: card.slug, listingUrl: card.listingUrl, featured: card.paid },
        });
      }
    };
    await Promise.all(Array.from({ length: PRODUCT_PAGE_CONCURRENCY }, worker));
    return out;
  }
}

export function readCards($: CheerioAPI, config: HtmlBoardConfig): Card[] {
  const productPattern = new RegExp(`^/${config.productPath}/([^/?#]+)/?$`, "i");
  const toSlug = (href: string | undefined) => {
    if (!href) return null;
    try {
      const url = new URL(href, `https://${config.host}/`);
      if (url.hostname.replace(/^www\./, "") !== config.host) return null;
      const match = url.pathname.match(productPattern);
      return match ? { slug: decodeURIComponent(match[1]), listingUrl: `https://${config.host}${url.pathname}` } : null;
    } catch {
      return null;
    }
  };

  // Slugs of cards that carry a paid label: walk up from each label to the
  // nearest ancestor that contains a product link.
  const paidSlugs = new Set<string>();
  $("*")
    .filter((_, el) => $(el).children().length === 0 && PAID_LABEL.test($(el).text().trim()))
    .each((_, el) => {
      let node = $(el);
      for (let depth = 0; depth < 7 && node.length; depth++) {
        const found = node.find(`a[href*="/${config.productPath}/"]`).toArray().map((a) => toSlug($(a).attr("href"))).find(Boolean);
        if (found) {
          paidSlugs.add(found.slug);
          return;
        }
        node = node.parent();
      }
    });

  const cards = new Map<string, Card>();
  $(`a[href*="/${config.productPath}/"]`).each((_, a) => {
    const target = toSlug($(a).attr("href"));
    if (!target) return;
    const text = cleanText($(a).text());
    const existing = cards.get(target.slug);
    // The same card often has an image link and a title link; keep the best name.
    const name = text && text.length <= 80 && !/^(visit|view|details|learn more)/i.test(text) ? text : existing?.name ?? "";
    cards.set(target.slug, { ...target, name: name || existing?.name || target.slug, paid: paidSlugs.has(target.slug) });
  });
  return [...cards.values()];
}

/** The product's own website: the external host linked most often on its listing page. */
export function pickWebsite($: CheerioAPI, boardHost: string): string | null {
  const counts = new Map<string, { count: number; href: string; visitText: boolean }>();
  $("a[href^='http']").each((_, a) => {
    const href = $(a).attr("href") ?? "";
    let host: string;
    try {
      host = new URL(href).hostname.replace(/^www\./, "").toLowerCase();
    } catch {
      return;
    }
    if (host === boardHost || host.endsWith(`.${boardHost}`) || NOT_THE_PRODUCT.test(host)) return;
    const entry = counts.get(host) ?? { count: 0, href, visitText: false };
    entry.count++;
    if (/visit|website|open site|go to/i.test($(a).text())) entry.visitText = true;
    counts.set(host, entry);
  });
  const best = [...counts.values()].sort((a, b) => b.count - a.count || Number(b.visitText) - Number(a.visitText))[0];
  if (!best) return null;
  const url = new URL(best.href);
  url.searchParams.delete("via");
  return cleanExternalUrl(url.toString(), boardHost);
}

/**
 * Website, name and tagline from the product's listing page. Card text is
 * unreliable for names (rank numbers, taglines glued on), so the name comes
 * from the page's <h1>, falling back to og:title before its separator.
 */
export function readListingPage($: CheerioAPI, boardHost: string) {
  const h1 = cleanText($("h1").first().text());
  const ogTitle = cleanText($('meta[property="og:title"]').attr("content") ?? "").split(/\s[|–—-]\s/)[0];
  const name = [h1, ogTitle].find((n) => n && n.length >= 2 && n.length <= 60 && !/^\d+$/.test(n));
  const description = cleanText($('meta[name="description"]').attr("content") ?? "");
  return {
    website: pickWebsite($, boardHost),
    name,
    tagline: description ? description.slice(0, 200) : undefined,
  };
}

async function readListing(listingUrl: string, boardHost: string) {
  return readListingPage(load(await fetchPage(listingUrl)), boardHost);
}

async function fetchPage(url: string): Promise<string> {
  const { statusCode, body } = await request(url, {
    method: "GET",
    headers: { "user-agent": UA, accept: "text/html" },
    headersTimeout: 8_000,
    bodyTimeout: 8_000,
  });
  if (statusCode !== 200) {
    await body.dump();
    throw new Error(`${new URL(url).hostname} ${statusCode}`);
  }
  return body.text();
}
