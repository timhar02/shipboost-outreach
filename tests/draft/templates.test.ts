import { describe, expect, it } from "vitest";
import { launchTemplates, paidLaunchTemplates, templates, templatesFor } from "@/lib/draft/templates";
import { launchWhen, renderTemplate } from "@/lib/draft/render";

const VARS = {
  first_name: "Ketan",
  product_name: "Notelify",
  tagline: "AI study workspace",
  website_domain: "notelifyapp.com",
  sender_first_name: "Tim",
  shipboost_dr: "54",
  board: "ScrollLaunch",
  launch_when: "this week",
};

// The part of the email the reader judges: greeting through the ask, without
// the signature and opt-out line.
function readableBody(text: string): string {
  return text.split(/\nTim, ShipBoost/)[0];
}

describe("v5 first-touch templates", () => {
  it("ship a named and a no-name variant for every angle", () => {
    const keys = templates.map((t) => t.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const key of keys.filter((k) => !k.endsWith("-noname"))) expect(keys).toContain(`${key}-noname`);
    expect(templates.filter((t) => t.key.endsWith("-noname")).every((t) => t.bodyHtml.includes("Hi {{product_name}} team,"))).toBe(true);
    expect(templates.filter((t) => !t.key.endsWith("-noname")).every((t) => t.bodyHtml.includes("Hi {{first_name}},"))).toBe(true);
  });

  it("route paid launchers to the paid angles and pick variants by name", () => {
    expect(templatesFor({ paidLaunch: true, hasName: true }).every((t) => paidLaunchTemplates.includes(t) && !t.key.endsWith("-noname"))).toBe(true);
    expect(templatesFor({ paidLaunch: false, hasName: false }).every((t) => launchTemplates.includes(t) && t.key.endsWith("-noname"))).toBe(true);
    expect(templatesFor({ paidLaunch: true, hasName: false })).toHaveLength(paidLaunchTemplates.length / 2);
  });

  for (const t of templates) {
    it(`${t.key} follows the cold-email rules`, () => {
      const rendered = renderTemplate(t, VARS);
      const words = readableBody(rendered.bodyText).split(/\s+/).filter(Boolean).length;
      expect(words, "keep the first touch short").toBeLessThanOrEqual(90);
      expect(rendered.bodyHtml.match(/<a\s/g) ?? [], "exactly one link").toHaveLength(1);
      expect(rendered.bodyText).toMatch(/Not useful\? Reply "no" and I won't email again\./);
      expect(rendered.bodyHtml, "open with their launch, not with us").not.toMatch(/I'm Tim, founder|wanted to reach out/i);
      expect(rendered.bodyHtml).toMatch(/\$19\b/);
      expect(readableBody(rendered.bodyText).trim(), "ask a question").toMatch(/\?$/);
      expect(rendered.subject.split(/\s+/).length, "short subject").toBeLessThanOrEqual(6);
      expect(rendered.subject).not.toMatch(/^(re|fwd):/i);
      expect(`${rendered.subject} ${rendered.bodyHtml}`).not.toMatch(/\bDR\s?\d|high DR|domain rating/i);
    });
  }

  it("names the board the founder launched on", () => {
    for (const t of templates.filter((x) => !x.key.includes("chatgpt"))) {
      expect(renderTemplate(t, VARS).bodyText).toContain("ScrollLaunch");
    }
  });

  it("only says \"this week\" for launches in the last 7 days", () => {
    const now = new Date("2026-11-11T12:00:00Z");
    expect(launchWhen(new Date("2026-11-09T00:00:00Z"), now)).toBe("this week");
    expect(launchWhen(new Date("2026-10-20T00:00:00Z"), now)).toBe("recently");
    expect(launchWhen(undefined, now)).toBe("recently");
  });

  it("adds the postal address only when one is configured", () => {
    const [t] = templates;
    expect(renderTemplate(t, VARS).bodyText).not.toMatch(/Street|Suite/);
    expect(renderTemplate(t, { ...VARS, postal_line: "<br/>1 Example Street, Suite 2" }).bodyText).toContain("1 Example Street, Suite 2");
  });
});
