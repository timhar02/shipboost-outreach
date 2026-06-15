import { beforeEach, describe, expect, it, vi } from "vitest";

const resolveMx = vi.fn();

vi.mock("node:dns/promises", () => ({ resolveMx }));

describe("checkEmailDomainMx", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("passes when the recipient domain has MX records", async () => {
    resolveMx.mockResolvedValue([{ exchange: "aspmx.l.google.com", priority: 1 }]);
    const { checkEmailDomainMx } = await import("@/lib/email/mx");

    await expect(checkEmailDomainMx("founder@example.com")).resolves.toEqual({
      ok: true,
      domain: "example.com",
      exchanges: ["aspmx.l.google.com"],
    });
  });

  it("fails when the recipient domain has no MX records", async () => {
    const err = new Error("queryMx ENODATA");
    Object.assign(err, { code: "ENODATA" });
    resolveMx.mockRejectedValue(err);
    const { checkEmailDomainMx } = await import("@/lib/email/mx");

    await expect(checkEmailDomainMx("founder@example.com")).resolves.toEqual({
      ok: false,
      domain: "example.com",
      reason: "no_mx",
    });
  });

  it("fails invalid email syntax before DNS lookup", async () => {
    const { checkEmailDomainMx } = await import("@/lib/email/mx");

    await expect(checkEmailDomainMx("not-an-email")).resolves.toEqual({
      ok: false,
      domain: "",
      reason: "invalid_email",
    });
    expect(resolveMx).not.toHaveBeenCalled();
  });
});
