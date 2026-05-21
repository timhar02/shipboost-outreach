import { load } from "cheerio";
import { fetchHtml } from "./fetch-html";

/**
 * Pulls a small bundle of product positioning text from a website so the LLM
 * has something real to reference. Keep this *short* — we don't want to bloat
 * the LLM prompt or leak the founder's whole landing page.
 */
export type ProductContext = {
  /** First H1, trimmed. Usually the hero positioning line. */
  h1?: string;
  /** Hero subhead or first long paragraph beneath the H1. */
  heroText?: string;
  /** Up to 5 H2/H3 headings (feature/section headers). */
  features?: string[];
  /** First paragraph from /about page, if reachable. */
  aboutBlurb?: string;
};

const MAX_LEN = 280;

function clamp(s: string | undefined, n = MAX_LEN): string | undefined {
  if (!s) return undefined;
  const cleaned = s.replace(/\s+/g, " ").trim();
  if (!cleaned) return undefined;
  return cleaned.length > n ? cleaned.slice(0, n - 1) + "…" : cleaned;
}

export async function extractContext(siteUrl: string): Promise<ProductContext> {
  const ctx: ProductContext = {};

  const homepage = await fetchHtml(siteUrl);
  if (homepage) {
    const $ = load(homepage);

    ctx.h1 = clamp($("h1").first().text());

    // Pick the first non-trivial paragraph or meta description.
    const ogDesc = $('meta[property="og:description"]').attr("content");
    const metaDesc = $('meta[name="description"]').attr("content");
    let hero = ogDesc || metaDesc || "";
    if (!hero) {
      $("p").each((_, el) => {
        if (hero) return;
        const txt = $(el).text().trim();
        if (txt.length >= 40) hero = txt;
      });
    }
    ctx.heroText = clamp(hero);

    const features: string[] = [];
    $("h2, h3").each((_, el) => {
      if (features.length >= 5) return;
      const t = $(el).text().trim();
      if (t && t.length <= 80 && !/cookie|subscribe|privacy/i.test(t)) {
        features.push(t.replace(/\s+/g, " "));
      }
    });
    if (features.length) ctx.features = features;
  }

  // Try /about for the founder voice
  try {
    const aboutUrl = new URL("/about", siteUrl).toString();
    const aboutHtml = await fetchHtml(aboutUrl);
    if (aboutHtml) {
      const $a = load(aboutHtml);
      let first = "";
      $a("p").each((_, el) => {
        if (first) return;
        const txt = $a(el).text().trim();
        if (txt.length >= 60) first = txt;
      });
      ctx.aboutBlurb = clamp(first);
    }
  } catch {
    /* /about not reachable, no problem */
  }

  return ctx;
}
