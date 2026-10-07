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

  it("offers the current $19 one-time launch without expired scarcity", () => {
    for (const t of all) {
      expect(t.bodyHtml).toContain("Premium Launch is $19 per launch, paid once");
      expect(t.bodyHtml).toContain("editorial article");
      expect(t.bodyHtml).toContain("featured placement");
      expect(t.bodyHtml).not.toMatch(/\$9\b|founding price|spots left/i);
    }
  });
});
