import { load } from "cheerio";
import { fetchHtml } from "./fetch-html";

const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const CONTACT_LINK_RE = /\b(contact|about|team|support|help|press|media|imprint|legal|privacy|terms)\b/i;
const PERSONAL_DOMAINS = new Set([
  "gmail.com", "hey.com", "fastmail.com", "proton.me", "protonmail.com", "icloud.com", "me.com",
]);
const ROLE_LOCALS = new Set(["noreply", "no-reply", "donotreply", "privacy", "legal", "abuse", "security", "admin", "webmaster"]);
const PREFERRED_LOCALS = new Set(["founder", "hello", "contact", "team", "support", "sales", "info", "hi"]);

export type DiscoveredFrom = "CONTACT_PAGE" | "ABOUT_PAGE" | "HOMEPAGE_FOOTER" | "MAILTO_LINK" | "META_TAG";
export type EmailHit = { email: string; name?: string; source: DiscoveredFrom };

export async function extractEmail(siteUrl: string): Promise<EmailHit | null> {
  const site = new URL(siteUrl);
  const siteDomain = site.hostname.replace(/^www\./, "").toLowerCase();

  const homepage = await fetchHtml(siteUrl);
  const discoveredUrls: string[] = [];
  if (homepage) {
    const hit = scanHtml(homepage, siteDomain, "HOMEPAGE_FOOTER");
    if (hit) return hit;
    discoveredUrls.push(...discoverContactUrls(homepage, site));
  }
  const FALLBACK_PATHS = [
    "/contact", "/contact-us",
    "/about", "/about-us",
    "/contact.html", "/contact-us.html", "/company/contact",
    "/about.html", "/about-us.html", "/company", "/company/about",
    "/team", "/team.html", "/people",
    "/support", "/help", "/support/contact", "/help/contact",
    "/help-center", "/docs", "/developers", "/api",
    "/pricing", "/sales", "/demo", "/book-demo", "/request-demo",
    "/press", "/media",
    "/community",
    "/careers", "/jobs",
    "/imprint", "/legal", "/privacy", "/terms",
  ];
  const urls = uniqueUrls([
    ...discoveredUrls,
    ...FALLBACK_PATHS.map((path) => new URL(path, site).toString()),
  ], site);
  for (const url of urls) {
    const html = await fetchHtml(url);
    if (!html) continue;
    const path = new URL(url).pathname;
    const source = sourceForPath(path);
    const hit = scanHtml(html, siteDomain, source);
    if (hit) return hit;
  }
  return null;
}

function sourceForPath(path: string): DiscoveredFrom {
  if (/\b(contact|support|help|press|media|imprint|legal|privacy|terms)\b/i.test(path)) {
    return "CONTACT_PAGE";
  }
  if (/\b(about|company|team|people)\b/i.test(path)) return "ABOUT_PAGE";
  return "CONTACT_PAGE";
}

function scanHtml(html: string, siteDomain: string, defaultSource: DiscoveredFrom): EmailHit | null {
  const $ = load(html);
  const hits: EmailHit[] = [];

  const mailtos = $("a[href^='mailto:']")
    .map((_, el) => String($(el).attr("href") || "").replace(/^mailto:/i, "").split("?")[0].trim())
    .get()
    .filter(Boolean);
  for (const m of mailtos) {
    if (isAcceptable(m, siteDomain)) hits.push({ email: cleanEmailCandidate(m), source: "MAILTO_LINK" });
  }

  $("[data-cfemail]").each((_, el) => {
    const encoded = String($(el).attr("data-cfemail") || "");
    const decoded = decodeCloudflareEmail(encoded);
    if (decoded && isAcceptable(decoded, siteDomain)) hits.push({ email: decoded.toLowerCase(), source: defaultSource });
  });

  const meta = $("meta[property='og:email'], meta[name='email']").attr("content");
  if (meta && isAcceptable(meta, siteDomain)) hits.push({ email: cleanEmailCandidate(meta), source: "META_TAG" });

  const text = $("body").text();
  const candidates = findEmailCandidates(`${text}\n${html}`);
  for (const raw of candidates) {
    const email = cleanEmailCandidate(raw);
    if (!isAcceptable(email, siteDomain)) continue;
    hits.push({ email: email.toLowerCase(), name: guessNameNear(text, raw), source: defaultSource });
  }

  return rankHits(hits, siteDomain)[0] ?? null;
}

