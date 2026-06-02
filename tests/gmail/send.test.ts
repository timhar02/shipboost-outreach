import { beforeEach, describe, expect, it, vi } from "vitest";

const gmailFetch = vi.fn();
const getConnectedGmailAccount = vi.fn();
const tx = vi.fn();
const draftUpdate = vi.fn();
const messageCreate = vi.fn();
const findUniqueOrThrow = vi.fn();

const draft = {
  id: "draft_1",
  status: "PENDING_REVIEW",
  subject: "Quick note",
  body: "<p>Hello</p>",
  bodyText: "Hello",
  contact: { email: "founder@example.com" },
  parentDraft: null,
};

vi.mock("@/lib/gmail/client", () => ({
  gmailFetch,
  getConnectedGmailAccount,
}));

vi.mock("@/server/db/client", () => ({
  prisma: {
    outreachDraft: {
      findUniqueOrThrow,
      count: vi.fn(async () => 0),
      update: draftUpdate,
    },
    emailMessage: {
      create: messageCreate,
    },
    $transaction: tx,
  },
}));

describe("sendDraft", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.SENDER_EMAIL = "tim.personal@gmail.com";
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    findUniqueOrThrow.mockResolvedValue(draft);
    getConnectedGmailAccount.mockResolvedValue({ accountEmail: "tim.personal@gmail.com" });
    gmailFetch.mockResolvedValue({ id: "gmail_msg_1", threadId: "gmail_thread_1" });
  });

  it("throws without a connected Gmail account before marking the draft failed", async () => {
    getConnectedGmailAccount.mockResolvedValue(null);
    const { sendDraft } = await import("@/lib/gmail/send");

    await expect(sendDraft("draft_1")).rejects.toThrow("No Gmail credential");
    expect(draftUpdate).not.toHaveBeenCalledWith({ where: { id: "draft_1" }, data: { status: "FAILED" } });
  });

  it("throws on sender mismatch before marking the draft failed", async () => {
    getConnectedGmailAccount.mockResolvedValue({ accountEmail: "other@gmail.com" });
    const { sendDraft } = await import("@/lib/gmail/send");

    await expect(sendDraft("draft_1")).rejects.toThrow("does not match connected Gmail account");
    expect(gmailFetch).not.toHaveBeenCalled();
    expect(draftUpdate).not.toHaveBeenCalledWith({ where: { id: "draft_1" }, data: { status: "FAILED" } });
  });

  it("sends through Gmail and stores message and thread ids", async () => {
    tx.mockResolvedValue(undefined);
    const { sendDraft } = await import("@/lib/gmail/send");

    await expect(sendDraft("draft_1")).resolves.toEqual({
      gmailMessageId: "gmail_msg_1",
      gmailThreadId: "gmail_thread_1",
    });

    expect(gmailFetch).toHaveBeenCalledWith("/users/me/messages/send", {
      method: "POST",
      body: { raw: expect.any(String) },
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

  it("sends follow-ups in the original Gmail thread with reply headers", async () => {
    tx.mockResolvedValue(undefined);
    findUniqueOrThrow.mockResolvedValue({
      ...draft,
      id: "followup_1",
      subject: "Re: Quick note",
      body: "<p>Still useful?</p>",
      bodyText: "Still useful?",
      parentDraft: {
        messages: [
          {
            providerMessageId: "gmail_parent_msg",
            providerThreadId: "gmail_parent_thread",
          },
        ],
      },
    });
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

    expect(gmailFetch).toHaveBeenCalledWith(
      "/users/me/messages/gmail_parent_msg?format=metadata&metadataHeaders=Message-ID&metadataHeaders=References",
    );
    expect(gmailFetch).toHaveBeenCalledWith("/users/me/messages/send", {
      method: "POST",
      body: { raw: expect.any(String), threadId: "gmail_parent_thread" },
    });
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
