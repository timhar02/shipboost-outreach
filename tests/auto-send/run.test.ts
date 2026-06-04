import { beforeEach, describe, expect, it, vi } from "vitest";

const sendDraft = vi.fn();
const stateUpsert = vi.fn();
const stateUpdate = vi.fn();
const stateFindUnique = vi.fn();
const draftCount = vi.fn();
const draftFindFirst = vi.fn();
const conversionFindMany = vi.fn();

vi.mock("@/lib/gmail/send", () => ({ sendDraft }));

vi.mock("@/server/db/client", () => ({
  prisma: {
    autoSendState: {
      upsert: stateUpsert,
      update: stateUpdate,
      findUnique: stateFindUnique,
    },
    outreachDraft: {
      count: draftCount,
      findFirst: draftFindFirst,
    },
    conversion: {
      findMany: conversionFindMany,
    },
  },
}));

describe("runAutoSend", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.AUTO_SEND_ENABLED = "1";
    process.env.AUTO_SEND_FIRST_DAILY_CAP = "50";
    process.env.AUTO_SEND_FOLLOW_UP_DAILY_CAP = "25";
    process.env.AUTO_SEND_MIN_DELAY_MINUTES = "20";
    process.env.AUTO_SEND_MAX_DELAY_MINUTES = "20";
    process.env.AUTO_SEND_MAX_PER_RUN = "1";
    process.env.FOLLOW_UPS_ENABLED = "1";
    conversionFindMany.mockResolvedValue([]);
    stateUpsert.mockResolvedValue({ nextAllowedAt: null });
    stateUpdate.mockResolvedValue({});
    sendDraft.mockResolvedValue({ gmailMessageId: "msg", gmailThreadId: "thread" });
  });

  it("sends first emails and follow-ups through independent lanes", async () => {
    draftCount.mockImplementation(async ({ where }) => {
      if (where.status === "SENT") return 0;
      if (where.parentDraftId === null) return 3;
      return 5;
    });
    draftFindFirst.mockImplementation(async ({ where }) => {
      if (where.parentDraftId === null) return { id: "first_1" };
      return { id: "follow_1" };
    });
    const { runAutoSend } = await import("@/lib/auto-send/run");

    await expect(runAutoSend(new Date("2026-06-04T00:00:00.000Z"))).resolves.toMatchObject({
      sent: true,
      sentCount: 2,
      draftIds: ["first_1", "follow_1"],
      lanes: {
        first: { sent: true, sentCount: 1, draftIds: ["first_1"], sentToday: 1, dailyCap: 50, pendingDrafts: 3 },
        followUp: { sent: true, sentCount: 1, draftIds: ["follow_1"], sentToday: 1, dailyCap: 25, pendingDrafts: 5 },
      },
    });
    expect(sendDraft).toHaveBeenCalledWith("first_1", { skipDailyCap: true });
    expect(sendDraft).toHaveBeenCalledWith("follow_1", { skipDailyCap: true });
    expect(stateUpdate).toHaveBeenCalledWith({
      where: { id: "first-email" },
      data: {
        lastSentAt: new Date("2026-06-04T00:00:00.000Z"),
        nextAllowedAt: new Date("2026-06-04T00:20:00.000Z"),
      },
    });
    expect(stateUpdate).toHaveBeenCalledWith({
      where: { id: "follow-up" },
      data: {
        lastSentAt: new Date("2026-06-04T00:00:00.000Z"),
        nextAllowedAt: new Date("2026-06-04T00:20:00.000Z"),
      },
    });
  });

  it("does not let follow-up volume consume the first email daily cap", async () => {
    draftCount.mockImplementation(async ({ where }) => {
      if (where.status === "SENT" && where.parentDraftId === null) return 49;
      if (where.status === "SENT") return 25;
      if (where.parentDraftId === null) return 2;
      return 10;
    });
    draftFindFirst.mockResolvedValue({ id: "first_1" });
    const { runAutoSend } = await import("@/lib/auto-send/run");

    await expect(runAutoSend(new Date("2026-06-04T00:00:00.000Z"))).resolves.toMatchObject({
      sent: true,
      sentCount: 1,
      draftIds: ["first_1"],
      lanes: {
        first: { sent: true, sentCount: 1, sentToday: 50, dailyCap: 50 },
        followUp: { sent: false, reason: "daily_cap_reached", sentToday: 25, dailyCap: 25 },
      },
    });
    expect(sendDraft).toHaveBeenCalledTimes(1);
    expect(sendDraft).toHaveBeenCalledWith("first_1", { skipDailyCap: true });
  });

  it("reports lane status separately", async () => {
    stateFindUnique.mockImplementation(async ({ where }) => ({
      id: where.id,
      lastSentAt: new Date("2026-06-03T23:00:00.000Z"),
      nextAllowedAt: where.id === "first-email" ? new Date("2026-06-04T00:00:00.000Z") : new Date("2026-06-04T00:30:00.000Z"),
    }));
    draftCount.mockImplementation(async ({ where }) => {
      if (where.status === "SENT" && where.parentDraftId === null) return 4;
      if (where.status === "SENT") return 6;
      if (where.parentDraftId === null) return 12;
      return 20;
    });
    draftFindFirst.mockResolvedValue({ id: "last", sentAt: new Date("2026-06-04T00:10:00.000Z"), contact: { email: "a@example.com" } });
    const { getAutoSendStatus } = await import("@/lib/auto-send/run");

    await expect(getAutoSendStatus(new Date("2026-06-04T00:10:00.000Z"))).resolves.toMatchObject({
      enabled: true,
      pendingDrafts: 32,
      followUpsEnabled: true,
      lanes: {
        first: { pending: 12, sentToday: 4, dailyCap: 50, due: true },
        followUp: { pending: 20, sentToday: 6, dailyCap: 25, due: false },
      },
    });
  });
});