function discoverContactUrls(html: string, site: URL): string[] {
  const $ = load(html);
  return $("a[href]")
    .map((_, el) => {
      const $el = $(el);
      const href = String($el.attr("href") || "").trim();
      const label = `${$el.text()} ${href}`;
      if (!CONTACT_LINK_RE.test(label)) return "";
      try {
        const url = new URL(href, site);
        if (url.protocol !== "http:" && url.protocol !== "https:") return "";
        if (url.hostname.replace(/^www\./, "").toLowerCase() !== site.hostname.replace(/^www\./, "").toLowerCase()) return "";
        url.hash = "";
        return url.toString();
      } catch {
        return "";
      }
    })
    .get()
    .filter(Boolean);
}

function uniqueUrls(urls: string[], site: URL): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const siteDomain = site.hostname.replace(/^www\./, "").toLowerCase();
  for (const raw of urls) {
    try {
      const url = new URL(raw);
      if (url.hostname.replace(/^www\./, "").toLowerCase() !== siteDomain) continue;
      url.hash = "";
      const key = url.toString();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(key);
    } catch {
      /* skip */
    }
  }
  return out;
}

function findEmailCandidates(raw: string): string[] {
  const candidates: string[] = raw.match(EMAIL_RE) ?? [];
  const normalized = normalizeObfuscatedEmails(raw);
  if (normalized !== raw) candidates.push(...(normalized.match(EMAIL_RE) ?? []));
  return candidates;
}

function cleanEmailCandidate(raw: string): string {
  const email = raw.toLowerCase().replace(/^mailto:/, "").replace(/[),.;:]+$/g, "").trim();
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  const role = local.match(/(hello|support|contact|sales|info|team|help)$/)?.[1];
  if (role && local !== role) return `${role}@${domain}`;
  return email;
}

function normalizeObfuscatedEmails(raw: string): string {
  return raw
    .replace(/\s+(?:\[|\()?at(?:\]|\))?\s+/gi, "@")
    .replace(/\s+(?:\[|\()?dot(?:\]|\))?\s+/gi, ".")
    .replace(/\s*\[\s*@\s*\]\s*/g, "@")
    .replace(/\s*\(\s*@\s*\)\s*/g, "@");
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

function rankHits(hits: EmailHit[], siteDomain: string): EmailHit[] {
  const seen = new Map<string, EmailHit>();
  for (const hit of hits) {
    if (!seen.has(hit.email)) seen.set(hit.email, hit);
  }
  return [...seen.values()].sort((a, b) => scoreHit(b, siteDomain) - scoreHit(a, siteDomain));
}

function scoreHit(hit: EmailHit, siteDomain: string): number {
  const [local, domain] = hit.email.split("@");
  let score = 0;
  if (domain === siteDomain || domain.endsWith(`.${siteDomain}`)) score += 50;
  if (PREFERRED_LOCALS.has(local)) score += 20;
  if (local === "founder" || local === "hello") score += 10;
  if (hit.source === "MAILTO_LINK") score += 8;
  if (hit.source === "CONTACT_PAGE") score += 5;
  if (hit.name) score += 5;
  return score;
}

function decodeCloudflareEmail(encoded: string): string | null {
  if (!/^[a-f0-9]+$/i.test(encoded) || encoded.length < 4 || encoded.length % 2 !== 0) return null;
  const key = Number.parseInt(encoded.slice(0, 2), 16);
  let out = "";
  for (let i = 2; i < encoded.length; i += 2) {
    out += String.fromCharCode(Number.parseInt(encoded.slice(i, i + 2), 16) ^ key);
  }
  return out.includes("@") ? out : null;
}

function guessNameNear(text: string, email: string): string | undefined {
  const idx = text.indexOf(email);
  if (idx < 0) return undefined;
  const window = text.slice(Math.max(0, idx - 200), idx);
  // Match both straight apostrophe (') and curly right apostrophe (')
  return window.match(/I['’]m ([A-Z][a-z]+)/)?.[1];
}
