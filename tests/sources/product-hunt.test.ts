import { describe, it, expect, vi, beforeEach } from "vitest";

const fixture = {
  data: {
    posts: {
      edges: [
        {
          node: {
            id: "post_1", name: "Wavefly", tagline: "Quiet launches for serious SaaS",
            url: "https://www.producthunt.com/posts/wavefly",
            website: "https://trywavefly.com?ref=producthunt",
            votesCount: 42, createdAt: "2026-05-19T16:01:00Z",
            topics: { edges: [{ node: { slug: "saas" } }, { node: { slug: "developer-tools" } }] },
          },
        },
        {
          node: {
            id: "post_2", name: "ExtensionThing", tagline: "Chrome extension",
            url: "https://www.producthunt.com/posts/extensionthing",
            website: "https://chrome.google.com/webstore/x",
            votesCount: 3, createdAt: "2026-05-19T16:00:00Z",
            topics: { edges: [{ node: { slug: "chrome-extensions" } }] },
          },
        },
      ],
    },
  },
};

vi.mock("undici", () => ({
  request: vi.fn().mockResolvedValue({
    statusCode: 200, body: { json: async () => fixture },
  }),
  Agent: class {
    compose() { return this; }
  },
  interceptors: {
    redirect: () => (d: unknown) => d,
  },
}));

import { ProductHuntSource } from "@/lib/sources/product-hunt";

beforeEach(() => { process.env.PRODUCT_HUNT_TOKEN = "test"; });

describe("ProductHuntSource", () => {
  it("filters extensions/low-votes and normalizes URLs", async () => {
    const src = new ProductHuntSource();
    const out = await src.fetchSince(new Date("2026-05-18T00:00:00Z"));
    expect(out).toHaveLength(1);
    expect(out[0].externalId).toBe("post_1");
    expect(out[0].name).toBe("Wavefly");
    expect(out[0].url).toBe("https://trywavefly.com/");
    expect(out[0].votesCount).toBe(42);
    expect(out[0].topics).toContain("saas");
  });
});
