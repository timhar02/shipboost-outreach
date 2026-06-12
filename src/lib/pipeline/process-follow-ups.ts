import { prisma } from "@/server/db/client";
import { pollReplies } from "@/lib/gmail/replies";
import { followUpTemplates } from "@/lib/draft/follow-up-templates";
import { selectTemplate } from "@/lib/draft/select";
import { renderTemplate } from "@/lib/draft/render";

const FOLLOW_UP_AFTER_DAYS = 5;
const CONVERSION_BLOCK_STATUSES = ["MATCHED_DOMAIN", "MATCHED_EMAIL", "POSSIBLE", "CONFIRMED"] as const;

export function followUpsEnabled(): boolean {
  return process.env.FOLLOW_UPS_ENABLED === "1";
}

export async function runFollowUps(): Promise<{ replied: number; followUpsQueued: number; disabled?: boolean }> {
  const { matched } = await pollReplies();

  if (!followUpsEnabled()) {
    return { replied: matched, followUpsQueued: 0, disabled: true };
  }

  const cutoff = new Date(Date.now() - FOLLOW_UP_AFTER_DAYS * 24 * 60 * 60 * 1000);
  const conversions = await prisma.conversion.findMany({
    where: {
      matchStatus: { in: [...CONVERSION_BLOCK_STATUSES] },
      OR: [
        { matchedContactId: { not: null } },
        { matchedDraftId: { not: null } },
      ],
    },
    select: { matchedContactId: true, matchedDraftId: true },
  });
  const convertedContactIds = conversions
    .map((conversion) => conversion.matchedContactId)
    .filter((id): id is string => Boolean(id));
  const convertedDraftIds = conversions
    .map((conversion) => conversion.matchedDraftId)
    .filter((id): id is string => Boolean(id));

  const candidates = await prisma.outreachDraft.findMany({
    where: {
      status: "SENT", sentAt: { lt: cutoff }, parentDraftId: null,
      ...(convertedContactIds.length ? { contactId: { notIn: convertedContactIds } } : {}),
      ...(convertedDraftIds.length ? { id: { notIn: convertedDraftIds } } : {}),
      events: { none: { kind: { in: ["REPLY", "FOLLOWUP_SENT"] } } },
    },
    include: { contact: { include: { launch: true } } },
  });

  const senderFirstName = process.env.SENDER_FIRST_NAME ?? "Tim";
  const shipboostDr = process.env.SHIPBOOST_DR ?? "45";
  let queued = 0;

  for (const parent of candidates) {
    const c = parent.contact;
    const eligible = c.name ? followUpTemplates : followUpTemplates.filter((t) => t.key.endsWith("-noname"));
    const pool = eligible.length ? eligible : followUpTemplates;
    const tmpl = selectTemplate(c.domain, pool);

    // Follow-ups intentionally omit the discount code/price. The weekly code may
    // have expired by the time a follow-up sends, so these stay value + CTA only.
    const rendered = renderTemplate(tmpl, {
      first_name: c.name ?? undefined,
      product_name: c.launch.name,
      tagline: c.launch.tagline ?? c.launch.name,
      website_domain: c.domain,
      sender_first_name: senderFirstName,
      shipboost_dr: shipboostDr,
    });

    await prisma.$transaction([
      prisma.outreachDraft.create({
        data: {
          contactId: c.id, parentDraftId: parent.id, templateKey: tmpl.key,
          subject: rendered.subject.startsWith("Re:") ? rendered.subject : `Re: ${parent.subject}`,
          body: rendered.bodyHtml, bodyText: rendered.bodyText,
        },
      }),
      prisma.outreachEvent.create({ data: { draftId: parent.id, kind: "FOLLOWUP_SENT", payload: {} } }),
    ]);
    queued++;
  }
  return { replied: matched, followUpsQueued: queued };
}
