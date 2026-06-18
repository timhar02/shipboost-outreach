import { prisma } from "@/server/db/client";

export type SourceYieldRow = {
  source: string;
  launches: number;
  pending: number;
  draftsCreated: number;
  skippedNoEmail: number;
  skippedDedup: number;
  skippedError: number;
  draftRows: number;
  sent: number;
  bounced: number;
  replies: number;
  conversions: number;
  revenueCents: number;
};

type DbSourceYieldRow = {
  source: string;
  launches: bigint;
  pending: bigint;
  drafts_created: bigint;
  skipped_no_email: bigint;
  skipped_dedup: bigint;
  skipped_error: bigint;
  draft_rows: bigint;
  sent: bigint;
  bounced: bigint;
  replies: bigint;
  conversions: bigint;
  revenue_cents: bigint | null;
};

export async function getSourceYield(): Promise<SourceYieldRow[]> {
  const rows = await prisma.$queryRaw<DbSourceYieldRow[]>`
    SELECT
      s.kind::text AS source,
      COALESCE(lm.launches, 0) AS launches,
      COALESCE(lm.pending, 0) AS pending,
      COALESCE(lm.drafts_created, 0) AS drafts_created,
      COALESCE(lm.skipped_no_email, 0) AS skipped_no_email,
      COALESCE(lm.skipped_dedup, 0) AS skipped_dedup,
      COALESCE(lm.skipped_error, 0) AS skipped_error,
      COALESCE(dm.draft_rows, 0) AS draft_rows,
      COALESCE(dm.sent, 0) AS sent,
      COALESCE(dm.bounced, 0) AS bounced,
      COALESCE(em.replies, 0) AS replies,
      COALESCE(cm.conversions, 0) AS conversions,
      COALESCE(cm.revenue_cents, 0) AS revenue_cents
    FROM "Source" s
    LEFT JOIN (
      SELECT
        "sourceId",
        COUNT(*) AS launches,
        COUNT(*) FILTER (WHERE "processStatus" = 'PENDING') AS pending,
        COUNT(*) FILTER (WHERE "processStatus" = 'DRAFT_CREATED') AS drafts_created,
        COUNT(*) FILTER (WHERE "processStatus" = 'SKIPPED_NO_EMAIL') AS skipped_no_email,
        COUNT(*) FILTER (WHERE "processStatus" = 'SKIPPED_DEDUP') AS skipped_dedup,
        COUNT(*) FILTER (WHERE "processStatus" = 'SKIPPED_ERROR') AS skipped_error
      FROM "Launch"
      GROUP BY "sourceId"
    ) lm ON lm."sourceId" = s.id
    LEFT JOIN (
      SELECT
        l."sourceId",
        COUNT(d.id) AS draft_rows,
        COUNT(d.id) FILTER (WHERE d.status = 'SENT') AS sent,
        COUNT(d.id) FILTER (WHERE d.status = 'BOUNCED') AS bounced
      FROM "OutreachDraft" d
      JOIN "Contact" c ON c.id = d."contactId"
      JOIN "Launch" l ON l.id = c."launchId"
      GROUP BY l."sourceId"
    ) dm ON dm."sourceId" = s.id
    LEFT JOIN (
      SELECT
        l."sourceId",
        COUNT(e.id) FILTER (WHERE e.kind = 'REPLY') AS replies
      FROM "OutreachEvent" e
      JOIN "OutreachDraft" d ON d.id = e."draftId"
      JOIN "Contact" c ON c.id = d."contactId"
      JOIN "Launch" l ON l.id = c."launchId"
      GROUP BY l."sourceId"
    ) em ON em."sourceId" = s.id
    LEFT JOIN (
      SELECT
        l."sourceId",
        COUNT(cv.id) AS conversions,
        COALESCE(SUM(cv."amountCents"), 0) AS revenue_cents
      FROM "Conversion" cv
      JOIN "Contact" c ON c.id = cv."matchedContactId"
      JOIN "Launch" l ON l.id = c."launchId"
      GROUP BY l."sourceId"
    ) cm ON cm."sourceId" = s.id
    ORDER BY COALESCE(lm.drafts_created, 0) DESC, COALESCE(lm.launches, 0) DESC;
  `;

  return rows.map((row) => ({
    source: row.source,
    launches: Number(row.launches),
    pending: Number(row.pending),
    draftsCreated: Number(row.drafts_created),
    skippedNoEmail: Number(row.skipped_no_email),
    skippedDedup: Number(row.skipped_dedup),
    skippedError: Number(row.skipped_error),
    draftRows: Number(row.draft_rows),
    sent: Number(row.sent),
    bounced: Number(row.bounced),
    replies: Number(row.replies),
    conversions: Number(row.conversions),
    revenueCents: Number(row.revenue_cents ?? 0),
  }));
}
