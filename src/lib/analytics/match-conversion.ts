import { normalizeDomain } from "./normalize-domain";

/**
 * Attribute a paid conversion back to a cold-email contact, by confidence:
 *   1. domain match (product URL == contact domain) — survives a different
 *      purchase email, since the *product* identity travels even when the
 *      person identity doesn't. High confidence.
 *   2. email match (purchaser email == contact email). Medium.
 *   3. product-name similarity — never auto-counted; flagged POSSIBLE for a
 *      human to confirm, so fuzzy guesses can't pollute the headline numbers.
 * A matched contact only counts as email-driven if we actually SENT them
 * something on or before the purchase; otherwise it's ORGANIC.
 */

export type ContactDraftLite = {
  id: string;
  templateKey: string;
  status: string;
  sentAt: Date | null;
};

export type ContactLite = {
  id: string;
  email: string;
  domain: string;
  name: string | null;
  drafts: ContactDraftLite[];
};

export type ConversionInput = {
  websiteUrl: string;
  founderEmail: string | null;
  productName: string;
  paidAt: Date;
};

export type MatchStatus =
  | "MATCHED_DOMAIN"
  | "MATCHED_EMAIL"
  | "POSSIBLE"
  | "ORGANIC";

export type MatchResult = {
  status: MatchStatus;
  matchedContactId: string | null;
  matchedDraftId: string | null;
  matchedTemplateKey: string | null;
  confidence: number;
};

const DEFAULT_NAME_THRESHOLD = 0.6;

function organic(): MatchResult {
  return {
    status: "ORGANIC",
    matchedContactId: null,
    matchedDraftId: null,
    matchedTemplateKey: null,
    confidence: 0,
  };
}

function pickSentDraftBeforePaid(
  contact: ContactLite,
  paidAt: Date,
): ContactDraftLite | null {
  const sent = contact.drafts
    .filter(
      (draft) =>
        draft.status === "SENT" &&
        draft.sentAt !== null &&
        draft.sentAt.getTime() <= paidAt.getTime(),
    )
    .sort((a, b) => b.sentAt!.getTime() - a.sentAt!.getTime());

  return sent[0] ?? null;
}

function attribute(
  contact: ContactLite,
  paidAt: Date,
  status: "MATCHED_DOMAIN" | "MATCHED_EMAIL",
  confidence: number,
): MatchResult {
  const draft = pickSentDraftBeforePaid(contact, paidAt);
  if (!draft) {
    // We know this contact, but never emailed them before they bought.
    return organic();
  }

  return {
    status,
    matchedContactId: contact.id,
    matchedDraftId: draft.id,
    matchedTemplateKey: draft.templateKey,
    confidence,
  };
}

export function matchConversion(
  conversion: ConversionInput,
  contacts: ContactLite[],
  options?: { nameThreshold?: number },
): MatchResult {
  const domain = normalizeDomain(conversion.websiteUrl);
  const email = conversion.founderEmail?.trim().toLowerCase() || null;

  if (domain) {
    const byDomain = contacts.find((c) => normalizeDomain(c.domain) === domain);
    if (byDomain) return attribute(byDomain, conversion.paidAt, "MATCHED_DOMAIN", 1);
  }

  if (email) {
    const byEmail = contacts.find((c) => c.email.trim().toLowerCase() === email);
    if (byEmail) return attribute(byEmail, conversion.paidAt, "MATCHED_EMAIL", 0.7);
  }

  const threshold = options?.nameThreshold ?? DEFAULT_NAME_THRESHOLD;
  let best: ContactLite | null = null;
  let bestScore = 0;
  for (const candidate of contacts) {
    const score = stringSimilarity(conversion.productName, candidate.name ?? "");
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }

  if (best && bestScore >= threshold) {
    const draft = pickSentDraftBeforePaid(best, conversion.paidAt);
    return {
      status: "POSSIBLE",
      matchedContactId: best.id,
      matchedDraftId: draft?.id ?? null,
      matchedTemplateKey: draft?.templateKey ?? null,
      confidence: bestScore,
    };
  }

  return organic();
}

function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function bigrams(value: string): string[] {
  const result: string[] = [];
  for (let i = 0; i < value.length - 1; i += 1) {
    result.push(value.slice(i, i + 2));
  }
  return result;
}

/** Sørensen–Dice coefficient on character bigrams of the normalized names. */
export function stringSimilarity(a: string, b: string): number {
  const left = normalizeName(a);
  const right = normalizeName(b);
  if (!left || !right) return 0;
  if (left === right) return 1;

  const leftGrams = bigrams(left);
  const rightGrams = bigrams(right);
  if (leftGrams.length === 0 || rightGrams.length === 0) return 0;

  const counts = new Map<string, number>();
  for (const gram of leftGrams) {
    counts.set(gram, (counts.get(gram) ?? 0) + 1);
  }

  let intersection = 0;
  for (const gram of rightGrams) {
    const remaining = counts.get(gram) ?? 0;
    if (remaining > 0) {
      intersection += 1;
      counts.set(gram, remaining - 1);
    }
  }

  return (2 * intersection) / (leftGrams.length + rightGrams.length);
}
