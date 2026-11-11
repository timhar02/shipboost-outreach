import { describe, expect, it } from "vitest";
import { refreshDraft, type RefreshableDraft } from "@/lib/draft/refresh";
import { paidLaunchTemplates, templatesFor } from "@/lib/draft/templates";
import { selectTemplate } from "@/lib/draft/select";

// Sarah is named, so legacy first touches move to the named v5 launch angles.
const v5For = (domain: string) => selectTemplate(domain, templatesFor({ paidLaunch: false, hasName: true }));

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
    expect(updated.templateKey).toBe(v5For(draft.contact.domain).key);
    expect(updated.subject).toBe(v5For(draft.contact.domain).subject.replace("{{product_name}}", "Wavefly"));
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
    expect(updated.bodyHtml.match(/<p>Hi Wavefly team,<\/p>/g)).toHaveLength(1);
    expect(refreshDraft({ ...draft, templateKey: updated.templateKey, body: updated.bodyHtml, subject: updated.subject }, "Tim", "46")).toEqual(updated);
    expect(updated.bodyText).toContain("$19");
  });

  it("moves v4 first touches to the v5 angle, greeting the founder by name", () => {
    const updated = refreshDraft({ ...draft, templateKey: "out-v4-subject-article-noname" }, "Tim", "46");
    expect(updated.templateKey).toBe(v5For(draft.contact.domain).key);
    expect(updated.bodyText).toMatch(/^Hi Sarah,/);
    expect(updated.bodyText).not.toContain("I'm Tim, founder of ShipBoost.");
    expect(updated.bodyText).toContain('Not useful? Reply "no"');
  });

  it("gives founders who paid for a launch elsewhere the paid angle, naming the board", () => {
    const updated = refreshDraft({
      ...draft,
      templateKey: "out-v4-subject-chatgpt-noname",
      contact: { ...draft.contact, launch: { ...draft.contact.launch, raw: { premiumListing: true }, source: { kind: "SCROLLLAUNCH" } } },
    }, "Tim", "46");
    expect(paidLaunchTemplates.map((t) => t.key)).toContain(updated.templateKey);
    expect(updated.bodyText).toContain("ScrollLaunch");
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
