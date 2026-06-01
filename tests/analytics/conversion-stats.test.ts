import { describe, it, expect } from "vitest";

import {
  computeConversionStats,
  type StatConversion,
} from "@/lib/analytics/conversion-stats";

const rows: StatConversion[] = [
  {
    type: "PREMIUM_LAUNCH",
    matchStatus: "MATCHED_DOMAIN",
    amountCents: 900,
    matchedTemplateKey: "hyb-03-second-job",
    paidAt: new Date("2026-05-25T00:00:00Z"),
    matchedSentAt: new Date("2026-05-20T00:00:00Z"), // 5 days
  },
  {
    type: "PREMIUM_LAUNCH",
    matchStatus: "CONFIRMED",
    amountCents: 1900,
    matchedTemplateKey: "hyb-03-second-job",
    paidAt: new Date("2026-05-22T00:00:00Z"),
    matchedSentAt: new Date("2026-05-19T00:00:00Z"), // 3 days
  },
  {
    type: "PREMIUM_LAUNCH",
    matchStatus: "ORGANIC",
    amountCents: 1900,
    matchedTemplateKey: null,
    paidAt: new Date("2026-05-21T00:00:00Z"),
    matchedSentAt: null,
  },
  {
    type: "AD",
    matchStatus: "POSSIBLE",
    amountCents: 2900,
    matchedTemplateKey: "out-07-short-named",
    paidAt: new Date("2026-05-23T00:00:00Z"),
    matchedSentAt: null,
  },
];

describe("computeConversionStats", () => {
  const stats = computeConversionStats(
    rows,
    new Map([
      ["hyb-03-second-job", 40],
      ["out-07-short-named", 50],
    ]),
  );

  it("splits email-attributed vs organic vs pending per type", () => {
    const premium = stats.split.find((s) => s.type === "PREMIUM_LAUNCH")!;
    expect(premium.total).toBe(3);
    expect(premium.emailed).toBe(2); // MATCHED_DOMAIN + CONFIRMED
    expect(premium.organic).toBe(1);
    expect(premium.pendingReview).toBe(0);

    const ad = stats.split.find((s) => s.type === "AD")!;
    expect(ad.total).toBe(1);
    expect(ad.emailed).toBe(0); // POSSIBLE is not counted as emailed
    expect(ad.pendingReview).toBe(1);
  });

  it("computes conversion rate and revenue per template (attributed only)", () => {
    const row = stats.byTemplate.find((t) => t.templateKey === "hyb-03-second-job")!;
    expect(row.sent).toBe(40);
    expect(row.converted).toBe(2);
    expect(row.conversionRate).toBeCloseTo(5);
    expect(row.revenueCents).toBe(2800);

    // POSSIBLE ad did not convert this template
    const adTemplate = stats.byTemplate.find((t) => t.templateKey === "out-07-short-named")!;
    expect(adTemplate.converted).toBe(0);
  });

  it("totals attributed revenue and median days-to-convert", () => {
    expect(stats.revenue.totalCents).toBe(2800);
    expect(stats.revenue.premiumCents).toBe(2800);
    expect(stats.revenue.adCents).toBe(0);
    expect(stats.medianDaysToConvert).toBe(4); // median of [5, 3]
  });
});
