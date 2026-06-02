import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/server/db/client";
import { extractContext } from "@/lib/scrape/extract-context";
import { personalize } from "@/lib/draft/personalize";
import { renderTemplate, type RenderVars } from "@/lib/draft/render";
import { selectTemplate } from "@/lib/draft/select";
import { hybridTemplates } from "@/lib/draft/hybrid-templates";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
export const maxDuration = 60;

/**
 * Regenerate PENDING_REVIEW drafts with LLM-personalized opener + subject,
 * rendered through the hybrid templates (which keep Premium Launch pitch,
 * editorial spotlight bonus, and DR-45 dofollow consistent on every email).
 *
 * Drains the queue in batches: each call processes up to BATCH drafts that
 * don't yet have a hybrid template_key.
 *
 * Auth: CRON_SECRET header (same as the cron routes).
 *
 * GET /api/admin/redraft  →  process next batch
 */

const BATCH = 5;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const headerSecret =
      req.headers.get("x-cron-secret") ??
      req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (headerSecret !== secret) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
  }

  if (!process.env.OPENROUTER_API_KEY) {
    return NextResponse.json({ ok: false, error: "OPENROUTER_API_KEY missing" }, { status: 500 });
  }

  const llmModel = process.env.LLM_MODEL ?? "openai/gpt-oss-120b:free";
  const senderFirstName = process.env.SENDER_FIRST_NAME ?? "Tim";
  const shipboostDr = process.env.SHIPBOOST_DR ?? "45";

  // Find PENDING_REVIEW drafts that haven't been migrated to a hybrid template yet.
  const drafts = await prisma.outreachDraft.findMany({
    where: {
      status: "PENDING_REVIEW",
      NOT: { templateKey: { startsWith: "hyb-" } },
    },
    include: { contact: { include: { launch: true } } },
    orderBy: { createdAt: "asc" },
    take: BATCH,
  });

  const result = {
    claimed: drafts.length,
    redrafted: 0,
    failed: 0,
    failures: [] as { draftId: string; error: string }[],
  };

  for (let i = 0; i < drafts.length; i++) {
    const d = drafts[i];
    if (i > 0) await new Promise((r) => setTimeout(r, 4000)); // OpenRouter free tier: 16 req/min
    try {
      const ctx = await extractContext(d.contact.launch.url);
      const personalized = await personalize(
        {
          productName: d.contact.launch.name,
          tagline: d.contact.launch.tagline ?? undefined,
          websiteDomain: d.contact.domain,
          firstName: d.contact.name ?? undefined,
          context: ctx,
        },
        { model: llmModel, maxRetries: 1 },
      );

      const hybTmpl = selectTemplate(d.contact.domain, hybridTemplates);
      const rendered = renderTemplate(hybTmpl, {
        first_name: d.contact.name ?? undefined,
        product_name: d.contact.launch.name,
        tagline: d.contact.launch.tagline ?? d.contact.launch.name,
        website_domain: d.contact.domain,
        sender_first_name: senderFirstName,
        shipboost_dr: shipboostDr,
        personalized_subject: personalized.subject,
        personalized_opener: personalized.opener,
      } as RenderVars);

      await prisma.outreachDraft.update({
        where: { id: d.id },
        data: {
          templateKey: hybTmpl.key,
          subject: rendered.subject,
          body: rendered.bodyHtml,
          bodyText: rendered.bodyText,
        },
      });
      result.redrafted++;
    } catch (err) {
      result.failed++;
      result.failures.push({ draftId: d.id, error: err instanceof Error ? err.message : String(err) });
    }
  }

  const remaining = await prisma.outreachDraft.count({
    where: {
      status: "PENDING_REVIEW",
      NOT: { templateKey: { startsWith: "hyb-" } },
    },
  });

  return NextResponse.json({ ok: true, ...result, remaining });
}
