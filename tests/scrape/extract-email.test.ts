import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const fx = (n: string) => readFileSync(join(__dirname, "fixtures", `${n}.html`), "utf8");

vi.mock("@/lib/scrape/fetch-html", () => ({
  fetchHtml: vi.fn(),
  canonicalizeUrl: (u: string) => u,
  jitter: async () => {},
}));

import { fetchHtml } from "@/lib/scrape/fetch-html";
import { extractEmail } from "@/lib/scrape/extract-email";

beforeEach(() => { vi.mocked(fetchHtml).mockReset(); });

describe("extractEmail", () => {
  it("finds email in footer text on homepage", async () => {
    vi.mocked(fetchHtml).mockResolvedValueOnce(fx("footer"));
    const r = await extractEmail("https://trywavefly.com");
    expect(r).toEqual({ email: "sarah@trywavefly.com", name: undefined, source: "HOMEPAGE_FOOTER" });
  });

  it("finds mailto link on homepage", async () => {
    vi.mocked(fetchHtml).mockResolvedValueOnce(fx("mailto"));
    const r = await extractEmail("https://acme.io");
    expect(r?.email).toBe("founder@acme.io");
    expect(r?.source).toBe("MAILTO_LINK");
  });

  it("falls back to /contact when homepage has none", async () => {
    vi.mocked(fetchHtml)
      .mockResolvedValueOnce("<html><body>nothing</body></html>")
      .mockResolvedValueOnce(fx("contact-page"));
    const r = await extractEmail("https://acme.io");
    expect(r?.email).toBe("hi@acme.io");
    expect(r?.source).toBe("CONTACT_PAGE");
  });

  it("falls back to /about and extracts founder name", async () => {
    vi.mocked(fetchHtml)
      .mockResolvedValueOnce("<html><body>nothing</body></html>")           // homepage
      .mockResolvedValueOnce("<html><body>still nothing</body></html>")     // /contact
      .mockResolvedValueOnce("<html><body>still nothing</body></html>")     // /contact-us
      .mockResolvedValueOnce(fx("about-page"));                              // /about
    const r = await extractEmail("https://acme.io");
    expect(r?.email).toBe("marc@acme.io");
    expect(r?.name).toBe("Marc");
    expect(r?.source).toBe("ABOUT_PAGE");
  });

  it("rejects emails on mismatched domain", async () => {
    vi.mocked(fetchHtml).mockResolvedValueOnce(
      "<html><body><a href='mailto:somebody@otherdomain.com'>x</a></body></html>",
    );
    const r = await extractEmail("https://acme.io");
    expect(r).toBeNull();
  });

  it("accepts role-account email when domain matches", async () => {
    vi.mocked(fetchHtml).mockResolvedValueOnce(fx("role-only"));
    const r = await extractEmail("https://acme.io");
    expect(r?.email).toBe("support@acme.io");
  });

  it("returns null when nothing found", async () => {
    vi.mocked(fetchHtml).mockResolvedValue("<html><body>empty</body></html>");
    const r = await extractEmail("https://acme.io");
    expect(r).toBeNull();
  });
});
