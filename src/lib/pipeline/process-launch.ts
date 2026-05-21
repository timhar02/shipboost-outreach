import { prisma } from "@/server/db/client";
import { extractEmail } from "@/lib/scrape/extract-email";
import { jitter } from "@/lib/scrape/fetch-html";
import { templates } from "@/lib/draft/templates";
import { selectTemplate } from "@/lib/draft/select";
import { renderTemplate } from "@/lib/draft/render";
import type { RawLaunch } from "@/lib/sources/types";
import type { SourceKind } from "@prisma/client";

export type ProcessOutcome =
  | { kind: "DRAFT_CREATED"; draftId: string; contactEmail: string }
  | { kind: "SKIPPED_DEDUP" }
  | { kind: "SKIPPED_NO_EMAIL" }
  | { kind: "SKIPPED_ERROR"; error: string };

/**
 * Given a normalized launch and its source kind, upsert the Launch row,
 * scrape the website for an email, and create a draft (or skip).
 *
 * Used by both:
 *   - lib/pipeline/fetch-and-queue.ts (in-process source adapters)
 *   - app/api/ingest/launches/route.ts (GHA-pushed launches)
 *
 * Caller is responsible for upserting the Source row and passing its id.
 */
export async function processLaunch(
  sourceId: string,
  sourceKind: SourceKind,
  raw: RawLaunch,
  opts: { senderFirstName?: string; shipboostDr?: string } = {},
): Promise<ProcessOutcome> {
  const senderFirstName = opts.senderFirstName ?? process.env.SENDER_FIRST_NAME ?? "Tim";
  const shipboostDr = opts.shipboostDr ?? process.env.SHIPBOOST_DR ?? "44";

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
      templateKey: tmpl.key,
      subject: rendered.subject,
      body: rendered.bodyHtml,
      bodyText: rendered.bodyText,
    },
  });

  // silence unused-source-kind warning if it ever comes up
  void sourceKind;

  return { kind: "DRAFT_CREATED", draftId: draft.id, contactEmail: contact.email };
}
