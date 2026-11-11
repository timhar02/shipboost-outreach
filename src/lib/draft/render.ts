import { convert } from "html-to-text";
import type { Template } from "./select";

export type RenderVars = {
  first_name?: string;
  product_name: string;
  tagline: string;
  website_domain: string;
  sender_first_name: string;
  shipboost_dr: string;
  // The launch board the prospect came from, e.g. "ScrollLaunch".
  board?: string;
  // "this week" for launches in the last 7 days, otherwise "recently".
  launch_when?: string;
  // "<br/>" + postal address, or "" when SENDER_POSTAL_ADDRESS isn't set.
  postal_line?: string;
  // Optional — used by hybrid templates that delegate the opener + subject to the LLM.
  personalized_subject?: string;
  personalized_opener?: string;
};

export type Rendered = { subject: string; bodyHtml: string; bodyText: string };

/** How the email refers to the launch date: only say "this week" when it was. */
export function launchWhen(launchedAt: Date | null | undefined, now = new Date()): string {
  if (!launchedAt) return "recently";
  return now.getTime() - launchedAt.getTime() <= 7 * 24 * 60 * 60 * 1000 ? "this week" : "recently";
}

export function renderTemplate(t: Template, vars: RenderVars): Rendered {
  // Earlier personalizers included a greeting. The template now supplies it.
  if (vars.personalized_opener) {
    vars = { ...vars, personalized_opener: vars.personalized_opener.replace(/^\s*(?:hi|hey|hello)(?:\s+[^,<]+)?\s*,\s*(?:<br\s*\/?\s*>\s*)?/i, "").trim() };
  }
  const subject = substitute(t.subject, vars);
  const bodyHtml = substitute(t.bodyHtml, vars);
  const bodyText = convert(bodyHtml, {
    wordwrap: 80,
    selectors: [{ selector: "a", options: { ignoreHref: true } }],
  });
  return { subject, bodyHtml, bodyText };
}

// Variables that may legitimately render as an empty string.
const OPTIONAL_VARS = new Set(["postal_line"]);

function substitute(s: string, vars: RenderVars): string {
  return s.replace(/\{\{([a-z_]+)\}\}/g, (_, key: string) => {
    const v = (vars as Record<string, string | undefined>)[key];
    if (OPTIONAL_VARS.has(key)) return v ?? "";
    if (v === undefined || v === "") throw new Error(`missing template variable: ${key}`);
    return v;
  });
}
