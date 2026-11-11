import { beforeEach, describe, expect, it, vi } from "vitest";

const gmailFetch = vi.fn();
const listConnectedGmailAccounts = vi.fn();
const draftCount = vi.fn(async (_args?: { where: { OR?: Array<{ senderEmail: string | null }> } }) => 0);
const validateRecipientEmail = vi.fn();
const tx = vi.fn();
const draftUpdate = vi.fn();
const contactUpdate = vi.fn();
const messageCreate = vi.fn();
const findUniqueOrThrow = vi.fn();

const draft = {
  id: "draft_1",
  contactId: "contact_1",
  status: "PENDING_REVIEW",
  subject: "Quick note",
  body: "<p>Hello</p>",
  bodyText: "Hello",
  contact: { id: "contact_1", email: "founder@example.com", suppressedAt: null, suppressionReason: null },
  parentDraft: null,
};

vi.mock("@/lib/gmail/client", () => ({
  gmailFetch,
  listConnectedGmailAccounts,
}));

vi.mock("@/lib/email/validation", () => ({ validateRecipientEmail }));

vi.mock("@/server/db/client", () => ({
  prisma: {
    outreachDraft: {
      findUniqueOrThrow,
      count: draftCount,
      update: draftUpdate,
    },
    emailMessage: {
      create: messageCreate,
    },
    contact: {
      update: contactUpdate,
    },
    $transaction: tx,
  },
}));

