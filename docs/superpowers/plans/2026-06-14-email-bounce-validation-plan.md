# Email Bounce And Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop delivery failure emails from being counted as replies, persist bounce/suppression state, and prevent low-deliverability recipients from being sent through Gmail without validation.

**Architecture:** Add a small email deliverability layer around the existing Gmail send and reply-polling flow. Gmail inbound polling will classify delivery-status notifications separately from human replies, while pre-send validation will combine deterministic MX checks with an optional mailbox validation provider.

**Tech Stack:** Next.js App Router, TypeScript, Prisma/PostgreSQL, Gmail API, Vitest, Node `dns/promises`, optional external email validation API via `fetch`.

---

## File Structure

- Modify `prisma/schema.prisma`
  - Add `BOUNCED` to `DraftStatus`.
  - Add `BOUNCE` to `EventKind`.
  - Add contact-level suppression fields: `suppressedAt`, `suppressionReason`.
- Create migration under `prisma/migrations/<timestamp>_add_bounce_suppression/`.
- Create `src/lib/email/bounce.ts`
  - Classifies Gmail inbound messages as DSN/bounce/delay notices vs real replies.
- Create `src/lib/email/mx.ts`
  - Performs recipient-domain MX checks with deterministic outcomes.
- Create `src/lib/email/validation.ts`
  - Provides a single `validateRecipientEmail(email)` function used before sending.
  - Supports `EMAIL_VALIDATION_PROVIDER=none` and `EMAIL_VALIDATION_PROVIDER=abstractapi`.
- Modify `src/lib/gmail/replies.ts`
  - Use bounce classifier.
  - Store bounces as `EmailMessage(direction=IN)` plus `OutreachEvent(kind=BOUNCE)`.
  - Mark draft `BOUNCED` and suppress the contact.
- Modify `src/lib/gmail/send.ts`
  - Block suppressed contacts.
  - Run pre-send validation before Gmail API send.
  - Mark invalid recipients `FAILED` and suppress contact before Gmail sends.
- Modify `src/lib/auto-send/run.ts`
  - Treat validation failures as permanent draft failures so auto-send can keep moving.
- Add tests:
  - `tests/email/bounce.test.ts`
  - `tests/email/mx.test.ts`
  - `tests/email/validation.test.ts`
  - Extend `tests/gmail/send.test.ts`
  - Extend or add `tests/gmail/replies.test.ts`
  - Extend `tests/auto-send/run.test.ts`

---

## Task 1: Schema For Bounces And Suppression

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_add_bounce_suppression/migration.sql`

- [ ] **Step 1: Update Prisma enums and Contact model**

In `prisma/schema.prisma`, change:

```prisma
enum DraftStatus {
  PENDING_REVIEW
  SENT
  SKIPPED
  FAILED
  BOUNCED
}

enum EventKind {
  OPEN
  REPLY
  FOLLOWUP_SENT
  BOUNCE
}
```

Add these fields to `model Contact`:

```prisma
  suppressedAt     DateTime?
  suppressionReason String?
```

- [ ] **Step 2: Create migration**

Run:

```bash
npm run db:migrate:dev -- --name add_bounce_suppression
```

Expected: Prisma creates a migration that alters `DraftStatus`, alters `EventKind`, and adds nullable suppression columns to `Contact`.

- [ ] **Step 3: Verify generated SQL**

Open the generated migration and confirm it contains equivalent SQL:

```sql
ALTER TYPE "DraftStatus" ADD VALUE 'BOUNCED';
ALTER TYPE "EventKind" ADD VALUE 'BOUNCE';
ALTER TABLE "Contact" ADD COLUMN "suppressedAt" TIMESTAMP(3);
ALTER TABLE "Contact" ADD COLUMN "suppressionReason" TEXT;
```

- [ ] **Step 4: Regenerate Prisma client**

Run:

```bash
npx prisma generate
```

Expected: Prisma Client generated successfully.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: add bounce suppression schema"
```

---

## Task 2: Bounce Classifier

