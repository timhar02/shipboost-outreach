import { prisma } from "@/server/db/client";
import { extractEmail } from "@/lib/scrape/extract-email";
import { extractContext } from "@/lib/scrape/extract-context";
import { jitter } from "@/lib/scrape/fetch-html";
import { templates } from "@/lib/draft/templates";
import { hybridTemplates } from "@/lib/draft/hybrid-templates";
import { selectTemplate } from "@/lib/draft/select";
import { renderTemplate, type RenderVars } from "@/lib/draft/render";
import { personalize } from "@/lib/draft/personalize";
import type { RawLaunch } from "@/lib/sources/types";
import type { SourceKind } from "@prisma/client";

export type ProcessOutcome =
  | { kind: "DRAFT_CREATED"; draftId: string; contactEmail: string; usedLlm: boolean }
  | { kind: "SKIPPED_DEDUP" }
  | { kind: "SKIPPED_NO_EMAIL" }
  | { kind: "SKIPPED_ERROR"; error: string };

/**
 * Given a normalized launch and its source kind, upsert the Launch row,
 * scrape the website for an email, optionally personalize via LLM, and
 * create a draft (or skip).
 *
 * Behaviour flag:
 *   USE_LLM_PERSONALIZATION=1  → use hybrid templates with LLM-written
 *                                opener+subject (falls back to static
 *                                templates on LLM failure)
 *
 * Caller is responsible for upserting the Source row.
 */
export async function processLaunch(
  sourceId: string,
  sourceKind: SourceKind,
  raw: RawLaunch,
  opts: { senderFirstName?: string; shipboostDr?: string } = {},
): Promise<ProcessOutcome> {
  const senderFirstName = opts.senderFirstName ?? process.env.SENDER_FIRST_NAME ?? "Tim";
  const shipboostDr = opts.shipboostDr ?? process.env.SHIPBOOST_DR ?? "44";
  const useLlm = process.env.USE_LLM_PERSONALIZATION === "1" && !!process.env.OPENROUTER_API_KEY;
  const llmModel = process.env.LLM_MODEL ?? "deepseek/deepseek-v4-flash:free";

  const launch = await prisma.launch.upsert({
    where: { sourceId_externalId: { sourceId, externalId: raw.externalId } },
    create: {
      sourceId,
      externalId: raw.externalId,
      name: raw.name,
      tagline: raw.tagline,
      url: raw.url,
      launchedAt: raw.launchedAt,
      raw: raw.raw as object,
      processedAt: new Date(),
    },
    update: { processedAt: new Date() },
  });

  let domain: string;
  try {
    domain = new URL(raw.url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return { kind: "SKIPPED_ERROR", error: "invalid URL" };
  }

  const dupeByDomain = await prisma.contact.findUnique({ where: { domain } });
  if (dupeByDomain) return { kind: "SKIPPED_DEDUP" };

  const hit = await extractEmail(raw.url);
  await jitter();
  if (!hit) return { kind: "SKIPPED_NO_EMAIL" };

  const dupeByEmail = await prisma.contact.findUnique({ where: { email: hit.email } });
  if (dupeByEmail) return { kind: "SKIPPED_DEDUP" };

  let contact;
  try {
    contact = await prisma.contact.create({
      data: {
        email: hit.email,
        domain,
        name: hit.name,
        launchId: launch.id,
        discoveredFrom: hit.source,
      },
    });
  } catch (err) {
    return { kind: "SKIPPED_ERROR", error: err instanceof Error ? err.message : String(err) };
  }

  // Try LLM personalization first (if enabled). Fall back to static templates on failure.
  let subjectOverride: string | undefined;
  let openerOverride: string | undefined;
  let templateKeyOverride: string | undefined;
  let usedLlm = false;

  if (useLlm) {
    try {
      const ctx = await extractContext(raw.url);
      const personalized = await personalize(
        {
          productName: raw.name,
          tagline: raw.tagline,
          websiteDomain: domain,
          firstName: hit.name ?? undefined,
          context: ctx,
        },
        { model: llmModel, maxRetries: 1 },
      );
      subjectOverride = personalized.subject;
      openerOverride = personalized.opener;
      // Pick a hybrid template (rotates by domain hash).
      const hybTmpl = selectTemplate(domain, hybridTemplates);
      templateKeyOverride = hybTmpl.key;
      usedLlm = true;

      const renderedHybrid = renderTemplate(hybTmpl, {
        first_name: hit.name,
        product_name: raw.name,
        tagline: raw.tagline ?? raw.name,
        website_domain: domain,
        sender_first_name: senderFirstName,
        shipboost_dr: shipboostDr,
        personalized_subject: subjectOverride,
        personalized_opener: openerOverride,
      } as RenderVars);

      const draft = await prisma.outreachDraft.create({
        data: {
          contactId: contact.id,
          templateKey: hybTmpl.key,
          subject: renderedHybrid.subject,
          body: renderedHybrid.bodyHtml,
          bodyText: renderedHybrid.bodyText,
        },
      });
      void sourceKind;
      return { kind: "DRAFT_CREATED", draftId: draft.id, contactEmail: contact.email, usedLlm: true };
    } catch (err) {
      // Log but fall through to static template path
      console.warn(`[personalize] LLM failed for ${domain}: ${err instanceof Error ? err.message : err}`);
    }
  }

  // Static-template path (default, also the LLM fallback).
  const eligible = hit.name ? templates : templates.filter((t) => t.key.endsWith("-noname"));
  const pool = eligible.length ? eligible : templates;
  const tmpl = selectTemplate(domain, pool);

  const rendered = renderTemplate(tmpl, {
    first_name: hit.name,
    product_name: raw.name,
    tagline: raw.tagline ?? raw.name,
    website_domain: domain,
    sender_first_name: senderFirstName,
    shipboost_dr: shipboostDr,
  });

  const draft = await prisma.outreachDraft.create({
    data: {
      contactId: contact.id,
      templateKey: templateKeyOverride ?? tmpl.key,
      subject: rendered.subject,
      body: rendered.bodyHtml,
      bodyText: rendered.bodyText,
    },
  });

  void sourceKind;
  return { kind: "DRAFT_CREATED", draftId: draft.id, contactEmail: contact.email, usedLlm };
}
