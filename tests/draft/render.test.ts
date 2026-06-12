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
  it("renders discount code and deadline into body and text", () => {
    const discountTmpl = {
      key: "d",
      subject: "{{product_name}}",
      bodyHtml: "<p>Use code {{discount_code}} at checkout, it closes {{discount_deadline}}.</p>",
    };
    const r = renderTemplate(discountTmpl, {
      product_name: "Wavefly", tagline: "t", website_domain: "x.com",
      sender_first_name: "Tim", shipboost_dr: "45",
      discount_code: "LAUNCH9-ABCD1234", discount_deadline: "June 23",
    });
    expect(r.bodyHtml).toContain("LAUNCH9-ABCD1234");
    expect(r.bodyHtml).toContain("June 23");
    expect(r.bodyText).toContain("LAUNCH9-ABCD1234");
    expect(r.bodyText).toContain("June 23");
  });
  it("throws when a discount template renders without the discount vars", () => {
    const discountTmpl = {
      key: "d",
      subject: "{{product_name}}",
      bodyHtml: "<p>Use code {{discount_code}} closes {{discount_deadline}}.</p>",
    };
    expect(() => renderTemplate(discountTmpl, {
      product_name: "Wavefly", tagline: "t", website_domain: "x.com",
      sender_first_name: "Tim", shipboost_dr: "45",
    })).toThrow(/discount_code/);
  });
});
