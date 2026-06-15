import { describe, expect, it } from "vitest";
import { classifyInboundEmail } from "@/lib/email/bounce";

describe("classifyInboundEmail", () => {
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