describe("sendDraft", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.SENDER_EMAIL = "tim.personal@gmail.com";
    delete process.env.SENDER_EMAILS;
    delete process.env.AUTO_SEND_PER_SENDER_DAILY_CAP;
    draftCount.mockResolvedValue(0);
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    findUniqueOrThrow.mockResolvedValue(draft);
    listConnectedGmailAccounts.mockResolvedValue(["tim.personal@gmail.com"]);
    validateRecipientEmail.mockResolvedValue({ ok: true, source: "mx" });
    gmailFetch.mockResolvedValue({ id: "gmail_msg_1", threadId: "gmail_thread_1" });
  });

  it("throws without a connected Gmail account before marking the draft failed", async () => {
    listConnectedGmailAccounts.mockResolvedValue([]);
    const { sendDraft } = await import("@/lib/gmail/send");

    await expect(sendDraft("draft_1")).rejects.toThrow("No Gmail credential");
    expect(draftUpdate).not.toHaveBeenCalledWith({ where: { id: "draft_1" }, data: { status: "FAILED" } });
  });

  it("throws when the configured sender isn't connected, before marking the draft failed", async () => {
    listConnectedGmailAccounts.mockResolvedValue(["other@gmail.com"]);
    const { sendDraft } = await import("@/lib/gmail/send");

    await expect(sendDraft("draft_1")).rejects.toThrow("No Gmail credential");
    expect(gmailFetch).not.toHaveBeenCalled();
    expect(draftUpdate).not.toHaveBeenCalledWith({ where: { id: "draft_1" }, data: { status: "FAILED" } });
  });

  it("throws before Gmail send when the contact is suppressed", async () => {
    findUniqueOrThrow.mockResolvedValue({
      ...draft,
      contact: {
        ...draft.contact,
        suppressedAt: new Date("2026-06-14T00:00:00.000Z"),
        suppressionReason: "bounce:address_not_found",
      },
    });
    const { sendDraft } = await import("@/lib/gmail/send");

    await expect(sendDraft("draft_1")).rejects.toThrow("recipient suppressed: bounce:address_not_found");
    expect(gmailFetch).not.toHaveBeenCalled();
  });

  it("marks invalid recipients failed and suppresses contact before Gmail send", async () => {
    validateRecipientEmail.mockResolvedValue({ ok: false, source: "mx", reason: "no_mx" });
    const { sendDraft } = await import("@/lib/gmail/send");

    await expect(sendDraft("draft_1")).rejects.toThrow("recipient validation failed: no_mx");
    expect(gmailFetch).not.toHaveBeenCalled();
    expect(draftUpdate).toHaveBeenCalledWith({ where: { id: "draft_1" }, data: { status: "FAILED" } });
    expect(contactUpdate).toHaveBeenCalledWith({
      where: { id: "contact_1" },
      data: {
        suppressedAt: expect.any(Date),
        suppressionReason: "validation:no_mx",
      },
    });
    expect(tx).toHaveBeenCalled();
  });

  it("sends through Gmail and stores message and thread ids", async () => {
    tx.mockResolvedValue(undefined);
    const { sendDraft } = await import("@/lib/gmail/send");

    await expect(sendDraft("draft_1")).resolves.toEqual({
      gmailMessageId: "gmail_msg_1",
      gmailThreadId: "gmail_thread_1",
    });

    expect(gmailFetch).toHaveBeenCalledWith(
      "/users/me/messages/send",
      { method: "POST", body: { raw: expect.any(String) } },
      "tim.personal@gmail.com",
    );
    expect(draftUpdate).toHaveBeenCalledWith({
      where: { id: "draft_1" },
      data: { status: "SENT", sentAt: expect.any(Date), senderEmail: "tim.personal@gmail.com" },
    });
    expect(messageCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        draftId: "draft_1",
        providerMessageId: "gmail_msg_1",
        providerThreadId: "gmail_thread_1",
        direction: "OUT",
      }),
    });
  });

  it("rotates first emails to the connected sender with the fewest sends today", async () => {
    tx.mockResolvedValue(undefined);
    process.env.SENDER_EMAILS = "tim.personal@gmail.com,second@gmail.com,third@gmail.com";
    listConnectedGmailAccounts.mockResolvedValue(["tim.personal@gmail.com", "second@gmail.com", "third@gmail.com"]);
    const sentToday: Record<string, number> = { "tim.personal@gmail.com": 9, "second@gmail.com": 4, "third@gmail.com": 6 };
    draftCount.mockImplementation(async (args) => sentToday[args?.where.OR?.find((o) => o.senderEmail)?.senderEmail ?? ""] ?? 0);
    const { sendDraft } = await import("@/lib/gmail/send");

    await sendDraft("draft_1", { skipDailyCap: true });

    expect(gmailFetch).toHaveBeenCalledWith("/users/me/messages/send", expect.anything(), "second@gmail.com");
  });

  it("stops with NoSenderCapacityError when every sender is at its daily cap", async () => {
    process.env.AUTO_SEND_PER_SENDER_DAILY_CAP = "5";
    draftCount.mockResolvedValue(5);
    const { sendDraft } = await import("@/lib/gmail/send");
    const { NoSenderCapacityError } = await import("@/lib/gmail/senders");

    await expect(sendDraft("draft_1", { skipDailyCap: true })).rejects.toBeInstanceOf(NoSenderCapacityError);
    expect(gmailFetch).not.toHaveBeenCalled();
  });

  it("sends follow-ups in the original Gmail thread with reply headers", async () => {
    tx.mockResolvedValue(undefined);
    findUniqueOrThrow.mockResolvedValue({
      ...draft,
      id: "followup_1",
      subject: "Re: Quick note",
      body: "<p>Still useful?</p>",
      bodyText: "Still useful?",
      parentDraft: {
        senderEmail: "second@gmail.com",
        messages: [
          {
            providerMessageId: "gmail_parent_msg",
            providerThreadId: "gmail_parent_thread",
          },
        ],
      },
    });
    process.env.SENDER_EMAILS = "tim.personal@gmail.com,second@gmail.com";
    listConnectedGmailAccounts.mockResolvedValue(["tim.personal@gmail.com", "second@gmail.com"]);
    gmailFetch.mockImplementation(async (path: string) => {
      if (path.startsWith("/users/me/messages/gmail_parent_msg")) {
        return {
          payload: {
            headers: [
              { name: "References", value: "<root@example.com>" },
              { name: "Message-ID", value: "<parent@example.com>" },
            ],
          },
        };
      }
      return { id: "gmail_followup_msg", threadId: "gmail_parent_thread" };
    });
    const { sendDraft } = await import("@/lib/gmail/send");

    await expect(sendDraft("followup_1")).resolves.toEqual({
      gmailMessageId: "gmail_followup_msg",
      gmailThreadId: "gmail_parent_thread",
    });

    // The follow-up uses the first email's sender, in that sender's mailbox.
    expect(gmailFetch).toHaveBeenCalledWith(
      "/users/me/messages/gmail_parent_msg?format=metadata&metadataHeaders=Message-ID&metadataHeaders=References",
      {},
      "second@gmail.com",
    );
    expect(gmailFetch).toHaveBeenCalledWith(
      "/users/me/messages/send",
      { method: "POST", body: { raw: expect.any(String), threadId: "gmail_parent_thread" } },
      "second@gmail.com",
    );
    const sendCall = gmailFetch.mock.calls.find(([path]) => path === "/users/me/messages/send");
    const raw = sendCall?.[1]?.body.raw as string;
    const decoded = Buffer.from(raw.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    expect(decoded).toContain("In-Reply-To: <parent@example.com>");
    expect(decoded).toContain("References: <root@example.com> <parent@example.com>");
    expect(messageCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        draftId: "followup_1",
        providerMessageId: "gmail_followup_msg",
        providerThreadId: "gmail_parent_thread",
        headers: {
          "In-Reply-To": "<parent@example.com>",
          References: "<root@example.com> <parent@example.com>",
        },
      }),
    });
  });
});
