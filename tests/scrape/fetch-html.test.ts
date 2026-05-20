import { describe, it, expect } from "vitest";
import { canonicalizeUrl } from "@/lib/scrape/fetch-html";

describe("canonicalizeUrl", () => {
  it("strips trailing slash and lowercases host", () => {
    expect(canonicalizeUrl("HTTPS://Example.COM/path/")).toBe("https://example.com/path");
  });
  it("preserves root slash", () => {
    expect(canonicalizeUrl("https://example.com/")).toBe("https://example.com/");
  });
  it("removes utm params", () => {
    expect(canonicalizeUrl("https://example.com/?utm_source=x&keep=1")).toBe("https://example.com/?keep=1");
  });
});
