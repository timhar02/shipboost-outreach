#!/usr/bin/env node
/*
 * Pull the last N weekly boards from ScrollLaunch and Nick Launches and report
 * how many launches were paid (ScrollLaunch `premiumListing`, Nick Launches
 * `featured`). Writes a CSV of every launch for deeper digging.
 *
 * Run: node scripts/competitor-premium-study.mjs [weeks=12] [out.csv]
 * Both APIs are public; calls are spaced out to stay polite.
 */
import { writeFileSync } from "node:fs";

const WEEKS = Number(process.argv[2] ?? 12);
const OUT = process.argv[3] ?? "competitor-launches.csv";
const UA = "ShipBoost-Research/1.0 (+https://shipboost.io)";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url) {
  const res = await fetch(url, { headers: { "user-agent": UA, accept: "application/json" } });
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.json();
}

function isoWeek(date) {
  const day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const thursday = new Date(day.getTime() + (4 - (day.getUTCDay() || 7)) * 864e5);
  const year = thursday.getUTCFullYear();
  return { year, week: Math.ceil(((thursday - Date.UTC(year, 0, 1)) / 864e5 + 1) / 7) };
}

const rows = [];
for (let i = WEEKS - 1; i >= 0; i--) {
  const { year, week } = isoWeek(new Date(Date.now() - i * 7 * 864e5));
  const label = `${year}-W${String(week).padStart(2, "0")}`;

  const sl = await getJson(`https://www.scrolllaunch.com/v1/leaderboard?week=${label}&limit=100`);
  for (const p of sl.products ?? []) {
    rows.push({ source: "scrolllaunch", week: label, name: p.name, website: p.website, paid: !!p.premiumListing, upvotes: p.upvotes, categories: (p.categories ?? []).join("|"), listing: p.url });
  }
  await sleep(700);

  const nl = await getJson(`https://nicklaunches.com/api/v1/feed/week/?year=${year}&week=${week}`);
  for (const p of nl.items ?? []) {
    rows.push({ source: "nicklaunches", week: label, name: p.name, website: p.url, paid: !!p.featured, upvotes: p.upvotes, categories: (p.categories ?? []).join("|"), listing: p.productUrl });
  }
  await sleep(1500);
}

const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
const columns = ["source", "week", "name", "website", "paid", "upvotes", "categories", "listing"];
writeFileSync(OUT, [columns.join(","), ...rows.map((r) => columns.map((c) => esc(r[c])).join(","))].join("\n"));

for (const source of ["scrolllaunch", "nicklaunches"]) {
  const mine = rows.filter((r) => r.source === source);
  const byWeek = new Map();
  for (const r of mine) {
    const w = byWeek.get(r.week) ?? { all: 0, paid: 0 };
    w.all++;
    if (r.paid) w.paid++;
    byWeek.set(r.week, w);
  }
  const paid = mine.filter((r) => r.paid).length;
  console.log(`\n${source}: ${mine.length} launches, ${paid} paid (${mine.length ? Math.round((100 * paid) / mine.length) : 0}%)`);
  console.log("  week launches/paid:", [...byWeek].map(([w, v]) => `${w.slice(5)} ${v.all}/${v.paid}`).join("  "));
}
console.log(`\nWrote ${rows.length} rows to ${OUT}`);
