import { chat } from "@/lib/llm/openrouter";
import type { ProductContext } from "@/lib/scrape/extract-context";

export type PersonalizeInput = {
  productName: string;
  tagline?: string;
  websiteDomain: string;
  firstName?: string;
  context: ProductContext;
};

export type Personalized = {
  subject: string;
  opener: string;
  model: string;
  latencyMs: number;
  attempts: number;
};

// Mirrors tests/draft/voice-compliance.test.ts.
// Any match here means we reject the LLM output and retry / fall back.
const BANNED = [
  /\bleverage\b/i, /\bseamlessly\b/i, /\brobust\b/i, /\belevate\b/i, /\bempower\b/i,
  /\bfoster\b/i, /\bunlock the potential\b/i, /\bharness the power\b/i,
  /\brevolutionary\b/i, /\bgame[- ]changing\b/i, /\bcutting[- ]edge\b/i,
  /\bnext[- ]level\b/i, /\bunprecedented\b/i, /\bbest[- ]in[- ]class\b/i,
  /\bvibrant community\b/i, /\bbuilt with passion\b/i, /\bmade with love\b/i,
  /\bbuilders and makers\b/i,
  /it'?s worth noting that/i, /here'?s the thing/i,
  /let'?s dive in/i, /let'?s unpack/i, /the truth is/i,
  /here'?s what most founders get wrong/i, /the thing nobody tells you/i,
  /the launch journey/i, /the startup landscape/i, /navigating the complexities/i,
  /\bdelve\b/i, /\bdelving\b/i, /\bin essence\b/i, /\bultimately\b/i,
  /\bfundamentally\b/i, /\bimagine if\b/i, /\ba stepping stone\b/i,
  /\btapestry\b/i, /\brealm of\b/i, /\bmyriad\b/i,
  // em-dash and en-dash
  /—/, /–/,
  // hype openers that LLMs love
  /^(hi|hello|greetings|dear)\b/i,
  /^(congrats|congratulations)/i,
  /excited to|thrilled to|happy to introduce/i,
  /\bhope this email finds you well\b/i,
];

const SYSTEM_PROMPT = `You write cold-outreach openers for ShipBoost, a directory and editorial spotlight platform for bootstrapped SaaS founders.

Voice you must follow (this is non-negotiable):
- You write like a former founder who has watched too many launches spike then die. Diagnostic, not enthusiastic.
- Your reader is a smart, skeptical SaaS founder who hates hype. Treat them as an operator, not a prospect.
- Lead with a specific observation about THEIR product. Then trust them to connect the dots.
- Short, complete sentences. No em-dashes (— or –). Use periods or commas instead.
- Warmth = respect and clarity. Not friendliness, not enthusiasm.

Hard bans (your output will be rejected if any appear):
- Em-dash (—) or en-dash (–) — use periods or commas
- "leverage", "seamlessly", "robust", "elevate", "empower", "delve", "ultimately"
- "revolutionary", "game-changing", "cutting-edge", "next-level"
- "Here's what most founders get wrong", "the thing nobody tells you", "Let's dive in"
- "hope this email finds you well", "excited to introduce"
- Openers like "Hi", "Hello", "Greetings", "Dear", "Congrats"
- Three-fragment stacks like "Fast. Easy. Done."
- The "this isn't X, it's Y" contrast flip

Output strictly this JSON shape, no prose, no markdown fence:
{
  "subject": "<3-7 word product-specific subject, lowercase, no quotes>",
  "opener": "<1-2 sentences, 20-50 words, references one SPECIFIC thing from the product context. Starts with 'Hey {firstName},' or 'Hey,' if no first name provided.>"
}

The opener must:
- Reference one concrete detail from the product context (their tagline, h1, a feature, or about blurb)
- Not pitch ShipBoost
- Not ask a generic question
- Sound like a person who actually looked at the site for 30 seconds
- Avoid all banned phrases above

If the product context is thin or you can't find a specific detail to reference, write a clean factual opener using the product name and tagline only. Don't fabricate features.`;

function buildUserPrompt(input: PersonalizeInput): string {
  const { productName, tagline, websiteDomain, firstName, context } = input;
  const lines: string[] = [
    `Product: ${productName}`,
    `Tagline: ${tagline ?? "(none)"}`,
    `Website: ${websiteDomain}`,
    `Founder first name: ${firstName ?? "(unknown — use generic 'Hey,')"}`,
    "",
    "Scraped from their site:",
    `- H1: ${context.h1 ?? "(none)"}`,
    `- Hero/meta description: ${context.heroText ?? "(none)"}`,
    `- Section headings: ${context.features?.join(" | ") ?? "(none)"}`,
    `- About blurb: ${context.aboutBlurb ?? "(none)"}`,
  ];
  return lines.join("\n");
}

function violationsIn(text: string): RegExp[] {
  return BANNED.filter((re) => re.test(text));
}

function tryParse(raw: string): { subject?: string; opener?: string } | null {
  // Strip code fences if the model added them despite instructions.
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```[a-z]*\n?/i, "").replace(/```\s*$/, "").trim();
  }
  try {
    const parsed = JSON.parse(cleaned) as { subject?: string; opener?: string };
    return parsed;
  } catch {
    return null;
  }
}

export type PersonalizeOptions = {
  model: string;
  maxRetries?: number;
};

/**
 * Generate a per-product subject + opener. Validates against the ShipBoost
 * voice ban list. Throws on hard failure so caller falls back to template.
 */
export async function personalize(
  input: PersonalizeInput,
  opts: PersonalizeOptions,
): Promise<Personalized> {
  const maxAttempts = (opts.maxRetries ?? 1) + 1;
  let lastError = "";

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const userPrompt = attempt === 1
      ? buildUserPrompt(input)
      : `${buildUserPrompt(input)}\n\nNote: previous attempt failed validation (${lastError}). Try again, strictly avoid the banned phrases.`;

    let result;
    try {
      result = await chat({
        model: opts.model,
        temperature: 0.3,
        maxTokens: 350,
        jsonMode: true,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
      });
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      continue;
    }

    const parsed = tryParse(result.content);
    if (!parsed || !parsed.subject || !parsed.opener) {
      lastError = `unparseable output: ${result.content.slice(0, 100)}`;
      continue;
    }

    const subject = parsed.subject.trim();
    const opener = parsed.opener.trim();

    // Length checks
    if (subject.length < 3 || subject.length > 80) {
      lastError = `subject length ${subject.length} out of bounds`;
      continue;
    }
    if (opener.length < 20 || opener.length > 500) {
      lastError = `opener length ${opener.length} out of bounds`;
      continue;
    }

    // Voice ban list
    const blob = `${subject}\n${opener}`;
    const violations = violationsIn(blob);
    if (violations.length) {
      lastError = `banned phrase: ${violations[0]}`;
      continue;
    }

    return {
      subject,
      opener,
      model: result.model,
      latencyMs: result.latencyMs,
      attempts: attempt,
    };
  }

  throw new Error(`personalize failed after ${maxAttempts} attempts: ${lastError}`);
}
