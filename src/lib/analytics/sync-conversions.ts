import { prisma } from "@/server/db/client";
import { matchConversion, type ContactLite } from "@/lib/analytics/match-conversion";
import { normalizeDomain } from "@/lib/analytics/normalize-domain";

/**
 * Pull newly-paid conversions from the main ShipBoost app (separate DB) and
 * attribute each to a cold-email contact. Idempotent: keyed on the source id,
 * so re-runs upsert. Manual review decisions (CONFIRMED / REJECTED) are never
 * overwritten by a re-sync.
 */

const SYNC_STATE_ID = "default";

type RemoteConversion = {
  sourceId: string;
  type: "PREMIUM_LAUNCH" | "AD";
  websiteUrl: string;
  productName: string;
  founderEmail: string | null;
  paidAt: string;
  amountCents: number;
  currency: string;
};

export type SyncResult = {
  pulled: number;
  upserted: number;
  skippedManual: number;
  lastPaidAt: string | null;
};

export async function syncConversions(): Promise<SyncResult> {
  const baseUrl = process.env.MYAPP_CONVERSIONS_URL;
  const secret = process.env.MYAPP_CONVERSIONS_SECRET;
  if (!baseUrl) {
    throw new Error("MYAPP_CONVERSIONS_URL is not configured.");
  }

  const state = await prisma.conversionSyncState.findUnique({
    where: { id: SYNC_STATE_ID },
  });

  // Back the cursor off slightly so same-timestamp rows are never skipped;
  // re-pulled rows are harmless because the upsert is idempotent.
  const url = new URL(baseUrl);
  if (state?.lastPaidAt) {
    url.searchParams.set(
      "since",
      new Date(state.lastPaidAt.getTime() - 1000).toISOString(),
    );
  }

  const response = await fetch(url, {
    headers: secret ? { "x-conversions-secret": secret } : {},
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Conversions pull failed: ${response.status}`);
  }

  const payload = (await response.json()) as {
    data: { conversions: RemoteConversion[] };
  };
  const remote = payload.data.conversions ?? [];

  const contacts = await loadContacts();

  let upserted = 0;
  let skippedManual = 0;
  let maxPaidAt = state?.lastPaidAt ?? null;

  for (const record of remote) {
    const paidAt = new Date(record.paidAt);
    if (!maxPaidAt || paidAt.getTime() > maxPaidAt.getTime()) {
      maxPaidAt = paidAt;
    }

    const existing = await prisma.conversion.findUnique({
      where: { id: record.sourceId },
    });

    const baseData = {
      type: record.type,
      websiteDomain: normalizeDomain(record.websiteUrl),
      founderEmail: record.founderEmail,
      productName: record.productName,
      amountCents: record.amountCents,
      currency: record.currency,
      paidAt,
    };

    // Don't re-attribute something a human already decided on.
    if (
      existing &&
      (existing.matchStatus === "CONFIRMED" || existing.matchStatus === "REJECTED")
    ) {
      await prisma.conversion.update({ where: { id: record.sourceId }, data: baseData });
      skippedManual += 1;
      continue;
    }

    const match = matchConversion(
      {
        websiteUrl: record.websiteUrl,
        founderEmail: record.founderEmail,
        productName: record.productName,
        paidAt,
      },
      contacts,
    );

    const matchData = {
      matchStatus: match.status,
      matchedContactId: match.matchedContactId,
      matchedDraftId: match.matchedDraftId,
      matchedTemplateKey: match.matchedTemplateKey,
      matchConfidence: match.confidence,
    };

    await prisma.conversion.upsert({
      where: { id: record.sourceId },
      create: { id: record.sourceId, ...baseData, ...matchData },
      update: { ...baseData, ...matchData },
    });
    upserted += 1;
  }

  await prisma.conversionSyncState.upsert({
    where: { id: SYNC_STATE_ID },
    create: { id: SYNC_STATE_ID, lastPaidAt: maxPaidAt, lastRunAt: new Date() },
    update: { lastPaidAt: maxPaidAt, lastRunAt: new Date() },
  });

  return {
    pulled: remote.length,
    upserted,
    skippedManual,
    lastPaidAt: maxPaidAt?.toISOString() ?? null,
  };
}

async function loadContacts(): Promise<ContactLite[]> {
  const contacts = await prisma.contact.findMany({
    select: {
      id: true,
      email: true,
      domain: true,
      name: true,
      drafts: {
        select: { id: true, templateKey: true, status: true, sentAt: true },
      },
    },
  });

  return contacts.map((contact) => ({
    id: contact.id,
    email: contact.email,
    domain: contact.domain,
    name: contact.name,
    drafts: contact.drafts.map((draft) => ({
      id: draft.id,
      templateKey: draft.templateKey,
      status: draft.status,
      sentAt: draft.sentAt,
    })),
  }));
}
