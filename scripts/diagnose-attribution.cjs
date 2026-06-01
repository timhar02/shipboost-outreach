const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

// Same normalization the matcher uses.
function normalizeDomain(input) {
  if (!input) return "";
  let v = String(input).trim().toLowerCase();
  if (!v) return "";
  v = v.replace(/^[a-z][a-z0-9+.-]*:\/\//, "");
  v = (v.split(/[/?#]/)[0]) ?? "";
  const at = v.lastIndexOf("@");
  if (at !== -1) v = v.slice(at + 1);
  v = (v.split(":")[0]) ?? "";
  v = v.replace(/^www\./, "");
  v = v.replace(/\.+$/, "");
  return v;
}
// "loose" = apex domain (last two labels), to catch subdomain/format drift.
function apex(d) {
  const parts = normalizeDomain(d).split(".");
  return parts.length <= 2 ? parts.join(".") : parts.slice(-2).join(".");
}

(async () => {
  const organic = await p.conversion.findMany({
    where: { type: "PREMIUM_LAUNCH", matchStatus: "ORGANIC" },
    orderBy: { paidAt: "asc" },
  });
  const contacts = await p.contact.findMany({
    select: {
      id: true, email: true, domain: true, name: true,
      drafts: { select: { status: true, sentAt: true, templateKey: true } },
    },
  });

  const byDomain = new Map();
  const byApex = new Map();
  const byEmail = new Map();
  for (const c of contacts) {
    byDomain.set(normalizeDomain(c.domain), c);
    byApex.set(apex(c.domain), c);
    byEmail.set(c.email.trim().toLowerCase(), c);
  }

  let exactContactNoSend = 0, exactSentAfter = 0, looseOnly = 0, emailOnly = 0, trulyOrganic = 0;

  console.log(`\nInspecting ${organic.length} ORGANIC premium launches:\n`);
  for (const conv of organic) {
    const d = conv.websiteDomain;
    const email = (conv.founderEmail || "").trim().toLowerCase();
    const exact = byDomain.get(d);
    const loose = byApex.get(apex(d));
    const eHit = email ? byEmail.get(email) : null;
    const hit = exact || eHit || loose;

    let reason;
    if (hit) {
      const sent = hit.drafts.filter((x) => x.status === "SENT" && x.sentAt);
      const sentBeforePaid = sent.some((x) => x.sentAt.getTime() <= conv.paidAt.getTime());
      const anySent = sent.length > 0;
      if (exact && !anySent) { reason = "DOMAIN match but contact NEVER SENT (in pipeline, not emailed)"; exactContactNoSend++; }
      else if (exact && anySent && !sentBeforePaid) { reason = "DOMAIN match but sent AFTER purchase"; exactSentAfter++; }
      else if (!exact && eHit) { reason = "EMAIL match only (domain differs)"; emailOnly++; }
      else if (!exact && loose) { reason = `APEX-only match (conv '${d}' vs contact '${loose.domain}')`; looseOnly++; }
      else { reason = "matched but unclear"; }
    } else {
      reason = "no contact by domain/apex/email — genuinely not in outreach list";
      trulyOrganic++;
    }
    console.log(`• ${conv.productName.padEnd(22)} ${d.padEnd(26)} ${email.padEnd(30)} -> ${reason}`);
  }

  console.log("\n=== SUMMARY of the 'organic' bucket ===");
  console.log("DOMAIN match, never sent (pipeline):", exactContactNoSend);
  console.log("DOMAIN match, sent AFTER purchase:  ", exactSentAfter);
  console.log("EMAIL-only match (domain differs):  ", emailOnly, "  <- these SHOULD have matched on email; investigate");
  console.log("APEX-only (normalization drift):    ", looseOnly, "  <- potential matcher improvement");
  console.log("Truly organic (no contact at all):  ", trulyOrganic);
  await p.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
