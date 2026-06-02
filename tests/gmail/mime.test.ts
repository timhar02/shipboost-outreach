import { describe, expect, it } from "vitest";
import { buildRawHtmlEmail } from "@/lib/gmail/mime";

function decodeBase64Url(raw: string): string {
  return Buffer.from(raw.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

describe("buildRawHtmlEmail", () => {
  it("builds a base64url encoded html email", () => {
    const raw = buildRawHtmlEmail({
      from: "tim.personal@gmail.com",
      to: "founder@example.com",
      subject: "Hello from ShipBoost",
      html: "<p>Hi there</p>",
    });

    expect(raw).not.toContain("+");
    expect(raw).not.toContain("/");
    expect(raw).not.toContain("=");

    const decoded = decodeBase64Url(raw);
    expect(decoded).toContain("From: tim.personal@gmail.com");
    expect(decoded).toContain("To: founder@example.com");
    expect(decoded).toContain("Subject: Hello from ShipBoost");
    expect(decoded).toContain("MIME-Version: 1.0");
    expect(decoded).toContain("Content-Type: text/html; charset=UTF-8");
    expect(decoded).toContain("<p>Hi there</p>");
  });

  it("encodes non-ascii subjects as encoded words", () => {
    const raw = buildRawHtmlEmail({
      from: "tim.personal@gmail.com",
      to: "founder@example.com",
      subject: "Quick note — ShipBoost",
      html: "<p>Hi</p>",
    });

    expect(decodeBase64Url(raw)).toContain("Subject: =?UTF-8?B?");
  });

  it("adds safe custom headers for threaded replies", () => {
    const raw = buildRawHtmlEmail({
      from: "tim.personal@gmail.com",
      to: "founder@example.com",
      subject: "Re: Quick note",
      html: "<p>Following up</p>",
      headers: {
        "In-Reply-To": "<parent@example.com>",
        References: "<root@example.com> <parent@example.com>",
      },
    });

    const decoded = decodeBase64Url(raw);
    expect(decoded).toContain("In-Reply-To: <parent@example.com>");
    expect(decoded).toContain("References: <root@example.com> <parent@example.com>");
  });

  it("rejects unsafe custom header names", () => {
    expect(() =>
      buildRawHtmlEmail({
        from: "tim.personal@gmail.com",
        to: "founder@example.com",
        subject: "Hello",
        html: "<p>Hi</p>",
        headers: { "Bad\r\nHeader": "value" },
      }),
    ).toThrow("Invalid email header name");
  });
});
