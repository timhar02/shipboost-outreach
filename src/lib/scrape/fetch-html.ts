import { lookup as dnsLookup, type LookupAddress } from "node:dns";
import { isIP } from "node:net";
import { Agent, buildConnector, interceptors, request, type Dispatcher } from "undici";
import robotsParser from "robots-parser";
import { isBlockedAddress, isFetchableUrl } from "@/lib/scrape/public-address";

const UA = "ShipBoost-Outreach/1.0 (+https://shipboost.com)";
const TIMEOUT_MS = 10_000;
const robotsCache = new Map<string, boolean>();

// Founder-submitted URLs are untrusted. Every connection (including each
// redirect hop) goes through a connector that refuses non-public addresses,
// both IP literals and whatever DNS resolves a hostname to.
let guardedAgent: Agent | undefined;
let redirectAgent: Dispatcher | undefined;

function guardedLookup(
  hostname: string,
  options: object,
  callback: (err: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) => void,
) {
  dnsLookup(hostname, options, (err, address, family) => {
    if (err) return callback(err, address, family);
    const addresses = Array.isArray(address) ? address.map((a) => a.address) : [address];
    if (addresses.some(isBlockedAddress)) {
      return callback(Object.assign(new Error(`Blocked non-public address for ${hostname}`), { code: "EBLOCKED" }), address, family);
    }
    callback(null, address, family);
  });
}

function getGuardedAgent(): Agent {
  if (!guardedAgent) {
    const connect = buildConnector({ lookup: guardedLookup } as buildConnector.BuildOptions);
    guardedAgent = new Agent({
      connect: (opts, cb) => {
        if (isIP(opts.hostname) && isBlockedAddress(opts.hostname)) {
          cb(new Error(`Blocked non-public address ${opts.hostname}`), null);
          return;
        }
        connect(opts, cb);
      },
    });
  }
  return guardedAgent;
}

/** Guarded agent with redirect following (up to 5 hops) baked in. */
function getRedirectAgent(): Dispatcher {
  redirectAgent ??= getGuardedAgent().compose(interceptors.redirect({ maxRedirections: 5 }));
  return redirectAgent;
}

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
  if (!isFetchableUrl(url)) return null;
  if (!(await checkRobots(url))) return null;
  try {
    const { statusCode, body, headers } = await request(url, {
      method: "GET",
      headers: { "user-agent": UA, "accept-language": "en-US,en;q=0.9", accept: "text/html,*/*" },
      headersTimeout: TIMEOUT_MS,
      bodyTimeout: TIMEOUT_MS,
      dispatcher: getRedirectAgent(),
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
    const origin = u.origin;
    const cached = robotsCache.get(origin);
    if (cached !== undefined) return cached;
    const robotsUrl = `${u.protocol}//${u.host}/robots.txt`;
    const { statusCode, body } = await request(robotsUrl, {
      method: "GET", headers: { "user-agent": UA },
      headersTimeout: 5_000, bodyTimeout: 5_000,
      dispatcher: getGuardedAgent(),
    });
    if (statusCode !== 200) {
      robotsCache.set(origin, true);
      return true;
    }
    const txt = await body.text();
    const allowed = robotsParser(robotsUrl, txt).isAllowed(url, UA) ?? true;
    robotsCache.set(origin, allowed);
    return allowed;
  } catch {
    return true;
  }
}

export async function jitter(minMs = 2000, maxMs = 5000): Promise<void> {
  const ms = Math.floor(minMs + Math.random() * (maxMs - minMs));
  await new Promise((r) => setTimeout(r, ms));
}
