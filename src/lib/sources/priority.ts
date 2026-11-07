import type { Prisma, SourceKind } from "@prisma/client";

/**
 * Sources whose launches jump the queue, both when scraping for an email and
 * when auto-sending. Their founders already pay for launches (ScrollLaunch
 * `premiumListing`, Nick Launches `featured`), so they are the warmest leads.
 */
export const PRIORITY_SOURCE_KINDS: SourceKind[] = ["SCROLLLAUNCH", "NICK_LAUNCHES"];

const PAID_LAUNCH: Prisma.LaunchWhereInput[] = [
  { raw: { path: ["premiumListing"], equals: true } },
  { raw: { path: ["featured"], equals: true } },
];

/**
 * Launch filters in priority order: paid launches from priority sources,
 * then their other launches, then everything else. Callers walk the tiers
 * and take the oldest match from the first tier that has one.
 */
export type LaunchPriorityTier = {
  source?: { kind: { in: SourceKind[] } };
  OR?: Prisma.LaunchWhereInput[];
};

export function launchPriorityTiers(): LaunchPriorityTier[] {
  const prioritySource = { source: { kind: { in: PRIORITY_SOURCE_KINDS } } };
  return [{ ...prioritySource, OR: PAID_LAUNCH }, prioritySource, {}];
}
