import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/sources/peerpush", () => ({
  PeerPushSource: class {
    kind = "PEERPUSH" as const;
    async fetchSince() {
      return [{
        externalId: "p1", name: "Wavefly", tagline: "quiet launches",
        url: "https://trywavefly.com/", launchedAt: new Date("2026-05-19T16:00:00Z"),
        votesCount: 12, topics: ["SaaS Tools"], raw: {},
      }];
    }
  },
}));

vi.mock("@/lib/sources/hacker-news", () => ({
  HackerNewsSource: class {
    kind = "HACKER_NEWS" as const;
    async fetchSince() { return []; }
  },
}));

vi.mock("@/lib/sources/betalist", () => ({
  BetaListSource: class {
    kind = "BETALIST" as const;
    async fetchSince() { return []; }
  },
}));

vi.mock("@/lib/scrape/extract-email", () => ({
  extractEmail: vi.fn().mockResolvedValue({ email: "sarah@trywavefly.com", name: "Sarah", source: "ABOUT_PAGE" }),
}));

vi.mock("@/lib/scrape/fetch-html", () => ({ jitter: async () => {} }));

type Row = Record<string, unknown> & { id: string };
const db = {
  contactsByEmail: new Map<string, Row>(),
  contactsByDomain: new Map<string, Row>(),
  drafts: [] as Row[],
  launches: new Map<string, Row>(),
  sources: new Map<string, Row>(),
};

vi.mock("@/server/db/client", () => {
  return {
    prisma: {
      source: {
        upsert: async ({ where, create }: { where: { kind: string }; create: Row }) => {
          if (!db.sources.has(where.kind)) db.sources.set(where.kind, { ...create, id: `s_${where.kind}` });
          return db.sources.get(where.kind)!;
        },
      },
      launch: {
        upsert: async ({ create }: { create: Row & { sourceId: string; externalId: string } }) => {
          const key = `${create.sourceId}:${create.externalId}`;
          if (db.launches.has(key)) return db.launches.get(key)!;
          const row = { ...create, id: `l_${db.launches.size}` };
          db.launches.set(key, row); return row;
        },
      },
      contact: {
        findUnique: async ({ where }: { where: { email?: string; domain?: string } }) =>
          (where.email && db.contactsByEmail.get(where.email)) ||
          (where.domain && db.contactsByDomain.get(where.domain)) ||
          null,
        create: async ({ data }: { data: Row & { email: string; domain: string } }) => {
          const row = { ...data, id: `c_${db.contactsByEmail.size}` };
          db.contactsByEmail.set(data.email, row);
          db.contactsByDomain.set(data.domain, row);
          return row;
        },
      },
      outreachDraft: {
        create: async ({ data }: { data: Row }) => { const row = { ...data, id: `d_${db.drafts.length}` }; db.drafts.push(row); return row; },
        count: async () => db.drafts.length,
      },
    },
  };
});

beforeEach(() => {
  db.contactsByEmail.clear(); db.contactsByDomain.clear();
  db.drafts.length = 0; db.launches.clear(); db.sources.clear();
});

import { runFetchAndQueue } from "@/lib/pipeline/fetch-and-queue";

describe("runFetchAndQueue", () => {
  it("persists Launch rows once (idempotent on second run)", async () => {
    const r1 = await runFetchAndQueue();
    expect(r1.launchesStored).toBe(1);
    expect(db.launches.size).toBe(1);

    // Second run upserts the same Launch row, so DB still has 1.
    await runFetchAndQueue();
    expect(db.launches.size).toBe(1);
  });
});
