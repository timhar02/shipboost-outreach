import { describe, it, expect, vi, beforeEach } from "vitest";

const { requestMock } = vi.hoisted(() => ({ requestMock: vi.fn() }));

// filters.ts imports fetch-html, which builds an undici Agent at load time.
vi.mock("undici", () => ({
  request: requestMock,
  Agent: class {
    compose() { return this; }
  },
  interceptors: { redirect: () => (d: unknown) => d },
}));

import { isoWeekOf, isoWeeksSince } from "@/lib/sources/filters";
import { ScrollLaunchSource } from "@/lib/sources/scrolllaunch";
import { NickLaunchesSource } from "@/lib/sources/nick-launches";

function respond(payload: unknown, statusCode = 200) {
  return { statusCode, body: { json: async () => payload, dump: async () => {} } };
}

beforeEach(() => requestMock.mockReset());

describe("isoWeekOf / isoWeeksSince", () => {
  it("uses Monday-start ISO weeks, including year boundaries", () => {
    expect(isoWeekOf(new Date("2026-11-07T12:00:00Z"))).toMatchObject({ year: 2026, week: 45 });
    expect(isoWeekOf(new Date("2026-11-07T12:00:00Z")).startsOn.toISOString()).toBe("2026-11-02T00:00:00.000Z");
    // 2027-01-01 is a Friday, so it belongs to the last week of 2026.
    expect(isoWeekOf(new Date("2027-01-01T00:00:00Z"))).toMatchObject({ year: 2026, week: 53 });
  });

  it("returns both boards when a 24h window crosses Monday", () => {
    const weeks = isoWeeksSince(new Date("2026-11-08T10:00:00Z"), new Date("2026-11-09T10:00:00Z"));
    expect(weeks.map((w) => `${w.year}-${w.week}`)).toEqual(["2026-45", "2026-46"]);
  });
});

describe("ScrollLaunchSource", () => {
  it("reads the weekly leaderboard, cleans URLs and keeps the premium flag", async () => {
    requestMock.mockResolvedValue(
      respond({
        week: "2026-W45",
        products: [
          {
            name: "Notelify",
            slug: "notelify-1",
            url: "https://www.scrolllaunch.com/products/notelify-1",
            tagline: "AI study workspace",
            website: "https://www.notelifyapp.com/?ref=scrolllaunch&utm_source=scrolllaunch",
            categories: ["Productivity", "AI"],
            upvotes: 42,
            premiumListing: true,
          },
          { name: "Self link", slug: "self", url: "", website: "https://www.scrolllaunch.com/x" },
          { name: "Merch drop", slug: "merch", url: "", tagline: "Hoodie store", website: "https://merch.example" },
        ],
      }),
    );

    const out = await new ScrollLaunchSource().fetchSince(new Date(Date.now() - 864e5));

    expect(requestMock.mock.calls[0][0]).toMatch(/\/v1\/leaderboard\?week=\d{4}-W\d{2}&limit=100$/);
    const notelify = out.find((l) => l.externalId === "scrolllaunch:notelify-1");
    expect(notelify).toMatchObject({ name: "Notelify", url: "https://www.notelifyapp.com/", votesCount: 42 });
    expect((notelify?.raw as { premiumListing: boolean }).premiumListing).toBe(true);
    expect(out.some((l) => l.externalId === "scrolllaunch:self")).toBe(false);
    expect(out.some((l) => l.externalId === "scrolllaunch:merch")).toBe(false);
  });

  it("throws on a non-200 so the pipeline records a source error", async () => {
    requestMock.mockResolvedValue(respond({}, 429));
    await expect(new ScrollLaunchSource().fetchSince(new Date())).rejects.toThrow("ScrollLaunch API 429");
  });
});

describe("NickLaunchesSource", () => {
  it("reads the weekly feed, strips UTM params and keeps the featured flag", async () => {
    requestMock.mockResolvedValue(
      respond({
        items: [
          {
            slug: "plimo",
            name: "Plimo",
            tagline: "Turn notes into plans",
            url: "https://plimo.ai/?utm_source=nicklaunches&utm_medium=directory",
            categories: ["AI"],
            upvotes: 14,
            launchDate: "2026-11-02T00:00:00.000Z",
            productUrl: "https://nicklaunches.com/products/plimo/",
            featured: true,
          },
          { slug: "repo", name: "Repo", url: "https://github.com/a/b" },
        ],
      }),
    );

    const out = await new NickLaunchesSource().fetchSince(new Date(Date.now() - 864e5));

    expect(requestMock.mock.calls[0][0]).toMatch(/\/api\/v1\/feed\/week\/\?year=\d{4}&week=\d+$/);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ externalId: "nick-launches:plimo", url: "https://plimo.ai/", votesCount: 14 });
    expect(out[0].launchedAt.toISOString()).toBe("2026-11-02T00:00:00.000Z");
    expect((out[0].raw as { featured: boolean }).featured).toBe(true);
  });
});

describe("ScrollLaunch maker name", () => {
  it("keeps a real first name and drops handles, product names and placeholders", async () => {
    const { personFirstName } = await import("@/lib/sources/scrolllaunch");
    expect(personFirstName("Ketan Patil", "Notelify")).toBe("Ketan");
    expect(personFirstName("José", "Foo")).toBe("José");
    expect(personFirstName("moon", "Plimo")).toBeUndefined();
    expect(personFirstName("Notelify", "Notelify")).toBeUndefined();
    expect(personFirstName("Unknown", "Foo")).toBeUndefined();
    expect(personFirstName("@ketan", "Foo")).toBeUndefined();
    expect(personFirstName(null, "Foo")).toBeUndefined();
  });

  it("reads makerName from the product endpoint", async () => {
    requestMock.mockResolvedValue(respond({ makerName: "Ketan Patil" }));
    const { fetchScrollLaunchMakerFirstName } = await import("@/lib/sources/scrolllaunch");
    await expect(fetchScrollLaunchMakerFirstName("notelify-1", "Notelify")).resolves.toBe("Ketan");
    expect(requestMock.mock.calls[0][0]).toBe("https://www.scrolllaunch.com/v1/products/notelify-1");
  });
});
