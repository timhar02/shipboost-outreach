import { templates } from "./templates";
import { hybridTemplates } from "./hybrid-templates";
import { followUpTemplates } from "./follow-up-templates";
import { renderTemplate, type RenderVars, type Rendered } from "./render";

export type RefreshableDraft = {
  templateKey: string;
  subject: string;
  body: string;
  parentDraftId: string | null;
  contact: {
    name: string | null;
    domain: string;
    launch: { name: string; tagline: string | null };
  };
};

export function refreshDraft(
  draft: RefreshableDraft,
  senderFirstName: string,
  shipboostDr: string,
): Rendered & { templateKey: string } {
  const firstTouch = !draft.parentDraftId;
  const pool = firstTouch ? templates : followUpTemplates;
  const nextKey = draft.templateKey.replace(/^(out|fu)-(?:v\d+-)?/, (_, prefix: string) => `${prefix}-${firstTouch ? "v3" : "v2"}-`);
  let template = pool.find((item) => item.key === draft.templateKey || item.key === nextKey);
  const vars: RenderVars = {
    first_name: draft.contact.name ?? undefined,
    product_name: draft.contact.launch.name,
    tagline: draft.contact.launch.tagline ?? draft.contact.launch.name,
    website_domain: draft.contact.domain,
    sender_first_name: senderFirstName,
    shipboost_dr: shipboostDr,
  };

  if (firstTouch && draft.templateKey.startsWith("hyb-")) {
    template = hybridTemplates[0];
    const opener = draft.body.match(/<p\b[^>]*\bdata-personalized-opener\b[^>]*>([\s\S]*?)<\/p>/i)?.[1]
      ?? draft.body.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i)?.[1];
    if (!opener) throw new Error(`Cannot preserve personalized opener: ${draft.templateKey}`);
    vars.personalized_subject = draft.subject;
    vars.personalized_opener = opener;
  }

  if (!template) throw new Error(`Unknown pending template: ${draft.templateKey}`);
  const rendered = renderTemplate(template, vars);
  // Preserve the existing conversation subject for pending follow-ups.
  if (!firstTouch) rendered.subject = draft.subject;
  return { ...rendered, templateKey: template.key };
}
