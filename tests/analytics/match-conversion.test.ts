import { describe, it, expect } from "vitest";

import {
  matchConversion,
  stringSimilarity,
  type ContactLite,
} from "@/lib/analytics/match-conversion";

function contact(overrides: Partial<ContactLite> = {}): ContactLite {
  return {
    id: "contact_1",
    email: "founder@sheepiesleep.com",
    domain: "sheepiesleep.com",
    name: "Sheepie",
    drafts: [
      {
        id: "draft_1",
        templateKey: "hyb-03-second-job",
        status: "SENT",
        sentAt: new Date("2026-05-20T00:00:00Z"),
      },
    ],
    ...overrides,
  };
}

const paidAt = new Date("2026-05-25T00:00:00Z");

describe("matchConversion", () => {
  it("matches on domain even when the purchase email differs", () => {
    const result = matchConversion(
      {
        websiteUrl: "https://www.sheepiesleep.com",
        founderEmail: "someone-else@gmail.com",
        productName: "Sheepie",
        paidAt,
      },
      [contact()],
    );

    expect(result.status).toBe("MATCHED_DOMAIN");
    expect(result.matchedContactId).toBe("contact_1");
    expect(result.matchedTemplateKey).toBe("hyb-03-second-job");
    expect(result.confidence).toBe(1);
  });

  it("falls back to email match when domain does not match", () => {
    const result = matchConversion(
      {
        websiteUrl: "https://different-domain.com",
        founderEmail: "founder@sheepiesleep.com",
        productName: "Something Else",
        paidAt,
      },
      [contact()],
    );

    expect(result.status).toBe("MATCHED_EMAIL");
    expect(result.matchedDraftId).toBe("draft_1");
  });

  it("attributes to the most recent draft sent on or before the purchase", () => {
    const result = matchConversion(
      {
        websiteUrl: "https://sheepiesleep.com",
        founderEmail: null,
        productName: "Sheepie",
        paidAt,
      },
      [
        contact({
          drafts: [
            {
              id: "draft_old",
              templateKey: "out-01-spike-diagnosis-named",
              status: "SENT",
              sentAt: new Date("2026-05-10T00:00:00Z"),
            },
            {
              id: "draft_recent",
              templateKey: "fu-01-bump-named",
              status: "SENT",
              sentAt: new Date("2026-05-22T00:00:00Z"),
            },
            {
              id: "draft_future",
              templateKey: "out-07-short-named",
              status: "SENT",
              sentAt: new Date("2026-05-30T00:00:00Z"), // after paidAt — ignore
            },
          ],
        }),
      ],
    );

    expect(result.status).toBe("MATCHED_DOMAIN");
    expect(result.matchedDraftId).toBe("draft_recent");
    expect(result.matchedTemplateKey).toBe("fu-01-bump-named");
  });

  it("is ORGANIC when the matched contact was never sent before the purchase", () => {
    const result = matchConversion(
      {
        websiteUrl: "https://sheepiesleep.com",
        founderEmail: null,
        productName: "Sheepie",
        paidAt,
      },
      [
        contact({
          drafts: [
            {
              id: "draft_pending",
              templateKey: "out-01-spike-diagnosis-named",
              status: "PENDING_REVIEW",
              sentAt: null,
            },
          ],
        }),
      ],
    );

    expect(result.status).toBe("ORGANIC");
    expect(result.matchedContactId).toBeNull();
  });

  it("is ORGANIC when no contact matches at all", () => {
    const result = matchConversion(
      {
        websiteUrl: "https://unknown-product.com",
        founderEmail: "nobody@unknown-product.com",
        productName: "Totally Unrelated Widget",
        paidAt,
      },
      [contact()],
    );

    expect(result.status).toBe("ORGANIC");
  });

  it("flags a close product-name match as POSSIBLE for manual review", () => {
    const result = matchConversion(
      {
        websiteUrl: "https://sheepie-rebrand.io", // domain changed
        founderEmail: "new@personal.com", // email changed
        productName: "Sheepie Sleep", // name still close to contact 'Sheepie'
        paidAt,
      },
      [contact({ name: "Sheepie" })],
    );

    expect(result.status).toBe("POSSIBLE");
    expect(result.matchedContactId).toBe("contact_1");
  });
});

describe("stringSimilarity", () => {
  it("scores identical normalized names as 1", () => {
    expect(stringSimilarity("Sheepie", "sheepie")).toBe(1);
  });

  it("scores unrelated names low", () => {
    expect(stringSimilarity("Sheepie", "QuantumLedger")).toBeLessThan(0.3);
  });
});
