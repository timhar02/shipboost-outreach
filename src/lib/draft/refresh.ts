import type { SourceKind } from "@prisma/client";
import { templates, templatesFor } from "./templates";
import { hybridTemplates } from "./hybrid-templates";
import { followUpTemplates } from "./follow-up-templates";
import { launchWhen, renderTemplate, type RenderVars, type Rendered } from "./render";
import { selectTemplate } from "./select";
import { sourceLabel } from "@/lib/sources/source-url";

// First touches written before v5 move to the v5 angle that fits the prospect.
const LEGACY_FIRST_TOUCH = /^out-(?:v[234]-)?(?:02-direct-question|04-mechanic-first|11-ai-visibility|12-positioning|subject-[a-z]+)-noname$/;

export type RefreshableDraft = {
  templateKey: string;
  subject: string;
  body: string;
  parentDraftId: string | null;
  contact: {
    name: string | null;
    domain: string;
    launch: {
      name: string;
      tagline: string | null;
      raw?: unknown;
      launchedAt?: Date;
      source?: { kind: SourceKind };
    };
  };
};

export function refreshDraft(
  draft: RefreshableDraft,
  senderFirstName: string,
  shipboostDr: string,
): Rendered & { templateKey: string } {
  const firstTouch = !draft.parentDraftId;
  const pool = firstTouch ? templates : followUpTemplates;
  const nextKey = draft.templateKey.replace(/^fu-(?:v\d+-)?/, "fu-v2-");
  let template = pool.find((item) => item.key === draft.templateKey || item.key === nextKey);
  if (firstTouch && LEGACY_FIRST_TOUCH.test(draft.templateKey)) {
    const launchRaw = draft.contact.launch.raw as { premiumListing?: unknown; featured?: unknown } | null | undefined;
    const paidLaunch = launchRaw?.premiumListing === true || launchRaw?.featured === true;
    template = selectTemplate(draft.contact.domain, templatesFor({ paidLaunch, hasName: Boolean(draft.contact.name) }));
  }
  const postalAddress = process.env.SENDER_POSTAL_ADDRESS?.trim();
  const vars: RenderVars = {
    first_name: draft.contact.name ?? undefined,
    product_name: draft.contact.launch.name,
    tagline: draft.contact.launch.tagline ?? draft.contact.launch.name,
    website_domain: draft.contact.domain,
    sender_first_name: senderFirstName,
    shipboost_dr: shipboostDr,
    board: draft.contact.launch.source ? sourceLabel(draft.contact.launch.source.kind) : "a launch board",
    launch_when: launchWhen(draft.contact.launch.launchedAt),
    postal_line: postalAddress ? `<br/>${postalAddress}` : "",
  };

  if (firstTouch && draft.templateKey.startsWith("hyb-")) {
    template = hybridTemplates[0];
    const opener = draft.body.match(/<(p|span)\b[^>]*\bdata-personalized-opener\b[^>]*>([\s\S]*?)<\/\1>/i)?.[2]
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
