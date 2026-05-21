import { request } from "undici";
import { load } from "cheerio";
import { canonicalizeUrl } from "@/lib/scrape/fetch-html";
import type { LaunchSource, RawLaunch } from "./types";

const HOMEPAGE = "https://betalist.com/";
const VISIT_URL = (slug: string) =>
  `https://betalist.com/startups/${slug}/visit`;
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/130";

// Number of homepage pagination pages to scrape. ~54 startups per page.
// Page 1 = most recent. Higher pages = older.
const PAGES = 2;

// Tagline reject (same shape as other adapters).
const TAGLINE_DENY = [
  /\b(buy|shop|store|order)\b/i,
  /\b(book|ebook|course|guide|template|kit)\s+(on|for|to)\b/i,
  /\bnewsletter\b/i,
  /\b(agency|consulting|consultancy|freelancer)\b/i,
  /\b(handmade|handcrafted|artisan)\b/i,
  /\b(apparel|clothing|t-shirt|hoodie|merch)\b/i,
  /\btest\b/i,
];

type CardRaw = { slug: string; name: string; tagline: string };

export class BetaListSource implements LaunchSource {
  kind = "BETALIST" as const;

  async fetchSince(_date: Date): Promise<RawLaunch[]> {
    const cards: CardRaw[] = [];
    for (let page = 1; page <= PAGES; page++) {
      const url = page === 1 ? HOMEPAGE : `${HOMEPAGE}?page=${page}`;
      try {
        const pageCards = await fetchCardsFromPage(url);
        cards.push(...pageCards);
      } catch {
        break;
      }
    }

    // Dedupe slugs across pages.
    const seen = new Set<string>();
    const unique = cards.filter((c) => {
      if (seen.has(c.slug)) return false;
      seen.add(c.slug);
      return true;
    });

    const out: RawLaunch[] = [];
    for (const card of unique) {
      const haystack = `${card.name} ${card.tagline}`;
      if (TAGLINE_DENY.some((re) => re.test(haystack))) continue;

      const realUrl = await resolveVisit(card.slug);
      if (!realUrl) continue;

      let cleanedUrl: string;
      try {
        const u = new URL(realUrl);
        u.searchParams.delete("ref");
        for (const k of [...u.searchParams.keys()]) {
          if (k.startsWith("utm_")) u.searchParams.delete(k);
        }
        cleanedUrl = canonicalizeUrl(u.toString());
      } catch {
        continue;
      }

      const host = new URL(cleanedUrl).hostname;
      if (host.endsWith("betalist.com")) continue;
      if (host.endsWith("chrome.google.com") || host.endsWith("apps.apple.com") || host.endsWith("play.google.com")) continue;

      out.push({
        externalId: `betalist:${card.slug}`,
        name: card.name,
        tagline: card.tagline || undefined,
        url: cleanedUrl,
        launchedAt: new Date(),
        raw: card,
      });
    }

    return out;
  }
}

async function fetchCardsFromPage(url: string): Promise<CardRaw[]> {
  const { statusCode, body } = await request(url, {
    method: "GET",
    headers: { "user-agent": UA, accept: "text/html" },
    headersTimeout: 10_000,
    bodyTimeout: 10_000,
  });
  if (statusCode !== 200) return [];
  const html = await body.text();
  const $ = load(html);
  const cards: CardRaw[] = [];

  // BetaList renders two distinct card shapes:
  //
  // FEATURED ("today" section):
  //   <a class="" href="/startups/<slug>">
  //     <div class="font-medium ...">Name</div>
  //   </a>
  //   <div class="text-gray-600 ...">Tagline</div>
  //
  // ROW (the bulk listing):
  //   <div class="... startup-row">
  //     <a class="absolute inset-0" href="/startups/<slug>"></a>
  //     ...
  //     <span class="... font-medium ...">Name</span>
  //     <span class="... text-gray-500 ...">Tagline</span>
  //   </div>
  //
  // Strategy: iterate every startup anchor, derive slug, then look for name
  // first inside the anchor (featured) and, failing that, inside the closest
  // `.startup-row` ancestor (row card).
  const seenSlugs = new Set<string>();
  $('a[href^="/startups/"]').each((_, el) => {
    const $el = $(el);
    const href = $el.attr("href") || "";
    const m = href.match(/^\/startups\/([^/?#]+)$/);
    if (!m) return;
    const slug = m[1];
    if (seenSlugs.has(slug)) return;

    // Try featured card pattern first.
    let name = cleanName($el.find("div.font-medium").first().text());
    let tagline = "";
    if (name) {
      tagline = $el.parent().find("div.text-gray-600").first().text().trim();
    } else {
      // Row card pattern: walk up to the startup-row container.
      const $row = $el.closest(".startup-row");
      if ($row.length) {
        name = cleanName($row.find("span.font-medium").first().text());
        // Tagline is the next text-gray-500 (or text-gray-400 in dark mode classes).
        tagline = $row.find("span.text-gray-500, span.text-gray-600").first().text().trim();
      }
    }

    if (!name) return;
    seenSlugs.add(slug);
    cards.push({ slug, name, tagline });
  });

  return cards;
}

// BetaList appends badges like "BOOSTED" / "FEATURED" inside the name element.
// Strip trailing whitespace then any all-caps badge word.
function cleanName(raw: string): string {
  return raw
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\s+(BOOSTED|FEATURED|SPONSORED|TODAY|NEW)$/i, "")
    .trim();
}

async function resolveVisit(slug: string): Promise<string | null> {
  try {
    // undici default: do NOT follow redirects (no redirect interceptor) —
    // we want the raw Location header from the 301.
    const { statusCode, headers } = await request(VISIT_URL(slug), {
      method: "GET",
      headers: { "user-agent": UA },
      headersTimeout: 5_000,
      bodyTimeout: 5_000,
    });
    if (statusCode < 300 || statusCode >= 400) return null;
    const loc = headers["location"];
    const target = Array.isArray(loc) ? loc[0] : loc;
    return target || null;
  } catch {
    return null;
  }
}
