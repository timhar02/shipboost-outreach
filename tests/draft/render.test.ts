import { describe, it, expect } from "vitest";
import { renderTemplate } from "@/lib/draft/render";

const tmpl = {
  key: "t",
  subject: "{{product_name}} — quick note",
  bodyHtml: "<p>Hey {{first_name}},</p><p>About {{website_domain}} — {{tagline}}.</p><p>— {{sender_first_name}}</p>",
};

describe("renderTemplate", () => {
  it("substitutes variables and derives plain text", () => {
    const r = renderTemplate(tmpl, {
      first_name: "Sarah", product_name: "Wavefly", tagline: "quiet launches",
      website_domain: "trywavefly.com", sender_first_name: "Tim", shipboost_dr: "44",
    });
    expect(r.subject).toBe("Wavefly — quick note");
    expect(r.bodyHtml).toContain("Hey Sarah,");
    expect(r.bodyText).toContain("Hey Sarah,");
    expect(r.bodyText).toContain("— Tim");
    expect(r.bodyText).not.toContain("<p>");
  });
  it("throws if a referenced variable is missing", () => {
    expect(() => renderTemplate(tmpl, {
      product_name: "Wavefly", tagline: "t", website_domain: "x.com", sender_first_name: "Tim", shipboost_dr: "44",
    } as never)).toThrow(/first_name/);
  });
});
