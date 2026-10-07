import { classifyInboundEmail, type InboundEmailSummary } from "../email/bounce";
import type { TemplateRow } from "./conversion-stats";

type SubjectDraft = {
  templateKey: string;
  sentAt: Date | null;
  status: string;
  events: { kind: string }[];
  messages: InboundEmailSummary[];
};

export type SubjectRow = {
  templateKey: string;
  subject: string;
  queued: number;
  sent: number;
  opened: number;
  replied: number;
  paidOrders: number;
};

// Count recipients, not repeated events. Sending attempts stay in the
// denominator after a bounce, and automated replies are explicitly included.
export function computeSubjectStats(
  variants: { key: string; subject: string }[],
  drafts: SubjectDraft[],
  conversions: TemplateRow[],
): SubjectRow[] {
  return variants.map((variant) => {
    const rows = drafts.filter((draft) => draft.templateKey === variant.key);
    const sent = rows.filter((draft) => draft.sentAt !== null);
    return {
      templateKey: variant.key,
      subject: variant.subject,
      queued: rows.filter((draft) => draft.sentAt === null && draft.status === "PENDING_REVIEW").length,
      sent: sent.length,
      opened: sent.filter((draft) => draft.events.some((event) => event.kind === "OPEN")).length,
      replied: sent.filter((draft) => draft.messages.length
        ? draft.messages.some((message) => classifyInboundEmail(message).kind === "REPLY")
        : draft.events.some((event) => event.kind === "REPLY")).length,
      paidOrders: conversions.find((row) => row.templateKey === variant.key)?.converted ?? 0,
    };
  });
}
