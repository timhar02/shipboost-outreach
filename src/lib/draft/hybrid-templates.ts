import type { Template } from "./select";
import { CTA_URL, OFFER, SIG } from "./offer";

// Only the opener and subject come from the personalizer. Offer facts stay shared.
export const hybridTemplates: Template[] = [
  {
    key: "hyb-v2-03-second-job",
    subject: "{{personalized_subject}}",
    bodyHtml: `<p>{{personalized_opener}}</p>
<p>A launch announcement gets buried. A hand-written article gives {{product_name}} a permanent page explaining the product and who it's for, which you can keep sharing after launch week.</p>
${OFFER}
<p>Worth a look for {{product_name}}? <a href="${CTA_URL}">${CTA_URL}</a></p>
${SIG}`,
  },
];
