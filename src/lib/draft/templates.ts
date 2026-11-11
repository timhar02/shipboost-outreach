import type { Template } from "./select";
import { PREMIUM_LAUNCH_PRICE_USD, SIG_V5 } from "./offer";

// v5 (2026-11-11 audit): open with their launch, not with us; under ~80 words;
// one question as the ask; one link; opt-out line. Evidence in
// ShipBoost-Docs/Research/2026-11-11-cold-email-audit.md.
const PRICE = `$${PREMIUM_LAUNCH_PRICE_USD}`;

type Angle = { key: string; subject: string; body: string };

/** Founders who paid for a featured launch on another board. */
const PAID_ANGLES: Angle[] = [
  {
    key: "out-v5-paid-after-spot",
    subject: "{{product_name}} after {{board}}",
    body: `<p>Saw {{product_name}} took a featured launch on {{board}} {{launch_when}}.</p>
<p>Launch traffic usually lasts a day or two. What keeps sending people later is a page that shows up when your buyers search for what you do.</p>
<p>For each Premium launch I research those searches and write a full article around them on the ShipBoost blog. For ${PRICE}, paid once, {{product_name}} gets one, a launch week you pick, and a permanent listing linking to {{website_domain}}.</p>
<p>Want me to write one for {{product_name}}?</p>`,
  },
  {
    key: "out-v5-paid-price",
    subject: `a ${PRICE} article for {{product_name}}`,
    body: `<p>You paid for a featured spot on {{board}} for {{product_name}}, so you know how launch spots work. Most cost $30 to $50 for a week near the top.</p>
<p>ShipBoost Premium is ${PRICE}, paid once. It includes a full article about {{product_name}} on our blog, written around keywords your buyers search, that stays up after the week ends, and a permanent link to {{website_domain}}.</p>
<p>Would that be useful for {{product_name}}?</p>`,
  },
];

/** Everyone else who just launched on a board. */
const LAUNCH_ANGLES: Angle[] = [
  {
    key: "out-v5-week-two",
    subject: "week two for {{product_name}}",
    body: `<p>{{product_name}} went up on {{board}} {{launch_when}}. Launch traffic usually fades after a day or two, and then the board moves on.</p>
<p>For each Premium launch I research what that product's buyers search for, then write a full article around it on the ShipBoost blog, so there's a page that can keep getting found after launch week. For ${PRICE}, paid once, {{product_name}} gets one plus a permanent listing linking to {{website_domain}}.</p>
<p>Want me to write one?</p>`,
  },
  {
    key: "out-v5-chatgpt",
    subject: "does chatgpt know {{product_name}}?",
    body: `<p>Ask ChatGPT for the best tool for what {{product_name}} does. Does it come up?</p>
<p>AI answers tend to draw on pages outside a product's own site that describe it. A full, keyword-researched article on the ShipBoost blog gives {{product_name}} one of those, with a permanent link to {{website_domain}}. It's ${PRICE}, paid once, and you pick your launch week.</p>
<p>Want me to write it?</p>`,
  },
];

function variants(angles: Angle[]): Template[] {
  return angles.flatMap(({ key, subject, body }) => [
    { key, subject, bodyHtml: `<p>Hi {{first_name}},</p>\n${body}\n${SIG_V5}` },
    { key: `${key}-noname`, subject, bodyHtml: `<p>Hi {{product_name}} team,</p>\n${body}\n${SIG_V5}` },
  ]);
}

export const paidLaunchTemplates: Template[] = variants(PAID_ANGLES);
export const launchTemplates: Template[] = variants(LAUNCH_ANGLES);
export const templates: Template[] = [...paidLaunchTemplates, ...launchTemplates];

/**
 * Templates for one prospect: founders who paid for a launch elsewhere get the
 * paid angles, everyone else the launch angles; named variants only when the
 * founder's first name is known.
 */
export function templatesFor({ paidLaunch, hasName }: { paidLaunch: boolean; hasName: boolean }): Template[] {
  const pool = paidLaunch ? paidLaunchTemplates : launchTemplates;
  return pool.filter((t) => t.key.endsWith("-noname") !== hasName);
}
