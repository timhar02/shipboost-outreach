import type { Template } from "./select";
import { CTA_URL, DISCOVERY, FOUNDER_INTRO, OFFER, SIG } from "./offer";

// Only the opener and subject come from the personalizer. Offer facts stay shared.
export const hybridTemplates: Template[] = [
  {
    key: "hyb-v4-03-second-job",
    subject: "{{personalized_subject}}",
    bodyHtml: `<p>Hi {{product_name}} team,</p>
<p>${FOUNDER_INTRO} <span data-personalized-opener>{{personalized_opener}}</span></p>
${DISCOVERY}
${OFFER}
<p>If you're interested, you can take a look here: <a href="${CTA_URL}">${CTA_URL}</a></p>
${SIG}`,
  },
];
