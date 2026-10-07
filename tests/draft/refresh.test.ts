import { describe, expect, it } from "vitest";
import { refreshDraft, type RefreshableDraft } from "@/lib/draft/refresh";
import { templates } from "@/lib/draft/templates";
import { selectTemplate } from "@/lib/draft/select";

const draft: RefreshableDraft = {
  templateKey: "out-11-ai-visibility-noname",
  subject: "does ChatGPT know Wavefly exists",
  body: "<p>Quick test.</p><p>Premium Launch is $9 (21 of 50 spots left).</p>",
  parentDraftId: null,
  contact: { name: "Sarah", domain: "trywavefly.com", launch: { name: "Wavefly", tagline: "Quiet launches" } },
};

describe("refresh pending offer", () => {
  it("assigns a stable subject variant and removes the old offer in both email formats", () => {
    const updated = refreshDraft(draft, "Tim", "46");
    expect(updated.templateKey).toBe(selectTemplate(draft.contact.domain, templates).key);
    expect(updated.subject).toBe(selectTemplate(draft.contact.domain, templates).subject.replace("{{product_name}}", "Wavefly"));
    for (const body of [updated.bodyHtml, updated.bodyText]) {
      expect(body).toContain("$19");
      expect(body).toContain("trywavefly.com");
      expect(body).not.toMatch(/\$9\b|spots left|\{\{/);
    }
    expect(refreshDraft({ ...draft, templateKey: updated.templateKey, body: updated.bodyHtml, subject: updated.subject }, "Tim", "46")).toEqual(updated);
  });

  it("preserves a hybrid opener and subject without invoking personalization", () => {
    const updated = refreshDraft({ ...draft, templateKey: "hyb-03-second-job", body: "<p>Hey Sarah, your quiet launch workflow caught my eye.</p><p>Old offer</p>" }, "Tim", "46");
    expect(updated.subject).toBe(draft.subject);
    expect(updated.bodyHtml).toContain('<span data-personalized-opener>your quiet launch workflow caught my eye.</span>');
    expect(updated.bodyText).toContain("I'm Tim, founder of ShipBoost.");
    expect(updated.bodyHtml.match(/<p>Hi,<\/p>/g)).toHaveLength(1);
    expect(refreshDraft({ ...draft, templateKey: updated.templateKey, body: updated.bodyHtml, subject: updated.subject }, "Tim", "46")).toEqual(updated);
    expect(updated.bodyText).toContain("$19");
  });

  it("migrates the previous $19 cohort to the friendly founder introduction", () => {
    const updated = refreshDraft({ ...draft, templateKey: "out-v2-11-ai-visibility-noname" }, "Tim", "46");
    expect(updated.templateKey).toBe(selectTemplate(draft.contact.domain, templates).key);
    expect(updated.bodyText).toMatch(/^Hi,/);
    expect(updated.bodyText).toContain("I'm Tim, founder of ShipBoost.");
  });

  it("preserves an already marked v3 hybrid observation when merging the intro paragraph", () => {
    const updated = refreshDraft({ ...draft, templateKey: "hyb-v3-03-second-job", body: "<p>Hi,</p><p>I'm Tim, founder of ShipBoost.</p><p data-personalized-opener>Your workflow lets teams preview their launch.</p>" }, "Tim", "46");
    expect(updated.bodyHtml).toContain("<p>I'm Tim, founder of ShipBoost. <span data-personalized-opener>Your workflow lets teams preview their launch.</span></p>");
    expect(updated.bodyText).toContain("ChatGPT");
  });

  it("keeps follow-ups price-free and preserves their conversation subject", () => {
    const updated = refreshDraft({ ...draft, templateKey: "fu-05-ai-nudge-noname", parentDraftId: "parent", subject: "Re: Original launch" }, "Tim", "46");
    expect(updated.subject).toBe("Re: Original launch");
    expect(updated.bodyText).not.toMatch(/\$\d|starts showing up/);
  });

  it("rejects unknown templates instead of overwriting custom pending copy", () => {
    expect(() => refreshDraft({ ...draft, templateKey: "custom" }, "Tim", "46")).toThrow("Unknown pending template");
  });
});
