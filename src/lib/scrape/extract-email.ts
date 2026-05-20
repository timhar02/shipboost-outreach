import { load } from "cheerio";
import { fetchHtml } from "./fetch-html";

const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PERSONAL_DOMAINS = new Set([
  "gmail.com", "hey.com", "fastmail.com", "proton.me", "protonmail.com", "icloud.com", "me.com",
]);
const ROLE_LOCALS = new Set(["noreply", "no-reply", "donotreply"]);

export type DiscoveredFrom = "CONTACT_PAGE" | "ABOUT_PAGE" | "HOMEPAGE_FOOTER" | "MAILTO_LINK" | "META_TAG";
export type EmailHit = { email: string; name?: string; source: DiscoveredFrom };

export async function extractEmail(siteUrl: string): Promise<EmailHit | null> {
  const site = new URL(siteUrl);
  const siteDomain = site.hostname.replace(/^www\./, "").toLowerCase();

  const homepage = await fetchHtml(siteUrl);
  if (homepage) {
    const hit = scanHtml(homepage, siteDomain, "HOMEPAGE_FOOTER");
    if (hit) return hit;
  }
  for (const path of ["/contact", "/contact-us", "/about"]) {
    const url = new URL(path, site).toString();
    const html = await fetchHtml(url);
    if (!html) continue;
    const source: DiscoveredFrom = path === "/about" ? "ABOUT_PAGE" : "CONTACT_PAGE";
    const hit = scanHtml(html, siteDomain, source);
    if (hit) return hit;
  }
  return null;
}

function scanHtml(html: string, siteDomain: string, defaultSource: DiscoveredFrom): EmailHit | null {
  const $ = load(html);

  const mailtos = $("a[href^='mailto:']")
    .map((_, el) => String($(el).attr("href") || "").replace(/^mailto:/i, "").split("?")[0].trim())
    .get()
    .filter(Boolean);
  for (const m of mailtos) {
    if (isAcceptable(m, siteDomain)) return { email: m.toLowerCase(), source: "MAILTO_LINK" };
  }

  const meta = $("meta[property='og:email'], meta[name='email']").attr("content");
  if (meta && isAcceptable(meta, siteDomain)) return { email: meta.toLowerCase(), source: "META_TAG" };

  const text = $("body").text();
  const candidates = text.match(EMAIL_RE) ?? [];
  for (const raw of candidates) {
    if (!isAcceptable(raw, siteDomain)) continue;
    return { email: raw.toLowerCase(), name: guessNameNear(text, raw), source: defaultSource };
  }
  return null;
}

function isAcceptable(email: string, siteDomain: string): boolean {
  if (!/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(email)) return false;
  const [local, domain] = email.toLowerCase().split("@");
  if (!local || !domain) return false;
  if (ROLE_LOCALS.has(local)) return false;
  if (domain === siteDomain || domain.endsWith(`.${siteDomain}`) || siteDomain.endsWith(`.${domain}`)) return true;
  if (PERSONAL_DOMAINS.has(domain)) return /^[a-z]+(\.[a-z]+)?$/.test(local) && local.length >= 3;
  return false;
}

function guessNameNear(text: string, email: string): string | undefined {
  const idx = text.indexOf(email);
  if (idx < 0) return undefined;
  const window = text.slice(Math.max(0, idx - 200), idx);
  // Match both straight apostrophe (') and curly right apostrophe (')
  return window.match(/I['’]m ([A-Z][a-z]+)/)?.[1];
}
