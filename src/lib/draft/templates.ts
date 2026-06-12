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
    key: "out-03-anti-definition-named",
    subject: "not a launch site",
    bodyHtml: `<p>{{first_name}}, most launch sites give you one spike and then {{product_name}} turns into a listing nobody clicks again.</p>
<p>ShipBoost is built for the month after. Not a Product Hunt clone, not a generic tools list. A hand-written editorial spotlight on /blog that keeps ranking, plus a DR {{shipboost_dr}} dofollow backlink, so people still find {{website_domain}} through categories, tags, and alternatives pages long after launch week.</p>
${OFFER}
<p>Want the week you pick reserved? <a href="${CTA_URL}">${CTA_URL}</a></p>
${SIG}`,
  },
  {
    key: "out-06-observation-noname",
    subject: "who finds you in a month",
    bodyHtml: `<p>{{tagline}}. That's clear positioning, already more than most launch posts earn.</p>
<p>The open question is whether the buyer who missed launch day still finds {{website_domain}} a month later. That's the part ShipBoost handles. A permanent listing across categories, tags, and alternatives pages, plus a hand written editorial spotlight on /blog with a DR {{shipboost_dr}} dofollow link.</p>
${OFFER}
<p><a href="${CTA_URL}">${CTA_URL}</a></p>
${SIG}`,
  },
  {
    key: "out-09-trust-named",
    subject: "trust before week two",
    bodyHtml: `<p>Hey {{first_name}}, most founders treat credibility for {{product_name}} as a post-launch problem. Launch first, earn trust later.</p>
<p>The order is backwards. The listing still working in month two is the one buyers land on when they compare alternatives, and by then the decision is half made.</p>
<p>That listing is what Premium Launch builds for {{website_domain}}: a hand-written editorial spotlight on our blog with a guaranteed DR {{shipboost_dr}} dofollow backlink, something that keeps ranking after launch week ends.</p>
${OFFER}
<p>Worth a look? <a href="${CTA_URL}">${CTA_URL}</a></p>
${SIG}`,
  },
  {
    key: "out-10-second-job-noname",
    subject: "the second job",
    bodyHtml: `<p>A launch does one job. It buys you a spike, and {{product_name}} can get that anywhere.</p>
<p>The second job is harder. Staying discoverable after launch week, when the listing goes quiet and nobody is searching your name yet.</p>
<p>That is the part ShipBoost is built for. A hand-written editorial spotlight on /blog that keeps ranking, with a DR {{shipboost_dr}} dofollow backlink pointing at {{website_domain}}. A permanent asset, not a one-day spike.</p>
${OFFER}
<p>If you want {{product_name}} still showing up months from now: <a href="${CTA_URL}">${CTA_URL}</a></p>
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
    key: "out-12-ai-recommend-named",
    subject: "did ChatGPT name {{product_name}}",
    bodyHtml: `<p>{{first_name}}, try this. Ask ChatGPT for the best tool in your space. Does {{product_name}} get named, or does a competitor?</p>
<p>Models recommend what the open web confirms. They cross check a product against independent sites before they say its name, and a product that only exists on its own domain looks unverified.</p>
<p>That is the gap a ShipBoost listing closes for {{website_domain}}. A hand written editorial on /blog describing what {{product_name}} does and who it's for, on a DR {{shipboost_dr}} domain the models can read. The dofollow link is the bonus, not the point.</p>
${OFFER}
<p>Worth closing that gap? <a href="${CTA_URL}">${CTA_URL}</a></p>
${SIG}`,
  },
];
