import { describe, it, expect } from "vitest";
import { isBlockedAddress, isFetchableUrl } from "@/lib/scrape/public-address";

describe("isBlockedAddress", () => {
  it("blocks loopback, private, link-local and metadata addresses", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "172.16.0.5", "192.168.1.1", "169.254.169.254", "100.64.0.1", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1",
      "::127.0.0.1", "64:ff9b::a9fe:a9fe", "64:ff9b:1::a00:1", "2002:a9fe:a9fe::1", "2001:0:4136:e378::1", "2001:db8::1",
      "192.0.2.10", "198.51.100.7", "203.0.113.9"]) {
      expect(isBlockedAddress(ip)).toBe(true);
    }
  });
  it("allows public addresses", () => {
    for (const ip of ["8.8.8.8", "104.16.0.1", "2606:4700::1111"]) expect(isBlockedAddress(ip)).toBe(false);
  });
});

describe("isFetchableUrl", () => {
  it("accepts plain public http(s) URLs", () => {
    expect(isFetchableUrl("https://notelifyapp.com/")).toBe(true);
    expect(isFetchableUrl("http://example.org/pricing")).toBe(true);
  });
  it("rejects internal hosts, odd ports, credentials and other schemes", () => {
    for (const url of [
      "http://169.254.169.254/latest/meta-data/",
      "http://localhost:3000/",
      "http://[::1]/",
      "https://example.com:8443/",
      "https://user:pass@example.com/",
      "ftp://example.com/",
      "file:///etc/passwd",
      "http://intranet/",
      "http://db.internal/",
    ]) expect(isFetchableUrl(url)).toBe(false);
  });
});
