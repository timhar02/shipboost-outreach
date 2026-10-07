import { describe, expect, it } from "vitest";
import { refreshDraft, type RefreshableDraft } from "@/lib/draft/refresh";

const draft: RefreshableDraft = {
  templateKey: "out-11-ai-visibility-noname",
  subject: "does ChatGPT know Wavefly exists",
  body: "<p>Quick test.</p><p>Premium Launch is $9 (21 of 50 spots left).</p>",
  parentDraftId: null,
  contact: { name: "Sarah", domain: "trywavefly.com", launch: { name: "Wavefly", tagline: "Quiet launches" } },
};

describe("refresh pending offer", () => {
  it("keeps the angle but removes the old offer in both email formats", () => {
    const updated = refreshDraft(draft, "Tim", "46");
    expect(updated.templateKey).toBe("out-v2-11-ai-visibility-noname");
    expect(updated.subject).toBe("a public reference for Wavefly");
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
    expect(updated.bodyHtml).toContain("<p>Hey Sarah, your quiet launch workflow caught my eye.</p>");
    expect(updated.bodyText).toContain("$19");
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
