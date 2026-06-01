/**
 * Pure aggregation of conversion rows into the dashboard view models.
 * Kept free of Prisma so it's trivially testable; the page feeds it plain rows.
 */

export type StatConversion = {
  type: "PREMIUM_LAUNCH" | "AD";
  matchStatus:
    | "MATCHED_DOMAIN"
    | "MATCHED_EMAIL"
    | "POSSIBLE"
    | "CONFIRMED"
    | "REJECTED"
    | "ORGANIC";
  amountCents: number;
  matchedTemplateKey: string | null;
  paidAt: Date;
  matchedSentAt: Date | null;
};

const ATTRIBUTED_STATUSES = new Set([
  "MATCHED_DOMAIN",
  "MATCHED_EMAIL",
  "CONFIRMED",
]);

export function isAttributed(status: StatConversion["matchStatus"]): boolean {
  return ATTRIBUTED_STATUSES.has(status);
}

export type SplitRow = {
  type: "PREMIUM_LAUNCH" | "AD";
  total: number;
  emailed: number;
  organic: number;
  pendingReview: number;
  emailedPct: number;
};

export type TemplateRow = {
  templateKey: string;
  sent: number;
  converted: number;
  conversionRate: number;
  revenueCents: number;
};

export type ConversionStats = {
  split: SplitRow[];
  byTemplate: TemplateRow[];
  revenue: { totalCents: number; premiumCents: number; adCents: number };
  medianDaysToConvert: number | null;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

export function computeConversionStats(
  conversions: StatConversion[],
  sentCountsByTemplate: Map<string, number>,
): ConversionStats {
  const types: Array<"PREMIUM_LAUNCH" | "AD"> = ["PREMIUM_LAUNCH", "AD"];

  const split: SplitRow[] = types.map((type) => {
    const rows = conversions.filter((c) => c.type === type);
    const emailed = rows.filter((c) => isAttributed(c.matchStatus)).length;
    const pendingReview = rows.filter((c) => c.matchStatus === "POSSIBLE").length;
    const organic = rows.length - emailed - pendingReview;
    return {
      type,
      total: rows.length,
      emailed,
      organic,
      pendingReview,
      emailedPct: rows.length === 0 ? 0 : (emailed / rows.length) * 100,
    };
  });

  const attributed = conversions.filter((c) => isAttributed(c.matchStatus));

  const convertedByTemplate = new Map<string, { count: number; revenue: number }>();
  for (const conversion of attributed) {
    const key = conversion.matchedTemplateKey;
    if (!key) continue;
    const entry = convertedByTemplate.get(key) ?? { count: 0, revenue: 0 };
    entry.count += 1;
    entry.revenue += conversion.amountCents;
    convertedByTemplate.set(key, entry);
  }

  const templateKeys = new Set<string>([
    ...sentCountsByTemplate.keys(),
    ...convertedByTemplate.keys(),
  ]);

  const byTemplate: TemplateRow[] = [...templateKeys]
    .map((templateKey) => {
      const sent = sentCountsByTemplate.get(templateKey) ?? 0;
      const converted = convertedByTemplate.get(templateKey)?.count ?? 0;
      return {
        templateKey,
        sent,
        converted,
        conversionRate: sent === 0 ? 0 : (converted / sent) * 100,
        revenueCents: convertedByTemplate.get(templateKey)?.revenue ?? 0,
      };
    })
    .sort((a, b) => b.conversionRate - a.conversionRate || b.converted - a.converted);

  const revenue = attributed.reduce(
    (acc, conversion) => {
      acc.totalCents += conversion.amountCents;
      if (conversion.type === "PREMIUM_LAUNCH") acc.premiumCents += conversion.amountCents;
      else acc.adCents += conversion.amountCents;
      return acc;
    },
    { totalCents: 0, premiumCents: 0, adCents: 0 },
  );

  const daysToConvert = attributed
    .filter((c) => c.matchedSentAt !== null)
    .map((c) => (c.paidAt.getTime() - c.matchedSentAt!.getTime()) / MS_PER_DAY)
    .filter((days) => days >= 0);

  return {
    split,
    byTemplate,
    revenue,
    medianDaysToConvert: median(daysToConvert),
  };
}
