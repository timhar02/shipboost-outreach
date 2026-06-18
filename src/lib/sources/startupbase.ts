import { request } from "undici";
import { load } from "cheerio";
import type { LaunchSource, RawLaunch } from "./types";
import { cleanExternalUrl, cleanText, isRelevantLaunch } from "./filters";

const HOMEPAGE = "https://startupbase.io/";
const SOURCE_HOST = "startupbase.io";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/130";

export class StartupBaseSource implements LaunchSource {
  kind = "STARTUPBASE" as const;

  async fetchSince(_date: Date): Promise<RawLaunch[]> {
    const html = await fetchPage(HOMEPAGE);
    const $ = load(html);
    const out: RawLaunch[] = [];
    const seenUrls = new Set<string>();

    $("a[href]").each((_, el) => {
      const $link = $(el);
      const href = String($link.attr("href") || "");
      let absolute: URL;
      try {
        absolute = new URL(href, HOMEPAGE);
      } catch {
        return;
      }
      if (absolute.hostname.replace(/^www\./, "") === SOURCE_HOST) return;

      const cleanedUrl = cleanExternalUrl(absolute.toString(), SOURCE_HOST);
      if (!cleanedUrl || seenUrls.has(cleanedUrl)) return;

      const card = $link.closest("article, li, .card, .startup, .product, div");
      const name = cleanText($link.text() || card.find("h2,h3,h4").first().text());
      if (!name || name.length > 90) return;
      const tagline = cleanText(card.find("p").first().text()).slice(0, 200) || undefined;
      if (!isRelevantLaunch(name, tagline)) return;

      seenUrls.add(cleanedUrl);
      out.push({
        externalId: `startupbase:${new URL(cleanedUrl).hostname.replace(/^www\./, "")}`,
        name,
        tagline,
        url: cleanedUrl,
        launchedAt: new Date(),
        raw: { href },
      });
    });

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
  if (statusCode !== 200) throw new Error(`StartupBase ${statusCode}`);
  return body.text();
}
