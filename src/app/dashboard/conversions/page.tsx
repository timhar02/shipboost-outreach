import { prisma } from "@/server/db/client";
import {
  computeConversionStats,
  isAttributed,
  type StatConversion,
} from "@/lib/analytics/conversion-stats";
import { ConversionsClient, type PossibleMatch } from "./ConversionsClient";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

export default async function ConversionsPage() {
  const [conversions, sentGroups, syncState] = await Promise.all([
    prisma.conversion.findMany({ orderBy: { paidAt: "desc" } }),
    prisma.outreachDraft.groupBy({
      by: ["templateKey"],
      where: { status: "SENT" },
      _count: { _all: true },
    }),
    prisma.conversionSyncState.findUnique({ where: { id: "default" } }),
  ]);

  const sentCountsByTemplate = new Map<string, number>(
    sentGroups.map((row) => [row.templateKey, row._count._all]),
  );

  // Resolve send timestamps for attributed conversions, for time-to-convert.
  const matchedDraftIds = conversions
    .filter((c) => isAttributed(c.matchStatus) && c.matchedDraftId)
    .map((c) => c.matchedDraftId as string);
  const sentAtByDraft = new Map<string, Date | null>(
    matchedDraftIds.length > 0
      ? (
          await prisma.outreachDraft.findMany({
            where: { id: { in: matchedDraftIds } },
            select: { id: true, sentAt: true },
          })
        ).map((draft) => [draft.id, draft.sentAt])
      : [],
  );

  const statRows: StatConversion[] = conversions.map((c) => ({
    type: c.type,
    matchStatus: c.matchStatus,
    amountCents: c.amountCents,
    matchedTemplateKey: c.matchedTemplateKey,
    paidAt: c.paidAt,
    matchedSentAt: c.matchedDraftId
      ? sentAtByDraft.get(c.matchedDraftId) ?? null
      : null,
  }));

  const stats = computeConversionStats(statRows, sentCountsByTemplate);

  // Review queue: name-similarity matches awaiting a human decision.
  const possibleIds = conversions
    .filter((c) => c.matchStatus === "POSSIBLE" && c.matchedContactId)
    .map((c) => c.matchedContactId as string);
  const contactsById = new Map(
    possibleIds.length > 0
      ? (
          await prisma.contact.findMany({
            where: { id: { in: possibleIds } },
            select: { id: true, name: true, domain: true, email: true },
          })
        ).map((contact) => [contact.id, contact])
      : [],
  );

  const possibleMatches: PossibleMatch[] = conversions
    .filter((c) => c.matchStatus === "POSSIBLE")
    .map((c) => {
      const contact = c.matchedContactId ? contactsById.get(c.matchedContactId) : null;
      return {
        id: c.id,
        type: c.type,
        productName: c.productName,
        websiteDomain: c.websiteDomain,
        amountCents: c.amountCents,
        paidAt: c.paidAt.toISOString(),
        confidence: c.matchConfidence ?? 0,
        contactName: contact?.name ?? null,
        contactDomain: contact?.domain ?? null,
        templateKey: c.matchedTemplateKey,
      };
    });

  return (
    <ConversionsClient
      stats={stats}
      possibleMatches={possibleMatches}
      totalConversions={conversions.length}
      lastRunAt={syncState?.lastRunAt?.toISOString() ?? null}
    />
  );
}
