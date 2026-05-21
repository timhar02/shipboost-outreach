import type { Template } from "./select";

/**
 * Hybrid templates: opener + subject come from the LLM personalizer, the
 * pitch / CTA / signature stays static so Premium Launch facts are never
 * wrong. Only the PITCH paragraph varies across templates for body variance.
 *
 * Variables (all required at render time):
 *   {{personalized_subject}}  - LLM-generated, product-specific
 *   {{personalized_opener}}   - LLM-generated, 1-2 sentences referencing the product
 *   {{website_domain}}        - founder's domain
 *   {{sender_first_name}}     - sender first name (env)
 *   {{shipboost_dr}}          - DR number (env, default 44)
 */

const SLOTS_LEFT = 14;
const SLOTS_TOTAL = 20;
const CTA_URL = "https://shipboost.io/submit";
const SIG = `<p>{{sender_first_name}}<br/><a href="https://shipboost.io">shipboost.io</a></p>`;

export const hybridTemplates: Template[] = [
  {
    key: "hyb-01-spike-diagnosis",
    subject: "{{personalized_subject}}",
    bodyHtml: `<p>{{personalized_opener}}</p>
<p>Most launches earn a spike on day one and then nothing happens. Most directories turn into a dead listing nobody comes back to. ShipBoost handles both jobs. Distribution this week, plus a permanent listing that keeps showing up in categories, tags, and alternatives pages months later.</p>
<p>Premium Launch is $9 right now (founding price, ${SLOTS_LEFT} of ${SLOTS_TOTAL} spots left). You pick your launch week, get featured placement, and our editor writes a spotlight piece on shipboost.io/blog with a DR {{shipboost_dr}} dofollow link to {{website_domain}}.</p>
<p>If that fits: <a href="${CTA_URL}">${CTA_URL}</a></p>
${SIG}`,
  },
  {
    key: "hyb-02-week-two",
    subject: "{{personalized_subject}}",
    bodyHtml: `<p>{{personalized_opener}}</p>
<p>Week one usually takes care of itself. Week two is where most launches go quiet. ShipBoost keeps the listing useful past launch day, instead of letting it turn into dead archive furniture. Categories, tags, and alternatives pages keep working when buyers search later.</p>
<p>Premium Launch is $9 during founding right now (${SLOTS_LEFT} of ${SLOTS_TOTAL} slots left). Reserved launch week, permanent listing, editorial spotlight piece on /blog with a DR {{shipboost_dr}} dofollow link to {{website_domain}}.</p>
<p><a href="${CTA_URL}">${CTA_URL}</a></p>
${SIG}`,
  },
  {
    key: "hyb-03-second-job",
    subject: "{{personalized_subject}}",
    bodyHtml: `<p>{{personalized_opener}}</p>
<p>Most launches do one job. Get a spike. The second job is harder. Keep getting discovered when launch week ends. ShipBoost handles that part. Permanent listing, categories, tags, alternatives pages, plus an editor written spotlight on /blog.</p>
<p>Premium Launch is $9 founding price right now. ${SLOTS_LEFT} of ${SLOTS_TOTAL} slots left. Editorial spotlight includes a DR {{shipboost_dr}} dofollow link to {{website_domain}}.</p>
<p><a href="${CTA_URL}">${CTA_URL}</a></p>
${SIG}`,
  },
  {
    key: "hyb-04-trust",
    subject: "{{personalized_subject}}",
    bodyHtml: `<p>{{personalized_opener}}</p>
<p>Most founders treat trust like a post launch problem. Launch first, build credibility later. In practice it usually works the other way around. The listing that's still working in month two is the one buyers compare against alternatives.</p>
<p>ShipBoost builds that listing for {{website_domain}}. Premium Launch is $9 right now during founding (${SLOTS_LEFT} of ${SLOTS_TOTAL} slots) and includes an editorial spotlight on the blog with a DR {{shipboost_dr}} dofollow backlink.</p>
<p><a href="${CTA_URL}">${CTA_URL}</a></p>
${SIG}`,
  },
  {
    key: "hyb-05-mechanic",
    subject: "{{personalized_subject}}",
    bodyHtml: `<p>{{personalized_opener}}</p>
<p>A launch should turn into a public asset. Something buyers can find, compare, and come back to after the launch window closes. Most directories don't do that work. ShipBoost does.</p>
<p>Premium Launch covers it. $9 founding price, ${SLOTS_LEFT} of ${SLOTS_TOTAL} spots left. Reserved launch week, permanent listing, plus an editorial spotlight on /blog with a DR {{shipboost_dr}} dofollow link to {{website_domain}}.</p>
<p><a href="${CTA_URL}">${CTA_URL}</a></p>
${SIG}`,
  },
  {
    key: "hyb-06-positioning",
    subject: "{{personalized_subject}}",
    bodyHtml: `<p>{{personalized_opener}}</p>
<p>ShipBoost is where {{website_domain}} stays discoverable after launch week rotates. Categories, tags, alternatives pages. Plus a hand written editorial spotlight on /blog (DR {{shipboost_dr}} dofollow backlink).</p>
<p>Premium Launch is $9 right now during founding. ${SLOTS_LEFT} of ${SLOTS_TOTAL} spots left.</p>
<p><a href="${CTA_URL}">${CTA_URL}</a></p>
${SIG}`,
  },
];
