import type { Template } from "./select";

const CTA_URL = "https://shipboost.io/submit";
const SIG = `<p>{{sender_first_name}}</p>`;

export const followUpTemplates: Template[] = [
  {
    key: "fu-01-bump-named",
    subject: "Re: {{product_name}}",
    bodyHtml: `<p>Hey {{first_name}},</p>
<p>Floating this back up in case it got buried. Still worth a look for {{website_domain}}?</p>
<p><a href="${CTA_URL}">${CTA_URL}</a></p>
${SIG}`,
  },
  {
    key: "fu-02-direct-noname",
    subject: "Re: {{product_name}}",
    bodyHtml: `<p>Hey,</p>
<p>One more nudge on this. Does {{website_domain}} need a listing that keeps working past launch week, or are you set?</p>
<p><a href="${CTA_URL}">${CTA_URL}</a></p>
${SIG}`,
  },
  {
    key: "fu-03-soft-close-named",
    subject: "Re: {{product_name}}",
    bodyHtml: `<p>Hey {{first_name}},</p>
<p>Last note on this. If it's a no, no problem.</p>
<p>If the editorial spotlight or permanent listing piece is worth a closer look, the page is here: <a href="${CTA_URL}">${CTA_URL}</a></p>
${SIG}`,
  },
  {
    key: "fu-04-mechanic-noname",
    subject: "Re: {{product_name}}",
    bodyHtml: `<p>Hey,</p>
<p>Quick follow up. The point of ShipBoost is the buyer who shows up in month two. They find {{website_domain}} or they find whatever ranks.</p>
<p><a href="${CTA_URL}">${CTA_URL}</a></p>
${SIG}`,
  },
];
