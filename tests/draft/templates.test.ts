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

  it("tests distinct subjects with identical bodies and one merged introduction", () => {
    expect(new Set(templates.map(t => t.subject)).size).toBe(4);
    expect(new Set(templates.map(t => t.bodyHtml)).size).toBe(1);
    for (const template of templates) {
      expect(template.bodyHtml).toContain("<p>I'm {{sender_first_name}}, founder of ShipBoost. I wanted to reach out about {{product_name}}.");
    }
  });

  it("preserves both ongoing search visibility and AI recommendation selling points", () => {
    for (const template of all) {
      expect(template.bodyHtml).toContain("keep getting found through search after launch week");
      expect(template.bodyHtml).toContain("ChatGPT a public reference to draw on when recommending tools");
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
