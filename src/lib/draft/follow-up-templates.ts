import type { Template } from "./select";
import { CTA_URL } from "./offer";

// Follow-ups stay price-free and focus on the permanent editorial deliverable.
const SIG = `<p>{{sender_first_name}}</p>`;

export const followUpTemplates: Template[] = [
  {
    key: "fu-v2-02-direct-noname",
    subject: "Re: {{product_name}}",
    bodyHtml: `<p>Hey,</p>
<p>Following up on the article for {{product_name}}. We'd write and publish it on the ShipBoost blog, giving you a permanent page to share with prospective users.</p>
<p>Worth a look, or are you set? Details: <a href="${CTA_URL}">${CTA_URL}</a></p>
${SIG}`,
  },
  {
    key: "fu-v2-03-soft-close-noname",
    subject: "Re: {{product_name}}",
    bodyHtml: `<p>Last note from me on this.</p>
<p>The article for {{product_name}} would explain what it does and who it's for on the ShipBoost blog. It stays published after launch week, with a link to {{website_domain}}.</p>
<p>Here if it earns a look: <a href="${CTA_URL}">${CTA_URL}</a></p>
${SIG}`,
  },
  {
    key: "fu-v2-04-mechanic-noname",
    subject: "Re: {{product_name}}",
    bodyHtml: `<p>Hey,</p>
<p>One detail about the article for {{product_name}}: we write it by hand and publish it on the ShipBoost blog. You get a page you can share, plus a dofollow link to {{website_domain}}.</p>
<p>Details: <a href="${CTA_URL}">${CTA_URL}</a></p>
${SIG}`,
  },
  {
    key: "fu-v2-05-ai-nudge-noname",
    subject: "Re: {{product_name}}",
    bodyHtml: `<p>One quick follow-up.</p>
<p>The editorial article gives {{product_name}} a public reference beyond its own website, explaining the product and who it's for. Readers can share or cite that page.</p>
<p>Details: <a href="${CTA_URL}">${CTA_URL}</a></p>
${SIG}`,
  },
];
