#!/usr/bin/env node
/*
 * One-time backfill: pull the top-50 historical SaaS products from PeerPush
 * (/api/v1/products) and POST them to /api/ingest/launches as PEERPUSH source.
 *
 * Use this to bootstrap the funnel with ~30 SaaS-relevant prospects that
 * launched recently but aren't in the current week's "today launches" feed.
 *
 * Env required:
 *   INGEST_URL     - e.g. http://localhost:3000 or https://shipboost-outreach.vercel.app
 *   INGEST_SECRET  - matches INGEST_SECRET on the receiving app
 *
 * Run: node scripts/backfill-peerpush.mjs
 */

const INGEST_URL = process.env.INGEST_URL;
const INGEST_SECRET = process.env.INGEST_SECRET;
if (!INGEST_URL || !INGEST_SECRET) {
  console.error("INGEST_URL and INGEST_SECRET required");
  process.exit(2);
}

const ENDPOINT = "https://peerpush.net/api/v1/products?limit=50";

// PeerPush categories worth pitching ShipBoost to.
const ALLOW_CATEGORIES = new Set([
  "AI", "AI Tools", "AI Chat", "AI Writing", "AI Productivity Tools",
  "AI Governance", "AI Infrastructure",
  "Developer Tools", "No-Code / Low-Code", "Automation & Workflow",
  "Analytics & Monitoring", "SaaS Tools", "Productivity",
  "Marketing", "Product Marketing", "Sales", "CRM", "Customer Support",
  "Project Management", "Task Management",
  "Design Tools", "Email", "Forms", "Newsletters",
  "Website & Landing Page Builders", "Web Hosting",
  "Legal & Compliance", "Accounting", "Finance", "Fintech",
  "HR", "Recruiting",
  "Education Tools",
  "Security", "Privacy",
  "Social Media & Influencer Tools",
  "Video & Audio Tools",
  "Collaboration", "Team Communication",
  "API & Integrations", "Data & Databases", "DevOps",
  "E-commerce Tools", "Writing & Content", "Note Taking",
  "Open Source Tools",
]);

const TAGLINE_DENY = [
  /\b(buy|shop|store|order)\b/i,
  /\b(book|ebook|course|guide|template|kit)\s+(on|for|to)\b/i,
  /\bnewsletter\b/i,
  /\b(agency|consulting|consultancy|freelancer)\b/i,
  /\b(handmade|handcrafted|artisan)\b/i,
  /\b(apparel|clothing|t-shirt|hoodie|merch)\b/i,
];

function cleanUrl(raw) {
  try {
    const u = new URL(raw);
    u.searchParams.delete("ref");
    for (const k of [...u.searchParams.keys()]) {
      if (k.startsWith("utm_")) u.searchParams.delete(k);
    }
    return u.toString();
  } catch {
    return null;
  }
}

(async () => {
  console.log("Fetching PeerPush top-50 products…");
  const res = await fetch(ENDPOINT);
  if (!res.ok) {
    console.error(`PeerPush API ${res.status}`);
    process.exit(1);
  }
  const json = await res.json();
  const products = json.data ?? [];
  console.log(`Got ${products.length} products`);

  const launches = [];
  for (const p of products) {
    if (!p.websiteUrl) continue;
    const cats = p.categories ?? [];
    if (!cats.some((c) => ALLOW_CATEGORIES.has(c))) continue;
    const haystack = `${p.name} ${p.tagline ?? ""}`;
    if (TAGLINE_DENY.some((re) => re.test(haystack))) continue;

    const url = cleanUrl(p.websiteUrl);
    if (!url) continue;
    const host = new URL(url).hostname;
    if (host.endsWith("peerpush.net")) continue;
    if (host.endsWith("chrome.google.com") || host.endsWith("apps.apple.com")) continue;

    launches.push({
      externalId: p.id,
      name: p.name,
      tagline: p.tagline || undefined,
      url,
      launchedAt: p.publishedAt,
    });
  }

  console.log(`Filtered to ${launches.length} SaaS-relevant launches`);
  if (launches.length === 0) return;

  // POST in batches of 5 so ingest's per-call cap drains naturally.
  const CHUNK = 5;
  for (let i = 0; i < launches.length; i += CHUNK) {
    const chunk = launches.slice(i, i + CHUNK);
    console.log(`Batch ${Math.floor(i / CHUNK) + 1}: posting ${chunk.length} launches…`);
    const r = await fetch(`${INGEST_URL.replace(/\/$/, "")}/api/ingest/launches`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-ingest-secret": INGEST_SECRET,
      },
      body: JSON.stringify({ source: "PEERPUSH", launches: chunk }),
    });
    const body = await r.text();
    console.log(`  -> ${r.status} ${body}`);
    if (!r.ok) {
      console.error("Batch failed; stopping");
      process.exit(1);
    }
  }

  console.log("Done. Run /api/cron/process-pending to drain deferred launches.");
})();
