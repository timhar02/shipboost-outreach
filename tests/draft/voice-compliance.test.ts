import { describe, it, expect } from "vitest";
import { templates } from "@/lib/draft/templates";
import { followUpTemplates } from "@/lib/draft/follow-up-templates";

const BANNED = [
  /\bleverage\b/i, /\bseamlessly\b/i, /\brobust\b/i, /\belevate\b/i, /\bempower\b/i,
  /\bfoster\b/i, /\bunlock the potential\b/i, /\bharness the power\b/i,
  /\brevolutionary\b/i, /\bgame[- ]changing\b/i, /\bcutting[- ]edge\b/i,
  /\bnext[- ]level\b/i, /\bunprecedented\b/i, /\bbest[- ]in[- ]class\b/i,
  /\bvibrant community\b/i, /\bbuilt with passion\b/i, /\bmade with love\b/i,
  /\bbuilders and makers\b/i,
  /it'?s worth noting that/i, /here'?s the thing/i,
  /let'?s dive in/i, /let'?s unpack/i, /the truth is/i,
  /here'?s what most founders get wrong/i, /the thing nobody tells you/i,
  /the launch journey/i, /the startup landscape/i, /navigating the complexities/i,
  // AI-writing tells
  /\bdelve\b/i, /\bdelving\b/i, /\bin essence\b/i, /\bultimately\b/i,
  /\bfundamentally\b/i, /\bimagine if\b/i, /\ba stepping stone\b/i,
  /\btapestry\b/i, /\brealm of\b/i, /\bmyriad\b/i,
  // em-dash (U+2014) and en-dash (U+2013) as content; common AI tells
  /—/, /–/,
];

const STACCATO_STACK = /(?:^|>)\s*([A-Z][a-z]+\.\s+){3,}\s*(?:<|$)/m;

describe("voice-profile compliance", () => {
  for (const t of [...templates, ...followUpTemplates]) {
    it(`${t.key} contains no banned phrases`, () => {
      const blob = `${t.subject}\n${t.bodyHtml}`;
      for (const re of BANNED) expect(blob, `matched ${re}`).not.toMatch(re);
      expect(blob, "staccato fragment stack").not.toMatch(STACCATO_STACK);
    });
  }
  it("template keys are unique", () => {
    const all = [...templates, ...followUpTemplates].map((t) => t.key);
    expect(new Set(all).size).toBe(all.length);
  });
  it("carries no stale pricing copy ($29 / sold out)", () => {
    for (const t of [...templates, ...followUpTemplates]) {
      const blob = `${t.subject}\n${t.bodyHtml}`;
      expect(blob, `${t.key} mentions $29`).not.toMatch(/\$29/);
      expect(blob, `${t.key} mentions sold out`).not.toMatch(/sold out/i);
    }
  });
  it("first-touch templates pitch the $9 founding price with spots-left scarcity", () => {
    for (const t of templates) {
      const blob = t.bodyHtml;
      expect(blob, `${t.key} missing $9`).toMatch(/\$9\b/);
      expect(blob, `${t.key} missing spots left`).toContain("spots left");
    }
  });
});
