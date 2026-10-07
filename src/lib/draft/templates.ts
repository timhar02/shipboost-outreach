import type { Template } from "./select";
import { CTA_URL, OFFER, SIG } from "./offer";

// New keys keep the $19 campaign separate from historical founding emails.
export const templates: Template[] = [
  {
    key: "out-v2-02-direct-question-noname",
    subject: "week two plan for {{product_name}}",
    bodyHtml: `<p>Hey,</p>
<p>What's the plan for {{product_name}} after launch week?</p>
<p>A launch announcement gets buried. A product article gives you a page you can keep sharing when someone asks what {{product_name}} does and who it's for.</p>
${OFFER}
<p>Pick a launch week here: <a href="${CTA_URL}">${CTA_URL}</a></p>
${SIG}`,
  },
  {
    key: "out-v2-04-mechanic-first-noname",
    subject: "an article about {{product_name}}",
    bodyHtml: `<p>Hey,</p>
<p>Would a hand-written article explaining {{product_name}} be useful for your next launch?</p>
<p>That's what we publish on the ShipBoost blog. A page about your product and who it's for, which you can share with prospective users after launch week.</p>
${OFFER}
<p>Details and submission: <a href="${CTA_URL}">${CTA_URL}</a></p>
${SIG}`,
  },
  {
    key: "out-v2-11-ai-visibility-noname",
    subject: "a public reference for {{product_name}}",
    bodyHtml: `<p>Hey,</p>
<p>When someone researches {{product_name}}, what can they read beyond {{website_domain}}?</p>
<p>We write an editorial article describing your product and who it's for on the ShipBoost blog. It gives readers a public reference they can share or cite.</p>
${OFFER}
<p>Worth a look? <a href="${CTA_URL}">${CTA_URL}</a></p>
${SIG}`,
  },
  {
    key: "out-v2-12-positioning-noname",
    subject: "the story behind {{product_name}}",
    bodyHtml: `<p>Hey,</p>
<p>A tagline introduces {{product_name}}. An article gives you room to explain the problem it solves and who should use it.</p>
<p>We write that article and publish it on the ShipBoost blog, so you have a permanent page to share alongside your own site.</p>
${OFFER}
<p>Submit {{product_name}} here: <a href="${CTA_URL}">${CTA_URL}</a></p>
${SIG}`,
  },
];
