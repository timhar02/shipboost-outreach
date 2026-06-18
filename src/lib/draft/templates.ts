import type { Template } from "./select";

// Premium Launch is $19 publicly. Cold outreach gets a single shared $9 code
// ({{discount_code}}) plus a per-recipient marketing deadline ({{discount_deadline}},
// today + N days). The code does not actually expire; it is entered manually on
// Dodo's hosted checkout. Follow-ups never mention the code.
const CTA_URL = "https://shipboost.io/submit";
const SIG = `<p>{{sender_first_name}}<br/><a href="https://shipboost.io">shipboost.io</a></p>`;

// Action block reused across templates: price lands here, never in the subject.
const OFFER = `<p>Premium Launch is $9 right now, normally $19. Use code {{discount_code}} at checkout, it closes {{discount_deadline}}.</p>`;

export const templates: Template[] = [
  {
    key: "out-02-direct-question-noname",
    subject: "week two plan",
    bodyHtml: `<p>{{product_name}} just shipped. What's the plan for week two?</p>
<p>Launch traffic is a one time event. The buyer searching for what you do next month never sees the launch. They see whatever shows up in categories and alternatives lists.</p>
<p>That's the gap ShipBoost is built for. A permanent listing that keeps working past launch week, plus a hand written editorial piece on our blog with a DR {{shipboost_dr}} dofollow link to {{website_domain}}.</p>
${OFFER}
<p>If {{website_domain}} should still be findable in a month: <a href="${CTA_URL}">${CTA_URL}</a></p>
${SIG}`,
  },
  {
    key: "out-04-mechanic-first-noname",
    subject: "about {{product_name}}",
    bodyHtml: `<p>Hey,</p>
<p>A launch should turn into a public asset. Something buyers can find, compare, and come back to after the launch window closes. Most directories don't do that work. ShipBoost does.</p>
<p>{{product_name}} just launched. {{tagline}}. The listing should keep earning trust through categories, tags, and alternatives when the right buyer is searching later.</p>
<p>Premium Launch covers it. A reserved launch week, permanent listing, plus an editorial spotlight on the blog with a DR {{shipboost_dr}} dofollow link to {{website_domain}}.</p>
${OFFER}
<p><a href="${CTA_URL}">${CTA_URL}</a></p>
${SIG}`,
  },
  {
    key: "out-11-ai-visibility-noname",
    subject: "does ChatGPT know {{product_name}} exists",
    bodyHtml: `<p>Quick test. Ask ChatGPT for the best tool in your category. Does {{product_name}} come up?</p>
<p>If it doesn't, here is the mechanic. Before a model recommends a product, it checks whether independent sites describe it. If {{website_domain}} only lives on its own domain, it reads as unverified, so the model names someone else.</p>
<p>A ShipBoost listing fixes that, and not with a thin link. A hand written editorial on /blog that says what {{product_name}} does and who it's for, on a DR {{shipboost_dr}} domain. Real content the models can read and cite, with a dofollow link as the bonus.</p>
${OFFER}
<p>If the model should know {{product_name}} exists: <a href="${CTA_URL}">${CTA_URL}</a></p>
${SIG}`,
  },
  {
    key: "out-12-positioning-noname",
    subject: "{{product_name}} and positioning past launch",
    bodyHtml: `<p>Hey,</p>
<p>{{tagline}} reads like real positioning, not a launch day line. That earns a longer second life if the listing exists to support it.</p>
<p>ShipBoost is where {{website_domain}} stays discoverable after launch week rotates. Categories, tags, alternatives pages. Plus a hand written editorial spotlight on /blog with a DR {{shipboost_dr}} dofollow backlink.</p>
${OFFER}
<p><a href="${CTA_URL}">${CTA_URL}</a></p>
${SIG}`,
  },
];
