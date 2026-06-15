import { beforeEach, describe, expect, it, vi } from "vitest";

const checkEmailDomainMx = vi.fn();

vi.mock("@/lib/email/mx", () => ({ checkEmailDomainMx }));

describe("validateRecipientEmail", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    delete process.env.EMAIL_VALIDATION_PROVIDER;
    delete process.env.ABSTRACT_API_EMAIL_VALIDATION_KEY;
    vi.stubGlobal("fetch", vi.fn());
  });

  it("fails when MX validation fails", async () => {
    checkEmailDomainMx.mockResolvedValue({ ok: false, domain: "example.com", reason: "no_mx" });
    const { validateRecipientEmail } = await import("@/lib/email/validation");

    await expect(validateRecipientEmail("founder@example.com")).resolves.toEqual({
      ok: false,
      reason: "no_mx",
      source: "mx",
    });
  });

  it("passes on MX only when provider is disabled", async () => {
    process.env.EMAIL_VALIDATION_PROVIDER = "none";
    checkEmailDomainMx.mockResolvedValue({ ok: true, domain: "example.com", exchanges: ["mx.example.com"] });
    const { validateRecipientEmail } = await import("@/lib/email/validation");

    await expect(validateRecipientEmail("founder@example.com")).resolves.toEqual({
      ok: true,
      source: "mx",
    });
  });

  it("fails when Abstract API says the mailbox is undeliverable", async () => {
    process.env.EMAIL_VALIDATION_PROVIDER = "abstractapi";
    process.env.ABSTRACT_API_EMAIL_VALIDATION_KEY = "key_123";
    checkEmailDomainMx.mockResolvedValue({ ok: true, domain: "example.com", exchanges: ["mx.example.com"] });
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        deliverability: "UNDELIVERABLE",
        is_valid_format: { value: true },
      }),
    } as Response);
    const { validateRecipientEmail } = await import("@/lib/email/validation");

    await expect(validateRecipientEmail("founder@example.com")).resolves.toEqual({
      ok: false,
      reason: "mailbox_undeliverable",
      source: "abstractapi",
    });
  });

  it("passes when Abstract API says the mailbox is deliverable", async () => {
    process.env.EMAIL_VALIDATION_PROVIDER = "abstractapi";
    process.env.ABSTRACT_API_EMAIL_VALIDATION_KEY = "key_123";
    checkEmailDomainMx.mockResolvedValue({ ok: true, domain: "example.com", exchanges: ["mx.example.com"] });
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        deliverability: "DELIVERABLE",
        is_valid_format: { value: true },
      }),
    } as Response);
    const { validateRecipientEmail } = await import("@/lib/email/validation");

    await expect(validateRecipientEmail("founder@example.com")).resolves.toEqual({
      ok: true,
      source: "abstractapi",
    });
  });
});
