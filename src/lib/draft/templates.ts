import type { Template } from "./select";

// Update SLOTS_LEFT as Premium Launch founding spots fill.
const SLOTS_LEFT = 7;
const SLOTS_TOTAL = 20;
const CTA_URL = "https://shipboost.io/submit";
const SIG = `<p>{{sender_first_name}}<br/><a href="https://shipboost.io">shipboost.io</a></p>`;

export const templates: Template[] = [
  {
    key: "out-01-spike-diagnosis-named",
    subject: "{{product_name}} past launch day",
    bodyHtml: `<p>Hey {{first_name}},</p>
<p>Saw {{product_name}} go live. Most launches earn a spike on day one and then nothing happens. Most directories turn into a dead listing nobody comes back to.</p>
<p>ShipBoost handles both jobs. Distribution this week, plus a permanent listing that keeps showing up in categories, tags, and alternatives pages months later.</p>
<p>Premium Launch is $9 right now (founding price, ${SLOTS_LEFT} of ${SLOTS_TOTAL} spots left). You pick your launch week, get featured placement, and our editor writes a spotlight piece that lives on shipboost.io/blog with a DR {{shipboost_dr}} dofollow link to {{website_domain}}.</p>
<p>If that fits: <a href="${CTA_URL}">${CTA_URL}</a></p>
${SIG}`,
  },
  {
    key: "out-02-direct-question-noname",
    subject: "quick question about {{product_name}}",
    bodyHtml: `<p>Hey,</p>
<p>{{product_name}} just shipped. Honest question, what's the plan for week two?</p>
<p>Launch traffic is a one time event. The buyer searching for what you do next month won't see the launch. They'll see whatever shows up in categories and alternatives lists.</p>
<p>That's the gap ShipBoost is built for. Permanent listing that keeps working past launch week, plus a hand written editorial piece on our blog with a DR {{shipboost_dr}} dofollow link to {{website_domain}}.</p>
<p>Premium Launch is $9 during founding right now. ${SLOTS_LEFT} of ${SLOTS_TOTAL} slots left.</p>
<p><a href="${CTA_URL}">${CTA_URL}</a></p>
${SIG}`,
  },
  {
    key: "out-03-anti-definition-named",
    subject: "{{product_name}}",
    bodyHtml: `<p>Hey {{first_name}},</p>
<p>ShipBoost isn't a Product Hunt clone. Not a generic AI tools list. Not a startup cemetery either. It's a listing that keeps earning trust through categories, tags, and alternatives pages after launch week ends.</p>
<p>Premium Launch is $9 right now (${SLOTS_LEFT} of ${SLOTS_TOTAL} spots left). You pick the week, get featured placement, and we publish a hand written editorial spotlight on /blog with a DR {{shipboost_dr}} dofollow backlink.</p>
<p>If {{website_domain}} should still be findable in a month: <a href="${CTA_URL}">${CTA_URL}</a></p>
${SIG}`,
  },
  {
    key: "out-04-mechanic-first-noname",
    subject: "about {{product_name}}",
    bodyHtml: `<p>Hey,</p>
<p>A launch should turn into a public asset. Something buyers can find, compare, and come back to after the launch window closes. Most directories don't do that work. ShipBoost does.</p>
<p>{{product_name}} just launched. {{tagline}}. The listing should keep earning trust through categories, tags, and alternatives when the right buyer is searching later.</p>
<p>Premium Launch covers it. $9 founding price, ${SLOTS_LEFT} of ${SLOTS_TOTAL} spots left. Reserved launch week, permanent listing, plus an editorial spotlight on the blog with a DR {{shipboost_dr}} dofollow link to {{website_domain}}.</p>
<p><a href="${CTA_URL}">${CTA_URL}</a></p>
${SIG}`,
  },
  {
    key: "out-05-week-two-named",
    subject: "{{product_name}} in week two",
    bodyHtml: `<p>Hey {{first_name}},</p>
<p>Saw the {{product_name}} launch. Week one usually takes care of itself. Week two is where most launches go quiet.</p>
<p>ShipBoost keeps the listing useful past launch day, instead of letting it turn into dead archive furniture. Categories, tags, and alternatives pages keep working when buyers search later.</p>
<p>Premium Launch is $9 during founding right now (${SLOTS_LEFT} of ${SLOTS_TOTAL} slots left). Reserved launch week, permanent listing, editorial spotlight on /blog with a DR {{shipboost_dr}} dofollow link.</p>
<p>For {{website_domain}}: <a href="${CTA_URL}">${CTA_URL}</a></p>
${SIG}`,
  },
  {
    key: "out-06-observation-noname",
    subject: "{{product_name}}",
    bodyHtml: `<p>Hey,</p>
<p>{{tagline}}. That's clear positioning. Already more than most launch posts earn.</p>
<p>The question now is whether the buyer who didn't see launch day will find {{website_domain}} in a month. ShipBoost handles that part. Permanent listing, categories, tags, alternatives pages, plus a hand written spotlight on the blog with a DR {{shipboost_dr}} dofollow link.</p>
<p>$9 founding price right now. ${SLOTS_LEFT} of ${SLOTS_TOTAL} slots left.</p>
<p><a href="${CTA_URL}">${CTA_URL}</a></p>
${SIG}`,
  },
  {
    key: "out-07-short-named",
    subject: "{{product_name}}",
    bodyHtml: `<p>Hey {{first_name}},</p>
<p>{{product_name}} just shipped. Nice work.</p>
<p>ShipBoost is the listing for {{website_domain}} that keeps working past launch week. Premium Launch is $9 during founding (${SLOTS_LEFT} of ${SLOTS_TOTAL} spots). Reserved launch week, permanent listing, editorial spotlight on /blog with a DR {{shipboost_dr}} dofollow link.</p>
<p><a href="${CTA_URL}">${CTA_URL}</a></p>
${SIG}`,
  },
  {
    key: "out-08-noun-forward-named",
    subject: "a listing that keeps working: {{product_name}}",
    bodyHtml: `<p>Hey {{first_name}},</p>
<p>Saw {{product_name}} launch. A listing should be a working tool, not a trophy. ShipBoost gives {{website_domain}} a place buyers can discover, compare, and return to after the launch rotates off the front page.</p>
<p>Premium Launch is $9 during founding. ${SLOTS_LEFT} of ${SLOTS_TOTAL} spots left. Reserved launch week, permanent listing, plus a ShipBoost editorial spotlight (DR {{shipboost_dr}} dofollow backlink) written during your launch period.</p>
<p><a href="${CTA_URL}">${CTA_URL}</a></p>
${SIG}`,
  },
  {
    key: "out-09-trust-named",
    subject: "{{product_name}} and trust after launch",
    bodyHtml: `<p>Hey {{first_name}},</p>
<p>{{tagline}}. Strong positioning.</p>
<p>Most founders treat trust like a post launch problem. Launch first, build credibility later. In practice it usually works the other way around. The listing that's still working in month two is the one buyers compare against alternatives.</p>
<p>ShipBoost builds that listing for {{website_domain}}. Premium Launch is $9 right now (${SLOTS_LEFT} of ${SLOTS_TOTAL} slots) and includes an editorial spotlight on the blog with a DR {{shipboost_dr}} dofollow backlink.</p>
<p><a href="${CTA_URL}">${CTA_URL}</a></p>
${SIG}`,
  },
  {
    key: "out-10-second-job-noname",
    subject: "{{product_name}} and the second job",
    bodyHtml: `<p>Hey,</p>
<p>Most launches do one job. Get a spike. {{product_name}} just did that.</p>
<p>The second job is harder. Keep getting discovered when launch week ends. ShipBoost handles that part. Permanent listing, categories, tags, alternatives pages, plus an editor written spotlight on /blog (DR {{shipboost_dr}} dofollow).</p>
<p>$9 founding price right now. ${SLOTS_LEFT} of ${SLOTS_TOTAL} slots left.</p>
<p>If {{website_domain}} should keep showing up: <a href="${CTA_URL}">${CTA_URL}</a></p>
${SIG}`,
  },
  {
    key: "out-11-quiet-named",
    subject: "{{product_name}}",
    bodyHtml: `<p>Hey {{first_name}},</p>
<p>{{product_name}} just hit the board. Congrats.</p>
<p>The quiet part of a launch is week three. Launch traffic has rotated, the X post is buried, and the listing, if there is one, is dead archive furniture. ShipBoost is the listing that keeps working past week three.</p>
<p>Premium Launch is $9 during founding (${SLOTS_LEFT} of ${SLOTS_TOTAL} spots). Reserved launch week, permanent listing, editorial spotlight on /blog with a DR {{shipboost_dr}} dofollow link to {{website_domain}}.</p>
<p><a href="${CTA_URL}">${CTA_URL}</a></p>
${SIG}`,
  },
  {
    key: "out-12-positioning-noname",
    subject: "{{product_name}} and positioning past launch",
    bodyHtml: `<p>Hey,</p>
<p>{{tagline}} reads like real positioning, not a launch day line. That earns a longer second life. If the listing exists to support it.</p>
<p>ShipBoost is where {{website_domain}} stays discoverable after launch week rotates. Categories, tags, alternatives pages. Plus a hand written editorial spotlight on /blog (DR {{shipboost_dr}} dofollow backlink).</p>
<p>Premium Launch is $9 right now during founding. ${SLOTS_LEFT} of ${SLOTS_TOTAL} spots left.</p>
<p><a href="${CTA_URL}">${CTA_URL}</a></p>
${SIG}`,
  },
];
