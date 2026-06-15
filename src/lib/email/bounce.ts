export type InboundEmailSummary = {
  from?: string;
  subject?: string;
  snippet?: string;
};

export type InboundEmailClassification =
  | { kind: "REPLY" }
  | { kind: "BOUNCE"; severity: "temporary" | "permanent"; reason: string };

const MAILER_DAEMON_RE = /\b(mailer-daemon|mail delivery subsystem|postmaster)\b/i;

export function classifyInboundEmail(email: InboundEmailSummary): InboundEmailClassification {
  const from = email.from ?? "";
  const subject = email.subject ?? "";
  const snippet = email.snippet ?? "";
  const haystack = `${from}\n${subject}\n${snippet}`;

  if (!MAILER_DAEMON_RE.test(haystack) && !/delivery status notification/i.test(subject)) {
    return { kind: "REPLY" };
  }

  if (/address not found|account that you tried to reach does not exist|couldn't be found|could not be found/i.test(haystack)) {
    return { kind: "BOUNCE", severity: "permanent", reason: "address_not_found" };
  }

  if (/recipient server did not accept our requests to connect|timed out/i.test(haystack)) {
    return { kind: "BOUNCE", severity: "temporary", reason: "recipient_server_timeout" };
  }

  if (/temporary problem|delivery incomplete|will retry/i.test(haystack)) {
    return { kind: "BOUNCE", severity: "temporary", reason: "delivery_delayed" };
  }

  if (/delivery status notification|message not delivered|delivery failed/i.test(haystack)) {
    return { kind: "BOUNCE", severity: "permanent", reason: "delivery_failed" };
  }

  return { kind: "REPLY" };
}
