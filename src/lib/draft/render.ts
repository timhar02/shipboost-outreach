import { convert } from "html-to-text";
import type { Template } from "./select";

export type RenderVars = {
  first_name?: string;
  product_name: string;
  tagline: string;
  website_domain: string;
  sender_first_name: string;
  shipboost_dr: string;
};

export type Rendered = { subject: string; bodyHtml: string; bodyText: string };

export function renderTemplate(t: Template, vars: RenderVars): Rendered {
  const subject = substitute(t.subject, vars);
  const bodyHtml = substitute(t.bodyHtml, vars);
  const bodyText = convert(bodyHtml, {
    wordwrap: 80,
    selectors: [{ selector: "a", options: { ignoreHref: true } }],
  });
  return { subject, bodyHtml, bodyText };
}

function substitute(s: string, vars: RenderVars): string {
  return s.replace(/\{\{([a-z_]+)\}\}/g, (_, key: string) => {
    const v = (vars as Record<string, string | undefined>)[key];
    if (v === undefined || v === "") throw new Error(`missing template variable: ${key}`);
    return v;
  });
}
