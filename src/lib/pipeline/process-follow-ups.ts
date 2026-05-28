import { prisma } from "@/server/db/client";
import { pollReplies } from "@/lib/gmail/replies";
import { followUpTemplates } from "@/lib/draft/follow-up-templates";
import { selectTemplate } from "@/lib/draft/select";
import { renderTemplate } from "@/lib/draft/render";

const FOLLOW_UP_AFTER_DAYS = 5;

export function followUpsEnabled(): boolean {
  return process.env.FOLLOW_UPS_ENABLED === "1";
}

export async function runFollowUps(): Promise<{ replied: number; followUpsQueued: number; disabled?: boolean }> {
  const { matched } = await pollReplies();

  if (!followUpsEnabled()) {
    return { replied: matched, followUpsQueued: 0, disabled: true };
  }

  const cutoff = new Date(Date.now() - FOLLOW_UP_AFTER_DAYS * 24 * 60 * 60 * 1000);
  const candidates = await prisma.outreachDraft.findMany({
    where: {
      status: "SENT", sentAt: { lt: cutoff }, parentDraftId: null,
      events: { none: { kind: { in: ["REPLY", "FOLLOWUP_SENT"] } } },
    },
    include: { contact: { include: { launch: true } } },
  });

  const senderFirstName = process.env.SENDER_FIRST_NAME ?? "Tim";
  const shipboostDr = process.env.SHIPBOOST_DR ?? "44";
  let queued = 0;

  for (const parent of candidates) {
    const c = parent.contact;
    const eligible = c.name ? followUpTemplates : followUpTemplates.filter((t) => t.key.endsWith("-noname"));
    const pool = eligible.length ? eligible : followUpTemplates;
    const tmpl = selectTemplate(c.domain, pool);

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
