import type { Template } from "./select";

const CTA_URL = "https://shipboost.io/submit";
const SIG = `<p>{{sender_first_name}}</p>`;

export const followUpTemplates: Template[] = [
  {
    key: "fu-02-direct-noname",
    subject: "Re: {{product_name}}",
    bodyHtml: `<p>Hey,</p>
<p>Most launches go quiet by week two. The piece we'd write for {{product_name}} is an editorial spotlight that keeps ranking, so buyers still find {{website_domain}} months later through search.</p>
<p>Worth a look, or are you set? Page is here: <a href="${CTA_URL}">${CTA_URL}</a></p>
${SIG}`,
  },
  {
    key: "fu-03-soft-close-noname",
    subject: "Re: {{product_name}}",
    bodyHtml: `<p>Last note on this, so a no here is a clean no.</p>
<p>The one thing worth knowing before I drop it: the spotlight piece for {{product_name}} is a hand-written editorial on /blog that keeps surfacing through categories and alternatives pages after launch week, with a DR {{shipboost_dr}} dofollow link. Early access is $19 right now, $29 soon.</p>
<p>Page is here if it earns a look: <a href="${CTA_URL}">${CTA_URL}</a></p>
${SIG}`,
  },
  {
    key: "fu-04-mechanic-noname",
    subject: "Re: {{product_name}}",
    bodyHtml: `<p>Hey,</p>
<p>The buyer who matters for {{product_name}} shows up in month two, searching. They find you or they find whoever ranks for the same problem.</p>
<p>What ranks here is the editorial piece on /blog plus a DR {{shipboost_dr}} dofollow link, both permanent. Early Access is $19, going to $29 soon.</p>
<p><a href="${CTA_URL}">${CTA_URL}</a></p>
${SIG}`,
  },
];
