import type { Template } from "./select";

const CTA_URL = "https://shipboost.io/submit";
const SIG = `<p>— {{sender_first_name}}<br/><a href="https://shipboost.io">shipboost.io</a></p>`;

export const templates: Template[] = [
  {
    key: "out-01-spike-diagnosis-named",
    subject: "{{product_name}} — past launch day",
    bodyHtml: `<p>Hey {{first_name}},</p>
<p>Saw {{product_name}} go live. Most launches earn a spike and then nothing. Most directories give you a dead listing.</p>
<p>ShipBoost is built to do both jobs: distribution this week, discoverability through categories, tags, and alternatives pages after the launch window rotates.</p>
<p>Premium Launch is $9 right now — founding price, first 100 only. It reserves your launch week, holds a permanent listing, and includes a ShipBoost editorial spotlight written during your launch period.</p>
<p>If that fits {{website_domain}}: <a href="${CTA_URL}">${CTA_URL}</a></p>
${SIG}`,
  },
  {
    key: "out-02-direct-question-noname",
    subject: "quick question about {{product_name}}",
    bodyHtml: `<p>Hey,</p>
<p>{{product_name}} just shipped. Genuine question — what's the plan for week two?</p>
<p>Launch-day traffic is a one-time event. The buyer searching for what you do next month won't see the launch. They'll see whatever ranks. ShipBoost gives {{website_domain}} a listing that keeps showing up past launch week through categories, tags, and alternatives pages.</p>
<p>Premium Launch is $9 — reserves your launch week, permanent listing, editorial spotlight included.</p>
<p><a href="${CTA_URL}">${CTA_URL}</a></p>
${SIG}`,
  },
  {
    key: "out-03-anti-definition-named",
    subject: "{{product_name}}",
    bodyHtml: `<p>Hey {{first_name}},</p>
<p>ShipBoost isn't a Product Hunt clone. Not a generic AI tools list. Not a startup cemetery. It's a listing that keeps earning trust through categories, tags, and alternatives pages after launch week ends.</p>
<p>Premium Launch ($9, first 100 only): reserved launch week, permanent listing, ShipBoost editorial spotlight written during your launch period.</p>
<p>If {{website_domain}} should still be findable in a month: <a href="${CTA_URL}">${CTA_URL}</a></p>
${SIG}`,
  },
  {
    key: "out-04-mechanic-first-noname",
    subject: "about {{product_name}}",
    bodyHtml: `<p>Hey,</p>
<p>A launch becomes a public asset: something buyers can discover, compare, and come back to after launch week rotates. Most directories don't do that work. ShipBoost does.</p>
<p>{{product_name}} just launched. {{tagline}}. The listing should keep earning trust through categories, tags, and alternatives pages when the right buyer is searching later.</p>
<p>Premium Launch is $9 — reserves your launch week and includes an editorial spotlight during the launch period.</p>
<p>For {{website_domain}}: <a href="${CTA_URL}">${CTA_URL}</a></p>
${SIG}`,
  },
  {
    key: "out-05-week-two-named",
    subject: "{{product_name}} in week two",
    bodyHtml: `<p>Hey {{first_name}},</p>
<p>Saw the {{product_name}} launch. Week one usually takes care of itself. Week two is where most launches go quiet.</p>
<p>ShipBoost keeps the listing useful past launch day instead of letting it turn into dead archive furniture. Categories, tags, and alternatives pages keep working when buyers search later.</p>
<p>Premium Launch is $9 right now (founding, first 100): reserved launch week, permanent listing, editorial spotlight included.</p>
<p>For {{website_domain}}: <a href="${CTA_URL}">${CTA_URL}</a></p>
${SIG}`,
  },
  {
    key: "out-06-observation-noname",
    subject: "{{product_name}}",
    bodyHtml: `<p>Hey,</p>
<p>{{tagline}} — clear enough that I clicked through. That's already more than most launch posts earn.</p>
<p>The question now is whether the buyer who didn't see launch day will find {{website_domain}} in a month. ShipBoost is built to handle that part: discoverability after the launch window ends.</p>
<p>Premium Launch covers reserved launch week, permanent listing, and an editorial spotlight written during your launch period. $9 founding price, first 100.</p>
<p><a href="${CTA_URL}">${CTA_URL}</a></p>
${SIG}`,
  },
  {
    key: "out-07-short-named",
    subject: "{{product_name}}",
    bodyHtml: `<p>Hey {{first_name}},</p>
<p>{{product_name}} just shipped — nice work.</p>
<p>ShipBoost is the listing for {{website_domain}} that keeps working past launch week. Premium Launch is $9 (first 100): reserved launch week, permanent listing, editorial spotlight included.</p>
<p><a href="${CTA_URL}">${CTA_URL}</a></p>
${SIG}`,
  },
  {
    key: "out-08-noun-forward-named",
    subject: "a listing that keeps working — {{product_name}}",
    bodyHtml: `<p>Hey {{first_name}},</p>
<p>Saw {{product_name}} launch. A listing should be a working tool, not a trophy. ShipBoost gives {{website_domain}} a place buyers can discover, compare, and come back to after the launch rotates off the front page.</p>
<p>Premium Launch ($9 founding): reserved launch week, permanent listing, plus a ShipBoost editorial spotlight during your launch period.</p>
<p><a href="${CTA_URL}">${CTA_URL}</a></p>
${SIG}`,
  },
  {
    key: "out-09-trust-named",
    subject: "{{product_name}} — trust after launch",
    bodyHtml: `<p>Hey {{first_name}},</p>
<p>{{tagline}}. Strong positioning.</p>
<p>Most founders treat trust like a post-launch problem — launch first, build credibility later. In practice it usually works the other way around. The listing that's still working in month two is the one buyers compare against alternatives.</p>
<p>ShipBoost builds that listing for {{website_domain}}. Premium Launch is $9 right now and includes an editorial spotlight written during your launch period.</p>
<p><a href="${CTA_URL}">${CTA_URL}</a></p>
${SIG}`,
  },
  {
    key: "out-10-second-job-noname",
    subject: "{{product_name}} — the second job",
    bodyHtml: `<p>Hey,</p>
<p>Most launches do one job: get a spike. {{product_name}} just did that.</p>
<p>The second job is harder — keep getting discovered when launch week ends. ShipBoost handles that part. Categories, tags, and alternatives pages that stay useful after the front page rotates.</p>
<p>Premium Launch is $9 founding price: reserved launch week, permanent listing, editorial spotlight bundled in.</p>
<p>If {{website_domain}} should keep showing up: <a href="${CTA_URL}">${CTA_URL}</a></p>
${SIG}`,
  },
  {
    key: "out-11-quiet-named",
    subject: "{{product_name}}",
    bodyHtml: `<p>Hey {{first_name}},</p>
<p>{{product_name}} just hit the board.</p>
<p>The quiet part of a launch is week three: launch traffic has rotated, the X post is buried, and the listing — if there is one — is dead archive furniture. ShipBoost is the listing that keeps working past week three.</p>
<p>Premium Launch is $9 right now (first 100): reserved launch week, permanent listing, editorial spotlight written during your launch period.</p>
<p>For {{website_domain}}: <a href="${CTA_URL}">${CTA_URL}</a></p>
${SIG}`,
  },
  {
    key: "out-12-positioning-noname",
    subject: "{{product_name}} — positioning past launch",
    bodyHtml: `<p>Hey,</p>
<p>{{tagline}} reads like real positioning, not a launch-day line. That earns a longer second life — if the listing exists to support it.</p>
<p>ShipBoost is where {{website_domain}} stays discoverable after launch week rotates. Categories, tags, alternatives pages.</p>
<p>Premium Launch ($9, first 100): reserved launch week, permanent listing, editorial spotlight during your launch period.</p>
<p><a href="${CTA_URL}">${CTA_URL}</a></p>
${SIG}`,
  },
];
