import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getOutreachDiscount } from "@/lib/draft/discount";

const ORIGINAL = { ...process.env };

describe("getOutreachDiscount", () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL };
    delete process.env.PREMIUM_DISCOUNT_CODE;
    delete process.env.DISCOUNT_DEADLINE_DAYS;
  });
  afterEach(() => {
    process.env = { ...ORIGINAL };
  });

  it("defaults to LAUNCH9 + a 3-day deadline", () => {
    const now = new Date("2026-06-11T00:00:00Z");
    const d = getOutreachDiscount(now);
    expect(d.code).toBe("LAUNCH9");
    expect(d.deadline.toISOString()).toBe("2026-06-14T00:00:00.000Z");
  });

  it("honors PREMIUM_DISCOUNT_CODE and DISCOUNT_DEADLINE_DAYS", () => {
    process.env.PREMIUM_DISCOUNT_CODE = "FOUNDING9X";
    process.env.DISCOUNT_DEADLINE_DAYS = "5";
    const now = new Date("2026-06-11T00:00:00Z");
    const d = getOutreachDiscount(now);
    expect(d.code).toBe("FOUNDING9X");
    expect(d.deadline.toISOString()).toBe("2026-06-16T00:00:00.000Z");
  });

  it("falls back to the default window for invalid DISCOUNT_DEADLINE_DAYS", () => {
    process.env.DISCOUNT_DEADLINE_DAYS = "not-a-number";
    const now = new Date("2026-06-11T00:00:00Z");
    const d = getOutreachDiscount(now);
    expect(d.deadline.toISOString()).toBe("2026-06-14T00:00:00.000Z");
  });
});
