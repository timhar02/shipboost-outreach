import { prisma } from "@/server/db/client";
import { DashboardClient, type Card, type Bucket } from "./DashboardClient";
import { sourceUrl, sourceLabel } from "@/lib/sources/source-url";

export const dynamic = "force-dynamic";

const FOLLOWUP_DAYS = 5;

export default async function DashboardPage() {
  const drafts = await prisma.outreachDraft.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      contact: { include: { launch: { include: { source: true } } } },
      events: { select: { kind: true, createdAt: true } },
    },
  });

  // eslint-disable-next-line react-hooks/purity -- Server dashboard buckets need the current time for follow-up status.
  const now = Date.now();
  const cutoff = now - FOLLOWUP_DAYS * 24 * 60 * 60 * 1000;

  function classify(d: (typeof drafts)[number]): Bucket {
    if (d.status === "SKIPPED" || d.status === "FAILED") return "archive";
    const kinds = new Set(d.events.map((e) => e.kind));
    if (kinds.has("REPLY")) return "replied";
    if (kinds.has("FOLLOWUP_SENT")) return "followed_up";
    if (d.status === "SENT") {
      if (d.sentAt && d.sentAt.getTime() < cutoff) return "awaiting_followup";
      if (kinds.has("OPEN")) return "opened";
      return "sent";
    }
    return "pending";
  }

  const cards: Card[] = drafts.map((d) => {
    const opens = d.events.filter((e) => e.kind === "OPEN");
    return {
      id: d.id,
      bucket: classify(d),
      subject: d.subject,
      templateKey: d.templateKey,
      status: d.status,
      sentAt: d.sentAt?.toISOString() ?? null,
      createdAt: d.createdAt.toISOString(),
      openCount: opens.length,
      lastOpenAt: opens.at(-1)?.createdAt.toISOString() ?? null,
      hasFollowUp: d.events.some((e) => e.kind === "FOLLOWUP_SENT"),
      hasReply: d.events.some((e) => e.kind === "REPLY"),
      contact: {
        email: d.contact.email,
        name: d.contact.name,
        domain: d.contact.domain,
      },
      launch: {
        name: d.contact.launch.name,
        tagline: d.contact.launch.tagline,
        url: d.contact.launch.url,
      },
      source: {
        kind: d.contact.launch.source.kind,
        label: sourceLabel(d.contact.launch.source.kind),
        url: sourceUrl(d.contact.launch.source.kind, d.contact.launch.externalId, d.contact.launch.raw),
      },
    };
  });

  return <DashboardClient cards={cards} />;
}
