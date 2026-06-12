import type { Template } from "./select";

// Follow-ups deliberately do NOT mention the $9 code or price. The first email's
// marketing deadline has usually passed by the time a follow-up sends, so these
// stay value + CTA only and never re-advertise the offer.
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
<p>The one thing worth knowing before I drop it: the spotlight piece for {{product_name}} is a hand-written editorial on /blog that keeps surfacing through categories and alternatives pages after launch week, with a DR {{shipboost_dr}} dofollow link.</p>
<p>Page is here if it earns a look: <a href="${CTA_URL}">${CTA_URL}</a></p>
${SIG}`,
  },
  {
    key: "fu-04-mechanic-noname",
    subject: "Re: {{product_name}}",
    bodyHtml: `<p>Hey,</p>
<p>The buyer who matters for {{product_name}} shows up in month two, searching. They find you or they find whoever ranks for the same problem.</p>
<p>What ranks here is the editorial piece on /blog plus a DR {{shipboost_dr}} dofollow link, both permanent.</p>
<p><a href="${CTA_URL}">${CTA_URL}</a></p>
${SIG}`,
  },
  {
    key: "fu-05-ai-nudge-noname",
    subject: "Re: {{product_name}}",
    bodyHtml: `<p>One quick thing, then I'll leave it.</p>
<p>Go ask ChatGPT for the best tool in your category. If {{product_name}} isn't in the answer, that's the gap. A hand written editorial on /blog gives the models an independent source describing what you do, so {{website_domain}} starts showing up in those answers.</p>
<p><a href="${CTA_URL}">${CTA_URL}</a></p>
${SIG}`,
  },
];
