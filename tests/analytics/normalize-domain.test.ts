import { describe, it, expect } from "vitest";

import { normalizeDomain } from "@/lib/analytics/normalize-domain";

describe("normalizeDomain", () => {
  it("strips scheme, www, path, query, and lowercases", () => {
    expect(normalizeDomain("https://www.SheepieSleep.com/submit?ref=1")).toBe(
      "sheepiesleep.com",
    );
    expect(normalizeDomain("http://sheepiesleep.com")).toBe("sheepiesleep.com");
    expect(normalizeDomain("SheepieSleep.com")).toBe("sheepiesleep.com");
    expect(normalizeDomain("https://sheepiesleep.com:8080/")).toBe(
      "sheepiesleep.com",
    );
  });

  it("returns empty string for missing/invalid input", () => {
    expect(normalizeDomain(null)).toBe("");
    expect(normalizeDomain(undefined)).toBe("");
    expect(normalizeDomain("   ")).toBe("");
  });

  it("keeps subdomains other than www", () => {
    expect(normalizeDomain("https://app.acme.io/x")).toBe("app.acme.io");
  });
});
