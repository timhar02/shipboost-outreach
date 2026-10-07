import type { Template } from "./select";
import { CTA_URL, FOUNDER_INTRO, OFFER, SIG } from "./offer";

// Only the opener and subject come from the personalizer. Offer facts stay shared.
export const hybridTemplates: Template[] = [
  {
    key: "hyb-v3-03-second-job",
    subject: "{{personalized_subject}}",
    bodyHtml: `<p>Hi,</p>
${FOUNDER_INTRO}
<p data-personalized-opener>{{personalized_opener}}</p>
${OFFER}
<p>If you're interested, you can take a look here: <a href="${CTA_URL}">${CTA_URL}</a></p>
${SIG}`,
  },
];
