import { describe, it, expect, vi, beforeEach } from "vitest";
import { load } from "cheerio";

const { requestMock } = vi.hoisted(() => ({ requestMock: vi.fn() }));

// filters.ts imports fetch-html, which builds an undici Agent at load time.
vi.mock("undici", () => ({
  request: requestMock,
  Agent: class {
    compose() { return this; }
  },
  interceptors: { redirect: () => (d: unknown) => d },
}));

import { HtmlBoardSource, pickWebsite, readCards, readListingPage } from "@/lib/sources/html-boards";

const config = { kind: "LAUNCHNEST" as const, host: "launchnest.io", productPath: "p" };

const HOMEPAGE = `
  <section>
    <div class="card"><span>Featured</span><a href="/p/riseme"><img alt=""></a><a href="/p/riseme">RiseMe</a></div>
    <div class="card"><a href="https://launchnest.io/p/bike-size-charts">2 Bike Size Charts 14</a></div>
    <div class="card"><a href="/category/ai">AI</a></div>
  </section>`;

const LISTING = (website: string) => `
  <html><head>
    <meta property="og:title" content="RiseMe | LaunchNest">
    <meta name="description" content="Daily habits that stick">
  </head><body>
    <h1>RiseMe</h1>
    <a href="https://x.com/launchnest">X</a>
    <a href="https://launchdirectories.com/">Visit LaunchDirectories</a>
    <a href="${website}">Visit Site</a>
    <a href="${website.replace(/\/\?.*$/, "")}/pricing">Pricing</a>
    <a href="https://chatgpt.com/?q=about">Ask ChatGPT</a>
  </body></html>`;

function respond(html: string, statusCode = 200) {
  return { statusCode, body: { text: async () => html, dump: async () => {} } };
}

beforeEach(() => {
  requestMock.mockReset();
});

describe("readCards", () => {
  it("finds product cards and marks the ones with a paid label", () => {
    const cards = readCards(load(HOMEPAGE), config);
    expect(cards.map((c) => [c.slug, c.paid])).toEqual([
      ["riseme", true],
      ["bike-size-charts", false],
    ]);
    expect(cards[0]).toMatchObject({ name: "RiseMe", listingUrl: "https://launchnest.io/p/riseme" });
  });
});

describe("pickWebsite / readListingPage", () => {
  it("picks the external host linked most often, not ads, socials or AI links", () => {
    const $ = load(LISTING("https://riseme.ai/?ref=launchnest&via=launchnest"));
    expect(pickWebsite($, "launchnest.io")).toBe("https://riseme.ai/");
  });

  it("takes the name from <h1> and the tagline from the meta description", () => {
    const listing = readListingPage(load(LISTING("https://riseme.ai/")), "launchnest.io");
    expect(listing).toMatchObject({ name: "RiseMe", tagline: "Daily habits that stick", website: "https://riseme.ai/" });
  });
});

describe("HtmlBoardSource", () => {
  it("reads the homepage, then each listing page, and keeps the paid flag", async () => {
    requestMock.mockImplementation(async (url: string) => {
      if (url === "https://launchnest.io/") return respond(HOMEPAGE);
      if (url.endsWith("/p/riseme")) return respond(LISTING("https://riseme.ai/"));
      if (url.endsWith("/p/bike-size-charts")) return respond(LISTING("https://bikesizecharts.com/").replace(/RiseMe/g, "Bike Size Charts"));
      return respond("", 404);
    });

    const out = await new HtmlBoardSource(config).fetchSince(new Date());

    expect(out.map((l) => [l.externalId, l.name, l.url, (l.raw as { featured: boolean }).featured]).sort()).toEqual([
      ["launchnest.io:bike-size-charts", "Bike Size Charts", "https://bikesizecharts.com/", false],
      ["launchnest.io:riseme", "RiseMe", "https://riseme.ai/", true],
    ]);
  });

  it("throws when the homepage fails so the pipeline records a source error", async () => {
    requestMock.mockResolvedValue(respond("", 503));
    await expect(new HtmlBoardSource(config).fetchSince(new Date())).rejects.toThrow("launchnest.io 503");
  });
});
