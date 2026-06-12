/**
 * The cold-outreach Premium Launch offer: ONE permanent discount code (created
 * by hand in Dodo) plus a per-recipient deadline computed at send time.
 *
 * The deadline is intentionally a soft/marketing deadline — the code does not
 * actually expire in Dodo. Each first-touch email shows "closes <today + N days>"
 * so it reads as personal and urgent. Follow-ups never mention the code.
 */

const DEFAULT_CODE = "LAUNCH9";
const DEFAULT_DEADLINE_DAYS = 3;

export type OutreachDiscount = {
  code: string;
  /** Marketing "good through" date (today + window). */
  deadline: Date;
};

export function getOutreachDiscount(now: Date = new Date()): OutreachDiscount {
  const code = process.env.PREMIUM_DISCOUNT_CODE ?? DEFAULT_CODE;
  const days = Number(process.env.DISCOUNT_DEADLINE_DAYS ?? DEFAULT_DEADLINE_DAYS);
  const window = Number.isFinite(days) && days > 0 ? days : DEFAULT_DEADLINE_DAYS;
  return { code, deadline: new Date(now.getTime() + window * 24 * 60 * 60 * 1000) };
}
