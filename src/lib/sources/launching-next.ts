import { request } from "undici";
import { load } from "cheerio";
import type { LaunchSource, RawLaunch } from "./types";
import { cleanExternalUrl, cleanText, isRelevantLaunch } from "./filters";

const PAGES = ["https://www.launchingnext.com/", "https://www.launchingnext.com/startups/"];
const SOURCE_HOST = "launchingnext.com";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/130";

export class LaunchingNextSource implements LaunchSource {
  kind = "LAUNCHING_NEXT" as const;

  async fetchSince(_date: Date): Promise<RawLaunch[]> {
    const out: RawLaunch[] = [];
    const seen = new Set<string>();

    for (const pageUrl of PAGES) {
      const html = await fetchPage(pageUrl);
      const $ = load(html);
      $("a[href^='http']").each((_, el) => {
        const href = String($(el).attr("href") || "");
        const cleanedUrl = cleanExternalUrl(href, SOURCE_HOST);
        if (!cleanedUrl || seen.has(cleanedUrl)) return;
        const card = $(el).closest("article, li, .startup, .post, .card, div");
        const name = cleanText($(el).text() || card.find("h2,h3,h4").first().text());
        if (!name || name.length > 90) return;
        const tagline = cleanText(card.find("p").first().text()).slice(0, 200) || undefined;
        if (!isRelevantLaunch(name, tagline)) return;
        seen.add(cleanedUrl);
        out.push({
          externalId: `launching-next:${new URL(cleanedUrl).hostname.replace(/^www\./, "")}`,
          name,
          tagline,
          url: cleanedUrl,
          launchedAt: new Date(),
          raw: { href, pageUrl },
        });
      });
    }

    return out.slice(0, 80);
  }
}

async function fetchPage(url: string): Promise<string> {
  const { statusCode, body } = await request(url, {
    method: "GET",
    headers: { "user-agent": UA, accept: "text/html" },
    headersTimeout: 10_000,
    bodyTimeout: 10_000,
  });
  if (statusCode !== 200) throw new Error(`Launching Next ${statusCode}`);
  return body.text();
}
