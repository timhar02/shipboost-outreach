import type { Template } from "./select";
import { CTA_URL, DISCOVERY, FOUNDER_INTRO, OFFER, SIG } from "./offer";

// The body is identical across variants so only the subject is being tested.
const BODY = `<p>Hi,</p>
<p>${FOUNDER_INTRO} I wanted to reach out about {{product_name}}. Would an article explaining what you've built and who it's for be useful?</p>
${DISCOVERY}
${OFFER}
<p>If you're interested, you can take a look here: <a href="${CTA_URL}">${CTA_URL}</a></p>
${SIG}`;

export const templates: Template[] = [
  { key: "out-v4-subject-article-noname", subject: "an article about {{product_name}}", bodyHtml: BODY },
  { key: "out-v4-subject-seo-noname", subject: "SEO for {{product_name}} after launch", bodyHtml: BODY },
  { key: "out-v4-subject-chatgpt-noname", subject: "can ChatGPT discover {{product_name}}?", bodyHtml: BODY },
  { key: "out-v4-subject-invite-noname", subject: "an invite for {{product_name}}", bodyHtml: BODY },
];
