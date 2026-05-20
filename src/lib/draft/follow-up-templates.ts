import type { Template } from "./select";

const SIG = `<p>— {{sender_first_name}}</p>`;

export const followUpTemplates: Template[] = [
  {
    key: "fu-01-bump-named",
    subject: "Re: {{product_name}}",
    bodyHtml: `<p>Hey {{first_name}},</p>
<p>Floating this back up in case it got buried. Still worth a look for {{website_domain}}?</p>
${SIG}`,
  },
  {
    key: "fu-02-direct-noname",
    subject: "Re: {{product_name}}",
    bodyHtml: `<p>Hey,</p>
<p>One more nudge on this — does {{website_domain}} need a listing that keeps working past launch week, or are you set?</p>
${SIG}`,
  },
  {
    key: "fu-03-soft-close-named",
    subject: "Re: {{product_name}}",
    bodyHtml: `<p>Hey {{first_name}},</p>
<p>Last note on this — if the answer is no, no problem. If it's "tell me more," reply and I'll send the breakdown.</p>
${SIG}`,
  },
  {
    key: "fu-04-mechanic-noname",
    subject: "Re: {{product_name}}",
    bodyHtml: `<p>Hey,</p>
<p>Quick follow-up. The point of ShipBoost is the buyer who shows up in month two — they find {{website_domain}} or they find whatever ranks. Open to a draft?</p>
${SIG}`,
  },
];
