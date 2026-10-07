// Bundle with esbuild for Node. Run through scripts/run-with-env.mjs.
// Dry-run by default; --apply performs the backed-up maintenance transaction.
import { PrismaClient } from "@prisma/client";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { refreshDraft } from "../src/lib/draft/refresh";
import { classifyInboundEmail } from "../src/lib/email/bounce";

const prisma = new PrismaClient();
const apply = process.argv.includes("--apply");
const pauseHn = process.argv.includes("--pause-hn");

async function main() {
  const [drafts, messages, sources] = await Promise.all([
    prisma.outreachDraft.findMany({
      where: { status: "PENDING_REVIEW", sentAt: null },
      include: { contact: { include: { launch: { include: { source: true } } } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.emailMessage.findMany({
      where: { direction: "IN", draft: { contact: { suppressedAt: null } } },
      select: { subject: true, snippet: true, headers: true, draft: { select: { contactId: true } } },
    }),
    prisma.source.findMany({ where: { kind: "HACKER_NEWS" } }),
  ]);

  const permanentBounceIds = new Set<string>();
  for (const message of messages) {
    const headers = message.headers as Record<string, unknown> | null;
    const result = classifyInboundEmail({
      from: typeof headers?.from === "string" ? headers.from : "",
      subject: message.subject,
      snippet: message.snippet,
    });
    if (result.kind === "BOUNCE" && result.severity === "permanent" && result.reason === "address_not_found") {
      permanentBounceIds.add(message.draft.contactId);
    }
  }

  const sender = process.env.SENDER_FIRST_NAME ?? "Tim";
  const dr = process.env.SHIPBOOST_DR ?? "45";
  const changes = drafts.flatMap((draft) => {
    const updated = refreshDraft(draft, sender, dr);
    const status = draft.contact.suppressedAt || permanentBounceIds.has(draft.contactId)
      ? "SKIPPED" : "PENDING_REVIEW";
    if (draft.templateKey === updated.templateKey && draft.subject === updated.subject
      && draft.body === updated.bodyHtml && draft.bodyText === updated.bodyText && draft.status === status) return [];
    return [{
      id: draft.id,
      old_template_key: draft.templateKey, old_subject: draft.subject,
      old_body: draft.body, old_body_text: draft.bodyText,
      new_template_key: updated.templateKey, subject: updated.subject,
      body: updated.bodyHtml, body_text: updated.bodyText, status,
    }];
  });

  const contacts = permanentBounceIds.size ? await prisma.contact.findMany({
    where: { id: { in: [...permanentBounceIds] }, suppressedAt: null },
    select: { id: true, suppressedAt: true, suppressionReason: true },
  }) : [];
  const summary = {
    mode: apply ? "apply" : "dry-run", pending: drafts.length, refresh: changes.length,
    skipSuppressed: changes.filter((row) => row.status === "SKIPPED").length,
    suppressPermanentBounces: contacts.length,
    pauseHn: pauseHn && sources.some((source) => source.enabled),
    pendingHn: drafts.filter((draft) => draft.contact.launch.source.kind === "HACKER_NEWS").length,
    samples: changes.slice(0, 2).map((row) => ({ subject: row.subject, bodyText: row.body_text, templateKey: row.new_template_key })),
  };
  console.log(JSON.stringify(summary, null, 2));
  if (!apply) return;

  const backupDir = mkdtempSync(join(tmpdir(), "shipboost-outreach-refresh-2026-10-07-"));
  writeFileSync(join(backupDir, "before.json"), JSON.stringify({ at: new Date(), drafts, contacts, sources, changes }, null, 2), { mode: 0o600 });
  console.log(`Backup: ${backupDir}`);

  const result = await prisma.$transaction(async (db) => {
    const suppressed = contacts.length ? await db.contact.updateMany({
      where: { id: { in: contacts.map((contact) => contact.id) }, suppressedAt: null },
      data: { suppressedAt: new Date(), suppressionReason: "bounce:address_not_found" },
    }) : { count: 0 };
    const paused = pauseHn ? await db.source.updateMany({
      where: { kind: "HACKER_NEWS", enabled: true }, data: { enabled: false },
    }) : { count: 0 };
    const changed = changes.length ? await db.$executeRaw`
      UPDATE "OutreachDraft" AS d
      SET "templateKey" = r.new_template_key, "subject" = r.subject,
          "body" = r.body, "bodyText" = r.body_text, "status" = r.status::"DraftStatus"
      FROM jsonb_to_recordset(${JSON.stringify(changes)}::jsonb) AS r(
        id text, old_template_key text, old_subject text, old_body text, old_body_text text,
        new_template_key text, subject text, body text, body_text text, status text
      )
      WHERE d.id = r.id AND d.status = 'PENDING_REVIEW' AND d."sentAt" IS NULL
        AND d."templateKey" = r.old_template_key AND d.subject = r.old_subject
        AND d.body = r.old_body AND d."bodyText" = r.old_body_text
    ` : 0;
    if (changed !== changes.length) throw new Error("Pending drafts changed concurrently; transaction rolled back. Re-run dry-run.");
    return { refreshed: changed, suppressed: suppressed.count, pausedSources: paused.count };
  }, { timeout: 60000 });
  writeFileSync(join(backupDir, "result.json"), JSON.stringify(result, null, 2), { mode: 0o600 });
  console.log(JSON.stringify(result));
}

main().catch((error: unknown) => {
  // Avoid logging database connection strings or full query bodies.
  console.error(error instanceof Error ? error.message.split("\n")[0] : "Maintenance failed");
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
