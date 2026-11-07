import { canonicalizeUrl } from "@/lib/scrape/fetch-html";

const SKIP_HOSTS = [
  "chrome.google.com",
  "apps.apple.com",
  "play.google.com",
  "github.com",
  "gitlab.com",
  "youtube.com",
  "youtu.be",
  "x.com",
  "twitter.com",
  "linkedin.com",
  "facebook.com",
  "instagram.com",
];

const TAGLINE_DENY = [
  /\b(buy|shop|store|order)\b/i,
  /\b(book|ebook|course|guide|template|kit)\s+(on|for|to|about)\b/i,
  /\bnewsletter\b/i,
  /\b(agency|consulting|consultancy|freelancer)\b/i,
  /\b(handmade|handcrafted|artisan)\b/i,
  /\b(apparel|clothing|t-shirt|hoodie|merch)\b/i,
  /\b(NFT|crypto wallet|token sale|ICO|trading bot|casino|gambling)\b/i,
  /\bphysical (product|good)/i,
  /\b(games?|gaming)\b/i,
  /\btest\b/i,
];

export function isRelevantLaunch(name: string, tagline?: string): boolean {
  const haystack = `${name} ${tagline ?? ""}`;
  return !TAGLINE_DENY.some((re) => re.test(haystack));
}

export function cleanExternalUrl(rawUrl: string, sourceHost: string): string | null {
  try {
    const url = new URL(rawUrl);
    url.hash = "";
    url.searchParams.delete("ref");
    for (const key of [...url.searchParams.keys()]) {
      if (key.startsWith("utm_")) url.searchParams.delete(key);
    }
    const clean = canonicalizeUrl(url.toString());
    const host = new URL(clean).hostname.replace(/^www\./, "").toLowerCase();
    if (host === sourceHost || host.endsWith(`.${sourceHost}`)) return null;
    if (SKIP_HOSTS.some((skipHost) => host === skipHost || host.endsWith(`.${skipHost}`))) return null;
    return clean;
  } catch {
    return null;
  }
}

export function cleanText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export type IsoWeek = { year: number; week: number; startsOn: Date };

/** ISO-8601 week (Monday start, UTC) that contains the given date. */
export function isoWeekOf(date: Date): IsoWeek {
  const day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const weekday = day.getUTCDay() || 7;
  const startsOn = new Date(day.getTime() - (weekday - 1) * 864e5);
  // The Thursday of this week decides which year the week belongs to.
  const thursday = new Date(startsOn.getTime() + 3 * 864e5);
  const year = thursday.getUTCFullYear();
  const week = Math.ceil(((thursday.getTime() - Date.UTC(year, 0, 1)) / 864e5 + 1) / 7);
  return { year, week, startsOn };
}

/** Every ISO week touched by [since, now], oldest first. For weekly launch boards. */
export function isoWeeksSince(since: Date, now: Date = new Date()): IsoWeek[] {
  const weeks: IsoWeek[] = [];
  let cursor = isoWeekOf(since);
  const last = isoWeekOf(now);
  while (cursor.startsOn.getTime() <= last.startsOn.getTime()) {
    weeks.push(cursor);
    cursor = isoWeekOf(new Date(cursor.startsOn.getTime() + 7 * 864e5));
  }
  return weeks;
}
