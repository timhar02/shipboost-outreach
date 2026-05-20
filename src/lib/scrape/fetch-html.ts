import { Agent, interceptors, request } from "undici";
import robotsParser from "robots-parser";

const UA = "ShipBoost-Outreach/1.0 (+https://shipboost.com)";
const TIMEOUT_MS = 10_000;

/** Agent with redirect following (up to 5 hops) baked in. */
const redirectAgent = new Agent().compose(interceptors.redirect({ maxRedirections: 5 }));

export function canonicalizeUrl(input: string): string {
  const u = new URL(input);
  u.hostname = u.hostname.toLowerCase();
  for (const k of [...u.searchParams.keys()]) {
    if (k.startsWith("utm_")) u.searchParams.delete(k);
  }
  let s = u.toString();
  if (u.pathname !== "/" && s.endsWith("/")) s = s.slice(0, -1);
  return s;
}

export async function fetchHtml(url: string): Promise<string | null> {
  if (!(await checkRobots(url))) return null;
  try {
    const { statusCode, body, headers } = await request(url, {
      method: "GET",
      headers: { "user-agent": UA, "accept-language": "en-US,en;q=0.9", accept: "text/html,*/*" },
      headersTimeout: TIMEOUT_MS,
      bodyTimeout: TIMEOUT_MS,
      dispatcher: redirectAgent,
    });
    if (statusCode < 200 || statusCode >= 300) return null;
    const ct = String(headers["content-type"] || "");
    if (!ct.includes("text/html")) return null;
    return await body.text();
  } catch {
    return null;
  }
}

async function checkRobots(url: string): Promise<boolean> {
  try {
    const u = new URL(url);
    const robotsUrl = `${u.protocol}//${u.host}/robots.txt`;
    const { statusCode, body } = await request(robotsUrl, {
      method: "GET", headers: { "user-agent": UA },
      headersTimeout: 5_000, bodyTimeout: 5_000,
    });
    if (statusCode !== 200) return true;
    const txt = await body.text();
    return robotsParser(robotsUrl, txt).isAllowed(url, UA) ?? true;
  } catch {
    return true;
  }
}

export async function jitter(minMs = 2000, maxMs = 5000): Promise<void> {
  const ms = Math.floor(minMs + Math.random() * (maxMs - minMs));
  await new Promise((r) => setTimeout(r, ms));
}
