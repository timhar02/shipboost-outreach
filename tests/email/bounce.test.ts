import { describe, expect, it } from "vitest";
import { classifyInboundEmail } from "@/lib/email/bounce";

describe("classifyInboundEmail", () => {
  it("recognizes a structured 5.1.1 notice sent in the original thread", () => {
    expect(classifyInboundEmail({
      from: "bounce@example.com",
      subject: "Re: about Wavefly",
      snippet: "We could not deliver the attached mail for the following recipients. support@example.com: User isn&#39;t located here (5.1.1)",
    })).toEqual({ kind: "BOUNCE", severity: "permanent", reason: "address_not_found" });
  });

  it("does not mistake a human quoting a failure notice for a bounce", () => {
    expect(classifyInboundEmail({
      from: "founder@example.com",
      subject: "Re: about Wavefly",
      snippet: "Please try my new address. The error said we could not deliver the attached mail for the following recipients (5.1.1).",
    })).toEqual({ kind: "REPLY" });
  });

  it("classifies Gmail permanent delivery failures as bounces", () => {
    expect(classifyInboundEmail({
      from: "Mail Delivery Subsystem <mailer-daemon@googlemail.com>",
      subject: "Delivery Status Notification (Failure)",
      snippet: "Address not found Your message wasn't delivered to support@stackoverlap.app because the address couldn't be found.",
    })).toEqual({
      kind: "BOUNCE",
      severity: "permanent",
      reason: "address_not_found",
    });
  });

  it("classifies Gmail temporary delivery failures as delayed bounces", () => {
    expect(classifyInboundEmail({
      from: "Mail Delivery Subsystem <mailer-daemon@googlemail.com>",
      subject: "Delivery Status Notification (Delay)",
      snippet: "Delivery incomplete There was a temporary problem delivering your message to server@mcp.penlog.app. Gmail will retry.",
    })).toEqual({
      kind: "BOUNCE",
      severity: "temporary",
      reason: "delivery_delayed",
    });
  });

  it("classifies recipient server timeout notices as temporary bounces", () => {
    expect(classifyInboundEmail({
      from: "Mail Delivery Subsystem <mailer-daemon@googlemail.com>",
      subject: "Delivery Status Notification (Delay)",
      snippet: "The recipient server did not accept our requests to connect. [slopguard.app 34.8.247.175: timed out]",
    })).toEqual({
      kind: "BOUNCE",
      severity: "temporary",
      reason: "recipient_server_timeout",
    });
  });

  it("does not classify normal replies as bounces", () => {
    expect(classifyInboundEmail({
      from: "founder@example.com",
      subject: "Re: quick question",
      snippet: "Thanks for reaching out. This looks interesting.",
    })).toEqual({ kind: "REPLY" });
  });
});
