import type { Template } from "./select";
import { CTA_URL, FOUNDER_INTRO, OFFER, SIG } from "./offer";

// Separate the founder-led invitation from earlier $19 campaign results.
export const templates: Template[] = [
  {
    key: "out-v3-02-direct-question-noname",
    subject: "week two plan for {{product_name}}",
    bodyHtml: `<p>Hi,</p>
${FOUNDER_INTRO}
<p>I wanted to invite {{product_name}} to launch on ShipBoost. The idea is to give you an article you can keep sharing after launch week.</p>
${OFFER}
<p>If that sounds useful, you can pick your launch week here: <a href="${CTA_URL}">${CTA_URL}</a></p>
${SIG}`,
  },
  {
    key: "out-v3-04-mechanic-first-noname",
    subject: "an article about {{product_name}}",
    bodyHtml: `<p>Hi,</p>
${FOUNDER_INTRO}
<p>I wanted to reach out about {{product_name}}. Would an article explaining what you've built and who it's for be useful?</p>
${OFFER}
<p>If you're interested, you can take a look here: <a href="${CTA_URL}">${CTA_URL}</a></p>
${SIG}`,
  },
  {
    key: "out-v3-11-ai-visibility-noname",
    subject: "a public reference for {{product_name}}",
    bodyHtml: `<p>Hi,</p>
${FOUNDER_INTRO}
<p>I wanted to invite {{product_name}} to ShipBoost. We'd give people a public page about the product to read and share when they're researching it.</p>
${OFFER}
<p>If that sounds useful for {{product_name}}, here's the link: <a href="${CTA_URL}">${CTA_URL}</a></p>
${SIG}`,
  },
  {
    key: "out-v3-12-positioning-noname",
    subject: "the story behind {{product_name}}",
    bodyHtml: `<p>Hi,</p>
${FOUNDER_INTRO}
<p>I'd love to help tell the story behind {{product_name}}: what it does, the problem it solves, and who it's for.</p>
${OFFER}
<p>If you'd like to do that, you can pick a week here: <a href="${CTA_URL}">${CTA_URL}</a></p>
${SIG}`,
  },
];