**Files:**
- Create: `src/lib/email/bounce.ts`
- Test: `tests/email/bounce.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/email/bounce.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { classifyInboundEmail } from "@/lib/email/bounce";

describe("classifyInboundEmail", () => {
  it("classifies Gmail permanent delivery failures as bounces", () => {
    expect(classifyInboundEmail({
      from: "Mail Delivery Subsystem <mailer-daemon@googlemail.com>",
      subject: "Delivery Status Notification (Failure)",
      snippet: "Address not found Your message wasn't delivered to support@stackoverlap.app because the address couldn't be found.",
    })).toEqual({
      kind: "BOUNCE",
      severity: "permanent",
      reason: "address_not_found",
    });
  });

  it("classifies Gmail temporary delivery failures as delayed bounces", () => {
    expect(classifyInboundEmail({
      from: "Mail Delivery Subsystem <mailer-daemon@googlemail.com>",
      subject: "Delivery Status Notification (Delay)",
      snippet: "Delivery incomplete There was a temporary problem delivering your message to server@mcp.penlog.app. Gmail will retry.",
    })).toEqual({
      kind: "BOUNCE",
      severity: "temporary",
      reason: "delivery_delayed",
    });
  });

  it("classifies recipient server timeout notices as temporary bounces", () => {
    expect(classifyInboundEmail({
      from: "Mail Delivery Subsystem <mailer-daemon@googlemail.com>",
      subject: "Delivery Status Notification (Delay)",
      snippet: "The recipient server did not accept our requests to connect. [slopguard.app 34.8.247.175: timed out]",
    })).toEqual({
      kind: "BOUNCE",
      severity: "temporary",
      reason: "recipient_server_timeout",
    });
  });

  it("does not classify normal replies as bounces", () => {
    expect(classifyInboundEmail({
      from: "founder@example.com",
      subject: "Re: quick question",
      snippet: "Thanks for reaching out. This looks interesting.",
    })).toEqual({ kind: "REPLY" });
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
npm test -- tests/email/bounce.test.ts
```

Expected: FAIL because `src/lib/email/bounce.ts` does not exist.

- [ ] **Step 3: Implement classifier**

Create `src/lib/email/bounce.ts`:

```ts
export type InboundEmailSummary = {
  from?: string;
  subject?: string;
  snippet?: string;
};

export type InboundEmailClassification =
  | { kind: "REPLY" }
  | { kind: "BOUNCE"; severity: "temporary" | "permanent"; reason: string };

const MAILER_DAEMON_RE = /\b(mailer-daemon|mail delivery subsystem|postmaster)\b/i;

export function classifyInboundEmail(email: InboundEmailSummary): InboundEmailClassification {
  const from = email.from ?? "";
  const subject = email.subject ?? "";
  const snippet = email.snippet ?? "";
  const haystack = `${from}\n${subject}\n${snippet}`;

  if (!MAILER_DAEMON_RE.test(haystack) && !/delivery status notification/i.test(subject)) {
    return { kind: "REPLY" };
  }

  if (/address not found|account that you tried to reach does not exist|couldn't be found|could not be found/i.test(haystack)) {
    return { kind: "BOUNCE", severity: "permanent", reason: "address_not_found" };
  }

  if (/recipient server did not accept our requests to connect|timed out/i.test(haystack)) {
    return { kind: "BOUNCE", severity: "temporary", reason: "recipient_server_timeout" };
  }

  if (/temporary problem|delivery incomplete|will retry/i.test(haystack)) {
    return { kind: "BOUNCE", severity: "temporary", reason: "delivery_delayed" };
  }

  if (/delivery status notification|message not delivered|delivery failed/i.test(haystack)) {
    return { kind: "BOUNCE", severity: "permanent", reason: "delivery_failed" };
  }

  return { kind: "REPLY" };
}
```

- [ ] **Step 4: Run tests to verify pass**

Run:

```bash
npm test -- tests/email/bounce.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/email/bounce.ts tests/email/bounce.test.ts
git commit -m "feat: classify delivery failure emails"
```

---

## Task 3: Store Bounces Instead Of Replies

