#!/usr/bin/env node
/*
 * Scrape uneed.best "today's launches" via Playwright, resolve each tool's
 * real product URL from JSON-LD, and POST the batch to /api/ingest/launches.
 *
 * Env required:
 *   INGEST_URL     - e.g. https://shipboost-outreach.vercel.app
 *   INGEST_SECRET  - matches INGEST_SECRET on the receiving app
 *
 * Run: node scripts/scrape-uneed.mjs
 */
import { chromium } from "playwright";

const INGEST_URL = process.env.INGEST_URL;
const INGEST_SECRET = process.env.INGEST_SECRET;
if (!INGEST_URL || !INGEST_SECRET) {
  console.error("INGEST_URL and INGEST_SECRET required");
  process.exit(2);
}

const HOMEPAGE = "https://www.uneed.best/";
const TOOL_URL = (slug) => `https://www.uneed.best/tool/${slug}`;
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/130";
// Cap how many tools we resolve per run. Uneed shows ~10-20 launches/day.
const MAX_TOOLS = 25;

async function getTodaySlugs() {
  const browser = await chromium.launch({ headless: true });
  try {
    const ctx = await browser.newContext({ userAgent: UA });
    const page = await ctx.newPage();
    await page.goto(HOMEPAGE, { waitUntil: "domcontentloaded", timeout: 30_000 });
    // Wait for any tool link to appear (signal that products have hydrated).
    await page.waitForSelector('a[href^="/tool/"]', { timeout: 15_000 });
    // Give the "today" section a moment to fully populate.
    await page.waitForTimeout(2000);

    // Find the "Best products launching today" heading and grab the tool links
    // in its sibling container. Fallback: collect all visible tool links and dedupe.
    const slugs = await page.evaluate(() => {
      const wanted = new Set();

      const headings = Array.from(document.querySelectorAll("h1,h2,h3"));
      const todayHeading = headings.find((h) =>
        /launching today|products launching today/i.test(h.textContent || "")
      );

      if (todayHeading) {
        // Scope to the section containing the heading.
        let scope = todayHeading.parentElement;
        for (let i = 0; i < 5 && scope && scope.parentElement; i++) {
          if (scope.querySelectorAll('a[href^="/tool/"]').length >= 3) break;
          scope = scope.parentElement;
        }
        if (scope) {
          scope.querySelectorAll('a[href^="/tool/"]').forEach((a) => {
            const m = a.getAttribute("href").match(/^\/tool\/([^/?#]+)/);
            if (m) wanted.add(m[1]);
          });
        }
      }

      if (wanted.size === 0) {
        // Fallback: every tool link on the page, deduped.
        document.querySelectorAll('a[href^="/tool/"]').forEach((a) => {
          const m = a.getAttribute("href").match(/^\/tool\/([^/?#]+)/);
          if (m) wanted.add(m[1]);
        });
      }
      return Array.from(wanted);
    });

    return slugs.slice(0, MAX_TOOLS);
  } finally {
    await browser.close();
  }
}

async function resolveToolPage(slug) {
  const url = TOOL_URL(slug);
  const res = await fetch(url, { headers: { "user-agent": UA, accept: "text/html" } });
  if (!res.ok) return null;
  const html = await res.text();

  const jsonLdBlocks = [...html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g)];
  let externalUrl = null;
  let name = null;
  let description = null;
  let datePublished = null;

  function walk(node) {
    if (!node || typeof node !== "object") return;
    const type = node["@type"];
    if (type === "SoftwareApplication" || type === "Product") {
      if (!externalUrl && typeof node.url === "string" && !node.url.includes("uneed.best")) {
        externalUrl = node.url;
      }
      if (!name && typeof node.name === "string") name = node.name;
      if (!description && typeof node.description === "string") description = node.description;
      if (!datePublished && typeof node.datePublished === "string") datePublished = node.datePublished;
    }
    if (Array.isArray(node)) node.forEach(walk);
    else for (const v of Object.values(node)) walk(v);
  }

  for (const m of jsonLdBlocks) {
    try {
      walk(JSON.parse(m[1]));
    } catch {
      /* skip malformed */
    }
  }

  if (!externalUrl) return null;
  return {
    externalId: `uneed:${slug}`,
    name: name || slug,
    tagline: description ? description.slice(0, 200) : undefined,
    url: externalUrl,
    launchedAt: datePublished || new Date().toISOString(),
  };
}

async function postBatch(launches) {
  const res = await fetch(`${INGEST_URL.replace(/\/$/, "")}/api/ingest/launches`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-ingest-secret": INGEST_SECRET,
    },
    body: JSON.stringify({ source: "UNEED", launches }),
  });
  const body = await res.text();
  console.log(`Ingest response ${res.status}:`, body);
  if (!res.ok) process.exit(1);
}

(async () => {
  console.log("Scraping uneed.best…");
  const slugs = await getTodaySlugs();
  console.log(`Found ${slugs.length} tool slugs`);
  if (slugs.length === 0) {
    console.warn("No slugs found — selector may need adjustment");
    return;
  }

  const launches = [];
  for (const slug of slugs) {
    try {
      const launch = await resolveToolPage(slug);
      if (launch) {
        launches.push(launch);
        console.log(`  ✓ ${slug} -> ${launch.url}`);
      } else {
        console.log(`  - ${slug} skipped (no external URL in JSON-LD)`);
      }
    } catch (err) {
      console.log(`  ! ${slug} failed: ${err.message}`);
    }
    // Be polite between requests.
    await new Promise((r) => setTimeout(r, 300));
  }

  if (launches.length === 0) {
    console.log("No launches to ingest");
    return;
  }

  console.log(`POSTing ${launches.length} launches to ${INGEST_URL}`);
  await postBatch(launches);
})().catch((err) => {
  console.error("Scrape failed:", err);
  process.exit(1);
});
