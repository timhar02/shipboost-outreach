import type { Template } from "./select";

const SIG = `<p>— {{sender_first_name}}<br/><a href="https://shipboost.com">shipboost.com</a></p>`;

export const templates: Template[] = [
  {
    key: "ph-01-spike-diagnosis-named",
    subject: "{{product_name}} — past launch day",
    bodyHtml: `<p>Hey {{first_name}},</p>
<p>Saw {{product_name}} on Product Hunt. {{tagline}} — the kind of positioning that usually earns a launch-day spike and then nothing.</p>
<p>Most launch sites give you the spike. Most directories give you a dead listing. ShipBoost is built to handle both — distribution today, discoverability after the launch week rotates.</p>
<p>If that's a problem worth solving for {{website_domain}}, happy to send the breakdown.</p>
${SIG}`,
  },
  {
    key: "ph-02-direct-question-noname",
    subject: "quick question about {{product_name}}",
    bodyHtml: `<p>Hey,</p>
<p>Caught {{product_name}} on PH today. One question: what's the plan for week two?</p>
<p>Launch-day traffic is a one-time event. Buyers searching for what you do next month won't see the launch — they'll see whatever ranks. ShipBoost gives the listing a second job: stay discoverable after the launch window closes.</p>
<p>Worth a look?</p>
${SIG}`,
  },
  {
    key: "ph-03-anti-definition-named",
    subject: "{{product_name}}",
    bodyHtml: `<p>Hey {{first_name}},</p>
<p>Congrats on the {{product_name}} launch.</p>
<p>ShipBoost isn't a Product Hunt clone. Not a generic AI tools list. Not a startup cemetery. It's a founder-ready listing that keeps earning trust through categories, tags, and alternatives pages after launch week ends.</p>
<p>If {{website_domain}} should still be findable in a month, that's what we do.</p>
${SIG}`,
  },
  {
    key: "ph-04-mechanic-first-noname",
    subject: "about {{product_name}}",
    bodyHtml: `<p>Hey,</p>
<p>A launch becomes a public asset: something buyers can discover, compare, and come back to after the launch week rotates. Most directories don't do that work. ShipBoost does.</p>
<p>{{product_name}} just launched. {{tagline}}. The listing should keep earning trust through categories, tags, and alternatives pages when the right buyer is searching later.</p>
<p>If that's useful for {{website_domain}}, I can send a draft listing.</p>
${SIG}`,
  },
  {
    key: "ph-05-week-two-named",
    subject: "{{product_name}} in week two",
    bodyHtml: `<p>Hey {{first_name}},</p>
<p>Saw the {{product_name}} launch. Week one usually takes care of itself — week two is where most launches go quiet.</p>
<p>ShipBoost keeps the listing useful after launch day instead of letting it turn into dead archive furniture. Categories, tags, and alternatives pages keep working when buyers search later.</p>
<p>Send me a yes and I'll draft the {{website_domain}} listing.</p>
${SIG}`,
  },
  {
    key: "ph-06-observation-noname",
    subject: "{{product_name}}",
    bodyHtml: `<p>Hey,</p>
<p>{{tagline}} — clear enough that I clicked through. That's already more than most PH posts earn.</p>
<p>The question now is whether anyone who didn't see launch day will find {{website_domain}} next month. ShipBoost is built to handle that part: discoverability after the launch window ends.</p>
<p>Open to a quick exchange?</p>
${SIG}`,
  },
  {
    key: "ph-07-short-named",
    subject: "{{product_name}}",
    bodyHtml: `<p>Hey {{first_name}},</p>
<p>{{product_name}} on PH today — nice work. Want me to draft a {{website_domain}} listing that keeps working after the launch?</p>
${SIG}`,
  },
  {
    key: "ph-08-noun-forward-named",
    subject: "a listing that keeps working — {{product_name}}",
    bodyHtml: `<p>Hey {{first_name}},</p>
<p>Saw {{product_name}} launch. A listing should be a working tool, not a trophy. ShipBoost gives {{website_domain}} a place buyers can discover, compare, and come back to after the launch rotates off the front page.</p>
<p>If that fits, I'll send the draft.</p>
${SIG}`,
  },
  {
    key: "ph-09-trust-named",
    subject: "{{product_name}} — trust after launch",
    bodyHtml: `<p>Hey {{first_name}},</p>
<p>{{tagline}}. Strong positioning.</p>
<p>Most founders treat trust like a post-launch problem — launch first, build credibility later. In practice it usually works the other way around. The listing that's still working in month two is the one buyers compare against alternatives.</p>
<p>ShipBoost builds that listing for {{website_domain}}. Want a draft?</p>
${SIG}`,
  },
  {
    key: "ph-10-second-job-noname",
    subject: "{{product_name}} — the second job",
    bodyHtml: `<p>Hey,</p>
<p>Most launches do one job: get a spike. {{product_name}} just did that.</p>
<p>The second job is harder: keep getting discovered when launch week ends. ShipBoost handles that — categories, tags, and alternatives pages that stay useful after the front page rotates.</p>
<p>If {{website_domain}} should keep showing up, send a yes.</p>
${SIG}`,
  },
  {
    key: "ph-11-quiet-named",
    subject: "{{product_name}}",
    bodyHtml: `<p>Hey {{first_name}},</p>
<p>{{product_name}} hit PH today. Congrats.</p>
<p>The quiet part of a launch is week three: PH traffic has rotated, the X post is buried, and the listing — if there is one — is dead archive furniture. ShipBoost is the listing that keeps working past week three.</p>
<p>Worth a look for {{website_domain}}?</p>
${SIG}`,
  },
  {
    key: "ph-12-positioning-noname",
    subject: "{{product_name}} — positioning past launch",
    bodyHtml: `<p>Hey,</p>
<p>{{tagline}} reads like real positioning, not a tagline written for launch day. That earns a longer second life — if the listing exists to support it.</p>
<p>ShipBoost is where {{website_domain}} stays discoverable after the launch week rotates. Categories, tags, alternatives pages. The buyer who arrives in month two finds you.</p>
<p>Send a yes and I'll draft it.</p>
${SIG}`,
  },
];
