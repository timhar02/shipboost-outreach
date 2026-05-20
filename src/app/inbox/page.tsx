import { prisma } from "@/server/db/client";
import { InboxClient, type DraftView } from "./InboxClient";

export const dynamic = "force-dynamic";

export default async function InboxPage() {
  const rows = await prisma.outreachDraft.findMany({
    where: { status: "PENDING_REVIEW" },
    orderBy: { createdAt: "desc" },
    include: { contact: { include: { launch: true } } },
  });
  const sentToday = await prisma.outreachDraft.count({
    where: { status: "SENT", sentAt: { gte: new Date(new Date().setHours(0,0,0,0)) } },
  });
  const drafts: DraftView[] = rows.map((d) => ({
    id: d.id,
    subject: d.subject,
    bodyHtml: d.body,
    templateKey: d.templateKey,
    contact: {
      email: d.contact.email, name: d.contact.name, domain: d.contact.domain,
      discoveredFrom: d.contact.discoveredFrom,
    },
    launch: { name: d.contact.launch.name, tagline: d.contact.launch.tagline, url: d.contact.launch.url },
  }));
  return <InboxClient drafts={drafts} sentToday={sentToday} />;
}
