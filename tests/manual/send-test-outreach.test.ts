import { describe, it, expect } from "vitest";
import { templates } from "@/lib/draft/templates";
import { hybridTemplates } from "@/lib/draft/hybrid-templates";
import { followUpTemplates } from "@/lib/draft/follow-up-templates";
import { renderTemplate } from "@/lib/draft/render";
import { getOutreachDiscount } from "@/lib/draft/discount";
import { formatDeadline } from "@/lib/draft/format-deadline";
import { getConnectedGmailAccount, gmailFetch } from "@/lib/gmail/client";
import { buildRawHtmlEmail } from "@/lib/gmail/mime";

// Gated: only runs when SEND_TEST_OUTREACH=1, so the normal suite never sends mail.
// Run: SEND_TEST_OUTREACH=1 node scripts/run-with-env.mjs npx vitest run tests/manual/send-test-outreach.test.ts
const TO = "tsth02035@gmail.com";
const RUN = !!process.env.SEND_TEST_OUTREACH;

describe.skipIf(!RUN)("send test outreach emails", () => {
  it("renders every template with the live $9 code and sends to the test inbox", async () => {
    const acct = await getConnectedGmailAccount();
    if (!acct) {
      throw new Error(
        "No Gmail connected. Start the outreach dev server and visit /api/gmail/authorize, then re-run.",
      );
    }
    // Send AS the authenticated Gmail account (Gmail sends as the token owner
    // regardless of the From header), sidestepping the SENDER_EMAIL config.
    const from = acct.accountEmail;
    expect(from).toBeTruthy();

    const discount = getOutreachDiscount();
    console.log(
      `\nUsing code ${discount.code} (deadline ${formatDeadline(discount.deadline)})\n`,
    );

    const base = {
      first_name: "Sarah",
      product_name: "Wavefly",
      tagline: "Quiet launches for makers",
      website_domain: "trywavefly.com",
      sender_first_name: process.env.SENDER_FIRST_NAME ?? "Tim",
      shipboost_dr: process.env.SHIPBOOST_DR ?? "45",
      discount_code: discount.code,
      discount_deadline: formatDeadline(discount.deadline),
      personalized_subject: "Saw Wavefly go live",
      personalized_opener:
        "Saw Wavefly ship this week, the positioning is sharper than most launches.",
    };

    const all = [
      ...templates.map((t) => ({ group: "first", t })),
      ...hybridTemplates.map((t) => ({ group: "hybrid", t })),
      ...followUpTemplates.map((t) => ({ group: "followup", t })),
    ];

    for (const { group, t } of all) {
      const r = renderTemplate(t, base);
      const raw = buildRawHtmlEmail({
        from,
        to: TO,
        subject: `[test ${group}] ${r.subject}`,
        html: r.bodyHtml,
        headers: {},
      });
      const res = await gmailFetch<{ id?: string }>("/users/me/messages/send", {
        method: "POST",
        body: { raw },
      });
      console.log(`sent ${t.key.padEnd(28)} → ${res.id}`);
    }
  }, 120000);
});
