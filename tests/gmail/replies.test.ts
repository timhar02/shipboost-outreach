import { beforeEach, describe, expect, it, vi } from "vitest";

const gmailFetch = vi.fn();
const emailFindUnique = vi.fn();
const emailFindFirst = vi.fn();
const tx = vi.fn();
const emailCreate = vi.fn((args) => ({ model: "emailMessage", args }));
const eventCreate = vi.fn((args) => ({ model: "outreachEvent", args }));
const draftUpdate = vi.fn((args) => ({ model: "outreachDraft", args }));
const contactUpdate = vi.fn((args) => ({ model: "contact", args }));

vi.mock("@/lib/gmail/client", () => ({ gmailFetch }));
vi.mock("@/server/db/client", () => ({
  prisma: {
    emailMessage: { findUnique: emailFindUnique, findFirst: emailFindFirst, create: emailCreate },
    outreachEvent: { create: eventCreate },
    outreachDraft: { update: draftUpdate },
    contact: { update: contactUpdate },
    $transaction: tx,
  },
}));

describe("pollReplies", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    tx.mockResolvedValue([]);
    emailFindUnique.mockResolvedValue(null);
    emailFindFirst.mockResolvedValue({
      draftId: "draft_1",
      draft: { contactId: "contact_1" },
    });
  });

  it("records delivery failures as bounces and suppresses the contact", async () => {
    gmailFetch
      .mockResolvedValueOnce({ messages: [{ id: "in_1", threadId: "thread_1" }] })
      .mockResolvedValueOnce({
        id: "in_1",
        threadId: "thread_1",
        snippet: "Address not found Your message wasn't delivered.",
        payload: {
          headers: [
            { name: "Subject", value: "Delivery Status Notification (Failure)" },
            { name: "From", value: "Mail Delivery Subsystem <mailer-daemon@googlemail.com>" },
          ],
        },
      });

    const { pollReplies } = await import("@/lib/gmail/replies");
    await expect(pollReplies()).resolves.toEqual({ matched: 0, bounced: 1 });

    expect(eventCreate).toHaveBeenCalledWith({
      data: {
        draftId: "draft_1",
        kind: "BOUNCE",
        payload: {
          gmailMessageId: "in_1",
          gmailThreadId: "thread_1",
          severity: "permanent",
          reason: "address_not_found",
        },
      },
    });
    expect(draftUpdate).toHaveBeenCalledWith({ where: { id: "draft_1" }, data: { status: "BOUNCED" } });
    expect(contactUpdate).toHaveBeenCalledWith({
      where: { id: "contact_1" },
      data: {
        suppressedAt: expect.any(Date),
        suppressionReason: "bounce:address_not_found",
      },
    });
  });

  it("keeps normal replies as replies", async () => {
    gmailFetch
      .mockResolvedValueOnce({ messages: [{ id: "in_2", threadId: "thread_1" }] })
      .mockResolvedValueOnce({
        id: "in_2",
        threadId: "thread_1",
        snippet: "Thanks, this is interesting.",
        payload: {
          headers: [
            { name: "Subject", value: "Re: quick question" },
            { name: "From", value: "founder@example.com" },
          ],
        },
      });

    const { pollReplies } = await import("@/lib/gmail/replies");
    await expect(pollReplies()).resolves.toEqual({ matched: 1, bounced: 0 });
    expect(eventCreate).toHaveBeenCalledWith({
      data: { draftId: "draft_1", kind: "REPLY", payload: { gmailMessageId: "in_2", gmailThreadId: "thread_1" } },
    });
  });
});
