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
          if (!db.sources.has(where.kind)) db.sources.set(where.kind, { id: `s_${where.kind}`, ...create });
          return db.sources.get(where.kind)!;
        },
      },
      launch: {
        upsert: async ({ create }: { create: Row & { sourceId: string; externalId: string } }) => {
          const key = `${create.sourceId}:${create.externalId}`;
          if (db.launches.has(key)) return db.launches.get(key)!;
          const row = { id: `l_${db.launches.size}`, ...create };
          db.launches.set(key, row); return row;
        },
      },
      contact: {
        findUnique: async ({ where }: { where: { email?: string; domain?: string } }) =>
          (where.email && db.contactsByEmail.get(where.email)) ||
          (where.domain && db.contactsByDomain.get(where.domain)) ||
          null,
        create: async ({ data }: { data: Row & { email: string; domain: string } }) => {
          const row = { id: `c_${db.contactsByEmail.size}`, ...data };
          db.contactsByEmail.set(data.email, row);
          db.contactsByDomain.set(data.domain, row);
          return row;
        },
      },
      outreachDraft: {
        create: async ({ data }: { data: Row }) => { const row = { id: `d_${db.drafts.length}`, ...data }; db.drafts.push(row); return row; },
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
  it("creates one draft on first run, zero on second (domain dedup)", async () => {
    const r1 = await runFetchAndQueue();
    expect(r1.draftsCreated).toBe(1);
    expect(db.drafts).toHaveLength(1);

    const r2 = await runFetchAndQueue();
    expect(r2.draftsCreated).toBe(0);
    expect(db.drafts).toHaveLength(1);
  });
});
