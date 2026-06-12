import { describe, it, expect } from "vitest";
import { formatDeadline } from "@/lib/draft/format-deadline";

describe("formatDeadline", () => {
  it("formats a UTC date as 'Month D'", () => {
    expect(formatDeadline(new Date("2026-06-23T00:00:00Z"))).toBe("June 23");
  });
  it("stays on the UTC day regardless of local timezone", () => {
    // A UTC-midnight date must never display as the previous day.
    expect(formatDeadline(new Date("2026-01-01T00:00:00Z"))).toBe("January 1");
  });
});
