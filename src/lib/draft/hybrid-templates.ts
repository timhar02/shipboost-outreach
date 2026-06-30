import type { Template } from "./select";

/**
 * Hybrid templates: opener + subject come from the LLM personalizer, the
 * pitch / CTA / signature stays static so Premium Launch facts are never
 * wrong.
 *
 * Variables (all required at render time):
 *   {{personalized_subject}}  - LLM-generated, product-specific
 *   {{personalized_opener}}   - LLM-generated, 1-2 sentences referencing the product
 *   {{product_name}}          - product name
 *   {{website_domain}}        - founder's domain
 *   {{sender_first_name}}     - sender first name (env)
 *   {{shipboost_dr}}          - DR number (env, default 45)
 */

const SLOTS_LEFT = 21;
const SLOTS_TOTAL = 50;
const CTA_URL = "https://shipboost.io/submit";
const SIG = `<p>{{sender_first_name}}<br/><a href="https://shipboost.io">shipboost.io</a></p>`;

export const hybridTemplates: Template[] = [
  {
    key: "hyb-03-second-job",
    subject: "{{personalized_subject}}",
    bodyHtml: `<p>{{personalized_opener}}</p>
<p>Most launches do one job well, a spike on day one. The harder job is staying discoverable when launch week ends, and that is the job most platforms drop.</p>
<p>ShipBoost handles the second job. A permanent listing that keeps surfacing through categories, tags, and alternatives pages, plus a hand-written editorial spotlight on /blog that keeps ranking, with a DR {{shipboost_dr}} dofollow link to {{website_domain}}.</p>
<p>Premium Launch is $9 right now (founding price, ${SLOTS_LEFT} of ${SLOTS_TOTAL} spots left). Reserved launch week, permanent listing, editorial spotlight on /blog with a DR {{shipboost_dr}} dofollow link.</p>
<p>Worth a look for {{product_name}}? <a href="${CTA_URL}">${CTA_URL}</a></p>
${SIG}`,
  },
];