**Files:**
- Modify: `src/lib/gmail/replies.ts`
- Test: `tests/gmail/replies.test.ts`

- [ ] **Step 1: Write failing tests for bounce handling**

Create `tests/gmail/replies.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const gmailFetch = vi.fn();
const emailFindUnique = vi.fn();
const emailFindFirst = vi.fn();
const tx = vi.fn();
const emailCreate = vi.fn((args) => ({ model: "emailMessage", args }));
const eventCreate = vi.fn((args) => ({ model: "outreachEvent", args }));
const draftUpdate = vi.fn((args) => ({ model: "outreachDraft", args }));
const contactUpdate = vi.fn((args) => ({ model: "contact", args }));

vi.mock("@/lib/gmail/client", () => ({ gmailFetch }));
vi.mock("@/server/db/client", () => ({
  prisma: {
    emailMessage: { findUnique: emailFindUnique, findFirst: emailFindFirst, create: emailCreate },
    outreachEvent: { create: eventCreate },
    outreachDraft: { update: draftUpdate },
    contact: { update: contactUpdate },
    $transaction: tx,
  },
}));

describe("pollReplies", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    tx.mockResolvedValue([]);
    emailFindUnique.mockResolvedValue(null);
    emailFindFirst.mockResolvedValue({
      draftId: "draft_1",
      draft: { contactId: "contact_1" },
    });
  });

  it("records delivery failures as bounces and suppresses the contact", async () => {
    gmailFetch
      .mockResolvedValueOnce({ messages: [{ id: "in_1", threadId: "thread_1" }] })
      .mockResolvedValueOnce({
        id: "in_1",
        threadId: "thread_1",
        snippet: "Address not found Your message wasn't delivered.",
        payload: {
          headers: [
            { name: "Subject", value: "Delivery Status Notification (Failure)" },
            { name: "From", value: "Mail Delivery Subsystem <mailer-daemon@googlemail.com>" },
          ],
        },
      });

    const { pollReplies } = await import("@/lib/gmail/replies");
    await expect(pollReplies()).resolves.toEqual({ matched: 0, bounced: 1 });

    expect(eventCreate).toHaveBeenCalledWith({
      data: {
        draftId: "draft_1",
        kind: "BOUNCE",
        payload: {
          gmailMessageId: "in_1",
          gmailThreadId: "thread_1",
          severity: "permanent",
          reason: "address_not_found",
        },
      },
    });
    expect(draftUpdate).toHaveBeenCalledWith({ where: { id: "draft_1" }, data: { status: "BOUNCED" } });
    expect(contactUpdate).toHaveBeenCalledWith({
      where: { id: "contact_1" },
      data: {
        suppressedAt: expect.any(Date),
        suppressionReason: "bounce:address_not_found",
      },
    });
  });

  it("keeps normal replies as replies", async () => {
    gmailFetch
      .mockResolvedValueOnce({ messages: [{ id: "in_2", threadId: "thread_1" }] })
      .mockResolvedValueOnce({
        id: "in_2",
        threadId: "thread_1",
        snippet: "Thanks, this is interesting.",
        payload: {
          headers: [
            { name: "Subject", value: "Re: quick question" },
            { name: "From", value: "founder@example.com" },
          ],
        },
      });

    const { pollReplies } = await import("@/lib/gmail/replies");
    await expect(pollReplies()).resolves.toEqual({ matched: 1, bounced: 0 });
    expect(eventCreate).toHaveBeenCalledWith({
      data: { draftId: "draft_1", kind: "REPLY", payload: { gmailMessageId: "in_2", gmailThreadId: "thread_1" } },
    });
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
npm test -- tests/gmail/replies.test.ts
```

Expected: FAIL because current `pollReplies()` returns only `{ matched }`, does not select contact id, and stores bounces as replies.

- [ ] **Step 3: Update `pollReplies()` implementation**

Modify `src/lib/gmail/replies.ts` to this shape:

