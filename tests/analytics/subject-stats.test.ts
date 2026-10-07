import { describe, expect, it } from "vitest";
import { computeSubjectStats } from "@/lib/analytics/subject-stats";

const variants = [{ key: "a", subject: "article" }, { key: "b", subject: "SEO" }];
const sent = { templateKey: "a", sentAt: new Date(), status: "SENT", events: [], messages: [] };

describe("subject line experiment", () => {
  it("counts recipients once, separates queued drafts, and keeps bounced sending attempts", () => {
    const rows = computeSubjectStats(variants, [
      { ...sent, events: [{ kind: "OPEN" }, { kind: "OPEN" }, { kind: "REPLY" }] },
      { ...sent, status: "BOUNCED", messages: [{ from: "mailer-daemon", subject: "Delivery failed" }] },
      { ...sent, sentAt: null, status: "PENDING_REVIEW", events: [{ kind: "OPEN" }] },
      { ...sent, sentAt: null, status: "SKIPPED" },
    ], [{ templateKey: "a", sent: 2, converted: 1, conversionRate: 50, revenueCents: 1900 }]);
    expect(rows[0]).toEqual({ templateKey: "a", subject: "article", queued: 1, sent: 2, opened: 1, replied: 1, paidOrders: 1 });
    expect(rows[1]).toEqual({ templateKey: "b", subject: "SEO", queued: 0, sent: 0, opened: 0, replied: 0, paidOrders: 0 });
  });

  it("includes automated replies explicitly and excludes misclassified delivery notices", () => {
    const rows = computeSubjectStats(variants, [
      { ...sent, messages: [{ subject: "Auto reply", snippet: "Thanks for contacting us" }] },
      { ...sent, events: [{ kind: "REPLY" }], messages: [{ snippet: "We could not deliver the attached mail for the following recipients: 5.1.1 recipient unknown" }] },
    ], []);
    expect(rows[0].replied).toBe(1);
  });
});
