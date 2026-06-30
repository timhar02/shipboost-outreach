import { describe, expect, it } from "vitest";
import { templates } from "@/lib/draft/templates";
import { hybridTemplates } from "@/lib/draft/hybrid-templates";

const all = [...templates, ...hybridTemplates];

describe("outreach templates pricing", () => {
  it("never reference the removed discount tokens", () => {
    for (const t of all) {
      expect(t.bodyHtml).not.toContain("discount_code");
      expect(t.bodyHtml).not.toContain("discount_deadline");
    }
  });

  it("offer $9 founding with spots-left scarcity", () => {
    const offers = all.filter((t) => t.bodyHtml.includes("Premium Launch is $9"));
    expect(offers.length).toBeGreaterThan(0);
    for (const t of offers) {
      expect(t.bodyHtml).toContain("$9");
      expect(t.bodyHtml).toContain("spots left");
      expect(t.bodyHtml).not.toContain("normally $19");
    }
  });
});