```ts
import { prisma } from "@/server/db/client";
import { gmailFetch } from "./client";
import { classifyInboundEmail } from "@/lib/email/bounce";

type GmailListResponse = { messages?: Array<{ id: string; threadId: string }> };
type GmailMessage = {
  id: string;
  threadId: string;
  snippet?: string;
  payload?: { headers?: Array<{ name: string; value: string }> };
};

export async function pollReplies(): Promise<{ matched: number; bounced: number }> {
  const listed = await gmailFetch<GmailListResponse>("/users/me/messages?maxResults=200&labelIds=INBOX&q=newer_than:14d");
  const items = listed.messages ?? [];

  let matched = 0;
  let bounced = 0;
  for (const item of items) {
    if (await prisma.emailMessage.findUnique({ where: { providerMessageId: item.id } })) continue;

    const parent = await prisma.emailMessage.findFirst({
      where: { direction: "OUT", providerThreadId: item.threadId },
      include: { draft: { select: { contactId: true } } },
    });
    if (!parent) continue;

    const full = await gmailFetch<GmailMessage>(
      `/users/me/messages/${item.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=In-Reply-To&metadataHeaders=References`,
    );
    const headers = Object.fromEntries((full.payload?.headers ?? []).map((h) => [h.name.toLowerCase(), h.value]));
    const classification = classifyInboundEmail({
      from: headers.from,
      subject: headers.subject,
      snippet: full.snippet,
    });

    if (classification.kind === "BOUNCE") {
      await prisma.$transaction([
        prisma.emailMessage.create({
          data: {
            draftId: parent.draftId,
            providerMessageId: full.id,
            providerThreadId: full.threadId,
            direction: "IN",
            subject: headers.subject ?? "",
            snippet: (full.snippet ?? "").slice(0, 200),
            headers,
          },
        }),
        prisma.outreachEvent.create({
          data: {
            draftId: parent.draftId,
            kind: "BOUNCE",
            payload: {
              gmailMessageId: full.id,
              gmailThreadId: full.threadId,
              severity: classification.severity,
              reason: classification.reason,
            },
          },
        }),
        prisma.outreachDraft.update({ where: { id: parent.draftId }, data: { status: "BOUNCED" } }),
        prisma.contact.update({
          where: { id: parent.draft.contactId },
          data: {
            suppressedAt: new Date(),
            suppressionReason: `bounce:${classification.reason}`,
          },
        }),
      ]);
      bounced++;
      continue;
    }

    await prisma.$transaction([
      prisma.emailMessage.create({
        data: {
          draftId: parent.draftId,
          providerMessageId: full.id,
          providerThreadId: full.threadId,
          direction: "IN",
          subject: headers.subject ?? "",
          snippet: (full.snippet ?? "").slice(0, 200),
          headers,
        },
      }),
      prisma.outreachEvent.create({
        data: { draftId: parent.draftId, kind: "REPLY", payload: { gmailMessageId: full.id, gmailThreadId: full.threadId } },
      }),
    ]);
    matched++;
  }

  return { matched, bounced };
}
```

- [ ] **Step 4: Run tests**

Run:

```bash
npm test -- tests/gmail/replies.test.ts tests/email/bounce.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/gmail/replies.ts tests/gmail/replies.test.ts
git commit -m "feat: record delivery failures as bounces"
```

---

## Task 4: MX Validation

**Files:**
- Create: `src/lib/email/mx.ts`
- Test: `tests/email/mx.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/email/mx.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const resolveMx = vi.fn();

vi.mock("node:dns/promises", () => ({ resolveMx }));

describe("checkEmailDomainMx", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("passes when the recipient domain has MX records", async () => {
    resolveMx.mockResolvedValue([{ exchange: "aspmx.l.google.com", priority: 1 }]);
    const { checkEmailDomainMx } = await import("@/lib/email/mx");

    await expect(checkEmailDomainMx("founder@example.com")).resolves.toEqual({
      ok: true,
      domain: "example.com",
      exchanges: ["aspmx.l.google.com"],
    });
  });

  it("fails when the recipient domain has no MX records", async () => {
    const err = new Error("queryMx ENODATA");
    Object.assign(err, { code: "ENODATA" });
    resolveMx.mockRejectedValue(err);
    const { checkEmailDomainMx } = await import("@/lib/email/mx");

    await expect(checkEmailDomainMx("founder@example.com")).resolves.toEqual({
      ok: false,
      domain: "example.com",
      reason: "no_mx",
    });
  });

  it("fails invalid email syntax before DNS lookup", async () => {
    const { checkEmailDomainMx } = await import("@/lib/email/mx");

    await expect(checkEmailDomainMx("not-an-email")).resolves.toEqual({
      ok: false,
      domain: "",
      reason: "invalid_email",
    });
    expect(resolveMx).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
npm test -- tests/email/mx.test.ts
```

Expected: FAIL because `src/lib/email/mx.ts` does not exist.

- [ ] **Step 3: Implement MX checker**

Create `src/lib/email/mx.ts`:

```ts
import { resolveMx } from "node:dns/promises";

export type EmailDomainMxResult =
  | { ok: true; domain: string; exchanges: string[] }
  | { ok: false; domain: string; reason: "invalid_email" | "no_mx" | "dns_error" };

const SIMPLE_EMAIL_RE = /^[A-Z0-9._%+-]+@([A-Z0-9.-]+\.[A-Z]{2,})$/i;

export async function checkEmailDomainMx(email: string): Promise<EmailDomainMxResult> {
  const match = email.trim().match(SIMPLE_EMAIL_RE);
  if (!match) return { ok: false, domain: "", reason: "invalid_email" };

  const domain = match[1].toLowerCase();
  try {
    const records = await resolveMx(domain);
    const exchanges = records.map((record) => record.exchange).filter(Boolean);
    if (!exchanges.length) return { ok: false, domain, reason: "no_mx" };
    return { ok: true, domain, exchanges };
  } catch (err) {
    const code = typeof err === "object" && err && "code" in err ? String((err as { code?: unknown }).code) : "";
    if (code === "ENODATA" || code === "ENOTFOUND" || code === "ENODOMAIN") {
      return { ok: false, domain, reason: "no_mx" };
    }
    return { ok: false, domain, reason: "dns_error" };
  }
}
```

- [ ] **Step 4: Run tests**

Run:

```bash
npm test -- tests/email/mx.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/email/mx.ts tests/email/mx.test.ts
git commit -m "feat: add recipient MX validation"
```

---

## Task 5: Optional Mailbox Validation Provider

**Files:**
- Create: `src/lib/email/validation.ts`
- Test: `tests/email/validation.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/email/validation.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const checkEmailDomainMx = vi.fn();

vi.mock("@/lib/email/mx", () => ({ checkEmailDomainMx }));

describe("validateRecipientEmail", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    delete process.env.EMAIL_VALIDATION_PROVIDER;
    delete process.env.ABSTRACT_API_EMAIL_VALIDATION_KEY;
    vi.stubGlobal("fetch", vi.fn());
  });

  it("fails when MX validation fails", async () => {
    checkEmailDomainMx.mockResolvedValue({ ok: false, domain: "example.com", reason: "no_mx" });
    const { validateRecipientEmail } = await import("@/lib/email/validation");

    await expect(validateRecipientEmail("founder@example.com")).resolves.toEqual({
      ok: false,
      reason: "no_mx",
      source: "mx",
    });
  });

  it("passes on MX only when provider is disabled", async () => {
    process.env.EMAIL_VALIDATION_PROVIDER = "none";
    checkEmailDomainMx.mockResolvedValue({ ok: true, domain: "example.com", exchanges: ["mx.example.com"] });
    const { validateRecipientEmail } = await import("@/lib/email/validation");

    await expect(validateRecipientEmail("founder@example.com")).resolves.toEqual({
      ok: true,
      source: "mx",
    });
  });

  it("fails when Abstract API says the mailbox is undeliverable", async () => {
    process.env.EMAIL_VALIDATION_PROVIDER = "abstractapi";
    process.env.ABSTRACT_API_EMAIL_VALIDATION_KEY = "key_123";
    checkEmailDomainMx.mockResolvedValue({ ok: true, domain: "example.com", exchanges: ["mx.example.com"] });
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        deliverability: "UNDELIVERABLE",
        is_valid_format: { value: true },
      }),
    } as Response);
    const { validateRecipientEmail } = await import("@/lib/email/validation");

    await expect(validateRecipientEmail("founder@example.com")).resolves.toEqual({
      ok: false,
      reason: "mailbox_undeliverable",
      source: "abstractapi",
    });
  });

  it("passes when Abstract API says the mailbox is deliverable", async () => {
    process.env.EMAIL_VALIDATION_PROVIDER = "abstractapi";
    process.env.ABSTRACT_API_EMAIL_VALIDATION_KEY = "key_123";
    checkEmailDomainMx.mockResolvedValue({ ok: true, domain: "example.com", exchanges: ["mx.example.com"] });
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        deliverability: "DELIVERABLE",
        is_valid_format: { value: true },
      }),
    } as Response);
    const { validateRecipientEmail } = await import("@/lib/email/validation");

    await expect(validateRecipientEmail("founder@example.com")).resolves.toEqual({
      ok: true,
      source: "abstractapi",
    });
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
npm test -- tests/email/validation.test.ts
```

Expected: FAIL because `src/lib/email/validation.ts` does not exist.

- [ ] **Step 3: Implement validation facade**

Create `src/lib/email/validation.ts`:

```ts
import { checkEmailDomainMx } from "./mx";

export type RecipientValidationResult =
  | { ok: true; source: "mx" | "abstractapi" }
  | { ok: false; source: "mx" | "abstractapi"; reason: string };

type AbstractApiResponse = {
  deliverability?: string;
  is_valid_format?: { value?: boolean };
};

export async function validateRecipientEmail(email: string): Promise<RecipientValidationResult> {
  const mx = await checkEmailDomainMx(email);
  if (!mx.ok) return { ok: false, source: "mx", reason: mx.reason };

  const provider = process.env.EMAIL_VALIDATION_PROVIDER ?? "none";
  if (provider === "none") return { ok: true, source: "mx" };
  if (provider !== "abstractapi") return { ok: true, source: "mx" };

  const apiKey = process.env.ABSTRACT_API_EMAIL_VALIDATION_KEY;
  if (!apiKey) return { ok: true, source: "mx" };

  const url = new URL("https://emailvalidation.abstractapi.com/v1/");
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("email", email);

  const res = await fetch(url.toString(), { method: "GET" });
  if (!res.ok) return { ok: true, source: "mx" };

  const body = (await res.json()) as AbstractApiResponse;
  if (body.is_valid_format?.value === false) {
    return { ok: false, source: "abstractapi", reason: "invalid_email" };
  }
  if (String(body.deliverability ?? "").toUpperCase() === "UNDELIVERABLE") {
    return { ok: false, source: "abstractapi", reason: "mailbox_undeliverable" };
  }

  return { ok: true, source: "abstractapi" };
}
```

- [ ] **Step 4: Run tests**

Run:

```bash
npm test -- tests/email/validation.test.ts tests/email/mx.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/email/validation.ts tests/email/validation.test.ts
git commit -m "feat: add optional mailbox validation"
```

---

## Task 6: Pre-Send Validation And Suppression

**Files:**
- Modify: `src/lib/gmail/send.ts`
- Modify: `src/lib/auto-send/run.ts`
- Test: `tests/gmail/send.test.ts`
- Test: `tests/auto-send/run.test.ts`

- [ ] **Step 1: Extend send tests**

In `tests/gmail/send.test.ts`, add a mock:

```ts
const validateRecipientEmail = vi.fn();

vi.mock("@/lib/email/validation", () => ({ validateRecipientEmail }));
```

In `beforeEach`, add:

```ts
validateRecipientEmail.mockResolvedValue({ ok: true, source: "mx" });
```

Add tests:

```ts
it("throws before Gmail send when the contact is suppressed", async () => {
  prisma.outreachDraft.findUniqueOrThrow.mockResolvedValue({
    ...baseDraft,
    contact: {
      ...baseDraft.contact,
      suppressedAt: new Date("2026-06-14T00:00:00.000Z"),
      suppressionReason: "bounce:address_not_found",
    },
  });
  const { sendDraft } = await import("@/lib/gmail/send");

  await expect(sendDraft("draft_1")).rejects.toThrow("recipient suppressed: bounce:address_not_found");
  expect(gmailFetch).not.toHaveBeenCalled();
});

it("marks invalid recipients failed and suppresses contact before Gmail send", async () => {
  validateRecipientEmail.mockResolvedValue({ ok: false, source: "mx", reason: "no_mx" });
  const { sendDraft } = await import("@/lib/gmail/send");

  await expect(sendDraft("draft_1")).rejects.toThrow("recipient validation failed: no_mx");
  expect(gmailFetch).not.toHaveBeenCalled();
  expect(prisma.$transaction).toHaveBeenCalledWith([
    prisma.outreachDraft.update({ where: { id: "draft_1" }, data: { status: "FAILED" } }),
    prisma.contact.update({
      where: { id: baseDraft.contactId },
      data: {
        suppressedAt: expect.any(Date),
        suppressionReason: "validation:no_mx",
      },
    }),
  ]);
});
```

- [ ] **Step 2: Run send tests to verify failure**

Run:

```bash
npm test -- tests/gmail/send.test.ts
```

Expected: FAIL because `sendDraft()` does not validate or check suppression.

- [ ] **Step 3: Update `sendDraft()`**

In `src/lib/gmail/send.ts`, import:

```ts
import { validateRecipientEmail } from "@/lib/email/validation";
```

After the draft status check, add:

```ts
  if (draft.contact.suppressedAt) {
    throw new Error(`recipient suppressed: ${draft.contact.suppressionReason ?? "unknown"}`);
  }
```

Before building the raw Gmail message, add:

```ts
  const validation = await validateRecipientEmail(draft.contact.email);
  if (!validation.ok) {
    await prisma.$transaction([
      prisma.outreachDraft.update({ where: { id: draftId }, data: { status: "FAILED" } }),
      prisma.contact.update({
        where: { id: draft.contactId },
        data: {
          suppressedAt: new Date(),
          suppressionReason: `validation:${validation.reason}`,
        },
      }),
    ]);
    throw new Error(`recipient validation failed: ${validation.reason}`);
  }
```

- [ ] **Step 4: Update permanent failure detection**

In `src/lib/auto-send/run.ts`, update `isPermanentDraftFailure()`:

```ts
function isPermanentDraftFailure(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return (
    message.includes("Invalid To header") ||
    message.includes('"reason": "invalidArgument"') ||
    message.includes("recipient validation failed:") ||
    message.includes("recipient suppressed:")
  );
}
```

- [ ] **Step 5: Add auto-send test**

In `tests/auto-send/run.test.ts`, add:

```ts
it("marks recipient validation failures permanent and keeps the lane moving", async () => {
  draftCount.mockImplementation(async ({ where }) => {
    if (where.status === "SENT") return 0;
    if (where.parentDraftId === null) return 2;
    return 0;
  });
  draftFindFirst
    .mockResolvedValueOnce({ id: "bad_first" })
    .mockResolvedValueOnce({ id: "good_first" });
  sendDraft
    .mockRejectedValueOnce(new Error("recipient validation failed: no_mx"))
    .mockResolvedValueOnce({ gmailMessageId: "msg", gmailThreadId: "thread" });
  const { runAutoSend } = await import("@/lib/auto-send/run");

  await expect(runAutoSend(new Date("2026-06-04T00:00:00.000Z"))).resolves.toMatchObject({
    sent: true,
    sentCount: 1,
    draftIds: ["good_first"],
    lanes: {
      first: {
        sent: true,
        sentCount: 1,
        draftIds: ["good_first"],
        failedDraftIds: ["bad_first"],
      },
    },
  });
  expect(draftUpdate).toHaveBeenCalledWith({ where: { id: "bad_first" }, data: { status: "FAILED" } });
});
```

- [ ] **Step 6: Run focused tests**

Run:

```bash
npm test -- tests/gmail/send.test.ts tests/auto-send/run.test.ts tests/email/validation.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/gmail/send.ts src/lib/auto-send/run.ts tests/gmail/send.test.ts tests/auto-send/run.test.ts
git commit -m "feat: validate recipients before sending"
```

---

## Task 7: Backfill Current Bounced Contacts

**Files:**
- Create: `scripts/suppress-known-bounces.mjs`

- [ ] **Step 1: Create suppression script**

Create `scripts/suppress-known-bounces.mjs`:

```js
#!/usr/bin/env node
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const bouncedEmails = [
  { email: "server@mcp.penlog.app", reason: "bounce:delivery_delayed" },
  { email: "service@slopguard.app", reason: "bounce:recipient_server_timeout" },
  { email: "support@stackoverlap.app", reason: "bounce:address_not_found" },
];

(async () => {
  for (const row of bouncedEmails) {
    const contact = await prisma.contact.findUnique({ where: { email: row.email } });
    if (!contact) {
      console.log(`missing ${row.email}`);
      continue;
    }
    await prisma.contact.update({
      where: { id: contact.id },
      data: { suppressedAt: new Date(), suppressionReason: row.reason },
    });
    await prisma.outreachDraft.updateMany({
      where: { contactId: contact.id, status: "SENT" },
      data: { status: "BOUNCED" },
    });
    console.log(`suppressed ${row.email} (${row.reason})`);
  }
})()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

- [ ] **Step 2: Dry-run locally by reading script**

Run:

```bash
node --check scripts/suppress-known-bounces.mjs
```

Expected: no syntax errors.

- [ ] **Step 3: Execute with project env**

Run:

```bash
node scripts/run-with-env.mjs node scripts/suppress-known-bounces.mjs
```

Expected output includes:

```text
suppressed server@mcp.penlog.app (bounce:delivery_delayed)
suppressed service@slopguard.app (bounce:recipient_server_timeout)
suppressed support@stackoverlap.app (bounce:address_not_found)
```

- [ ] **Step 4: Commit script**

```bash
git add scripts/suppress-known-bounces.mjs
git commit -m "chore: add known bounce suppression script"
```

---

## Task 8: Final Verification

**Files:**
- All changed files

- [ ] **Step 1: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 2: Run full test suite**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 3: Run lint**

Run:

```bash
npm run lint
```

Expected: PASS.

- [ ] **Step 4: Verify auto-send status**

Run:

```bash
curl -sS http://127.0.0.1:3000/api/cron/auto-send/status
```

Expected: response does not count suppressed contacts as pending auto-send candidates.

- [ ] **Step 5: Commit verification-only changes if any**

```bash
git status --short
git add <only-intended-files>
git commit -m "test: verify bounce and validation flow"
```

Only run the final commit if verification produced intentional file changes.

---

## Notes And Tradeoffs

- MX validation is cheap and deterministic, but it only validates the recipient domain, not the mailbox.
- Abstract API validation is optional. If the provider is down or missing a key, the plan deliberately falls back to MX-only so sending is not blocked by third-party outage.
- Temporary Gmail delay notices are stored as `BOUNCE` events and suppress contacts in this plan. If you want to wait until Gmail sends a final failure notice, change Task 3 so only `severity: "permanent"` suppresses immediately.
- Suppression is stored on `Contact`, not just `OutreachDraft`, because follow-ups and future drafts for the same contact should be blocked.

## Self-Review

- Requirement 1, stop bounces being replies: Tasks 2 and 3.
- Requirement 2, real bounce state: Tasks 1, 3, and 7.
- Requirement 4, pre-send domain checks: Task 4 and Task 6.
- Requirement 5, optional mailbox validation: Task 5 and Task 6.
- Placeholder scan: no `TBD`, `TODO`, or unspecified implementation steps remain.
- Type consistency: `BOUNCE`, `BOUNCED`, `suppressedAt`, and `suppressionReason` are defined in Task 1 and used consistently later.
