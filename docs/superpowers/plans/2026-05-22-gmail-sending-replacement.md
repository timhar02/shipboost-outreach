# Gmail Sending Replacement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the active Zoho Mail integration with Gmail OAuth, Gmail API sending, and Gmail reply polling.

**Architecture:** Generalize provider persistence in Prisma, then add focused Gmail modules for OAuth, MIME generation, sending, and reply polling. Keep the existing inbox, send endpoint, and follow-up pipeline contracts so most of the app continues to call `sendDraft()` and `pollReplies()` with minimal changes.

**Tech Stack:** Next.js 16 app routes, React 19, Prisma 6, PostgreSQL, Vitest, Undici, Gmail REST API.

---

## File Structure

- Modify `prisma/schema.prisma`: add `EmailProvider`, replace `ZohoCredential` with `EmailCredential`, rename email message provider fields.
- Create `prisma/migrations/20260522000000_replace_zoho_with_gmail/migration.sql`: migrate existing data without relying on `prisma migrate dev` generation.
- Create `src/lib/gmail/client.ts`: Google OAuth URL, token exchange, token refresh, REST helper, connected account lookup.
- Create `src/lib/gmail/mime.ts`: deterministic MIME building and base64url encoding.
- Create `src/lib/gmail/send.ts`: draft validation, cap enforcement, pixel injection, Gmail send call, persistence.
- Create `src/lib/gmail/replies.ts`: inbox list/get polling and reply matching.
- Create `src/app/api/gmail/authorize/route.ts`: OAuth redirect route.
- Create `src/app/api/gmail/callback/route.ts`: OAuth callback and credential upsert route.
- Modify `src/app/api/drafts/[id]/send/route.ts`: import Gmail send.
- Modify `src/lib/pipeline/process-follow-ups.ts`: import Gmail reply polling.
- Modify `src/proxy.ts`: make Gmail callback public and remove Zoho callback.
- Modify `src/app/inbox/InboxClient.tsx`: Gmail-specific send error/connect affordance.
- Modify `.env.local.example`: replace Zoho env vars with Google env vars.
- Delete or quarantine `src/app/api/zoho/*` and `src/lib/zoho/*`: active code should not depend on Zoho.
- Create `tests/gmail/mime.test.ts`: MIME encoding coverage.
- Create `tests/gmail/send.test.ts`: focused send behavior coverage with mocked Prisma and Gmail client.

## External API Notes

Google's official Gmail docs confirm:

- `users.messages.send` accepts a message resource with `raw` containing a base64url-encoded RFC 2822 MIME message.
- `users.messages.list` returns message `id` and `threadId`; full headers require `users.messages.get`.
- OAuth web-server apps should request `access_type=offline` to receive refresh tokens.

Sources used:

- https://developers.google.com/workspace/gmail/api/guides/sending
- https://developers.google.com/workspace/gmail/api/guides/list-messages
- https://developers.google.com/workspace/gmail/api/auth/scopes
- https://developers.google.com/identity/protocols/oauth2/web-server

---

### Task 1: Prisma Provider Migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260522000000_replace_zoho_with_gmail/migration.sql`

- [ ] **Step 1: Update Prisma schema**

Change `EmailMessage` and replace `ZohoCredential` with:

```prisma
enum EmailProvider {
  GMAIL
}

model EmailMessage {
  id                String        @id @default(cuid())
  draft             OutreachDraft @relation(fields: [draftId], references: [id])
  draftId           String
  providerMessageId String        @unique
  providerThreadId  String?
  direction         Direction
  subject           String
  snippet           String
  headers           Json
  receivedAt        DateTime      @default(now())

  @@index([providerThreadId])
}

model EmailCredential {
  id           String        @id @default(cuid())
  provider     EmailProvider @default(GMAIL)
  accountEmail String
  refreshToken String
  scope        String
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt

  @@unique([provider, accountEmail])
}
```

- [ ] **Step 2: Write migration SQL**

Create `prisma/migrations/20260522000000_replace_zoho_with_gmail/migration.sql`:

```sql
CREATE TYPE "EmailProvider" AS ENUM ('GMAIL');

ALTER TABLE "EmailMessage" RENAME COLUMN "zohoMessageId" TO "providerMessageId";
ALTER TABLE "EmailMessage" ADD COLUMN "providerThreadId" TEXT;

ALTER INDEX "EmailMessage_zohoMessageId_key" RENAME TO "EmailMessage_providerMessageId_key";
CREATE INDEX "EmailMessage_providerThreadId_idx" ON "EmailMessage"("providerThreadId");

CREATE TABLE "EmailCredential" (
    "id" TEXT NOT NULL,
    "provider" "EmailProvider" NOT NULL DEFAULT 'GMAIL',
    "accountEmail" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EmailCredential_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EmailCredential_provider_accountEmail_key" ON "EmailCredential"("provider", "accountEmail");

DROP TABLE "ZohoCredential";
```

- [ ] **Step 3: Regenerate Prisma client**

Run: `npm run prisma:generate`

Expected: Prisma client generation succeeds with `EmailCredential`, `EmailProvider`, `providerMessageId`, and `providerThreadId` types available.

---

### Task 2: Gmail OAuth Client

**Files:**
- Create: `src/lib/gmail/client.ts`
- Create: `src/app/api/gmail/authorize/route.ts`
- Create: `src/app/api/gmail/callback/route.ts`
- Modify: `src/proxy.ts`

- [ ] **Step 1: Create Gmail client**

Implement these exports in `src/lib/gmail/client.ts`:

```ts
export const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.readonly",
  "openid",
  "email",
].join(" ");

export function authorizeUrl(state: string): string;
export async function exchangeCodeForRefreshToken(code: string): Promise<{ refreshToken: string; accountEmail: string }>;
export async function getAccessToken(): Promise<string>;
export async function gmailFetch<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T>;
export async function getConnectedGmailAccount(): Promise<{ accountEmail: string } | null>;
```

Use:

- Auth base: `https://accounts.google.com/o/oauth2/v2/auth`
- Token URL: `https://oauth2.googleapis.com/token`
- Gmail base: `https://gmail.googleapis.com/gmail/v1`
- Userinfo URL: `https://openidconnect.googleapis.com/v1/userinfo`

Required auth URL params: `response_type=code`, `client_id`, `redirect_uri`, `scope`, `access_type=offline`, `prompt=consent`, `state`.

- [ ] **Step 2: Create authorize route**

Create `src/app/api/gmail/authorize/route.ts`:

```ts
import { NextResponse } from "next/server";
import { authorizeUrl } from "@/lib/gmail/client";
import crypto from "node:crypto";

export async function GET() {
  const state = crypto.randomBytes(16).toString("hex");
  const res = NextResponse.redirect(authorizeUrl(state));
  res.cookies.set("gmail_oauth_state", state, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 600 });
  return res;
}
```

- [ ] **Step 3: Create callback route**

Create `src/app/api/gmail/callback/route.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { exchangeCodeForRefreshToken, GMAIL_SCOPES } from "@/lib/gmail/client";
import { prisma } from "@/server/db/client";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const expected = req.cookies.get("gmail_oauth_state")?.value;
  if (!code || !state || state !== expected) {
    return NextResponse.json({ ok: false, error: "state mismatch" }, { status: 400 });
  }

  const { refreshToken, accountEmail } = await exchangeCodeForRefreshToken(code);
  await prisma.emailCredential.upsert({
    where: { provider_accountEmail: { provider: "GMAIL", accountEmail } },
    update: { refreshToken, scope: GMAIL_SCOPES },
    create: { provider: "GMAIL", accountEmail, refreshToken, scope: GMAIL_SCOPES },
  });

  return NextResponse.redirect(new URL("/inbox", req.url));
}
```

- [ ] **Step 4: Update proxy allowlist**

In `src/proxy.ts`, replace `/api/zoho/callback` with `/api/gmail/callback`.

---

### Task 3: Gmail MIME Builder

**Files:**
- Create: `src/lib/gmail/mime.ts`
- Create: `tests/gmail/mime.test.ts`

- [ ] **Step 1: Write MIME tests**

Create `tests/gmail/mime.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildRawHtmlEmail } from "@/lib/gmail/mime";

describe("buildRawHtmlEmail", () => {
  it("builds base64url encoded html email", () => {
    const raw = buildRawHtmlEmail({
      from: "tim.personal@gmail.com",
      to: "founder@example.com",
      subject: "Hello from ShipBoost",
      html: "<p>Hi there</p>",
    });

    expect(raw).not.toContain("+");
    expect(raw).not.toContain("/");
    expect(raw).not.toContain("=");

    const decoded = Buffer.from(raw.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    expect(decoded).toContain("From: tim.personal@gmail.com");
    expect(decoded).toContain("To: founder@example.com");
    expect(decoded).toContain("Subject: Hello from ShipBoost");
    expect(decoded).toContain("Content-Type: text/html; charset=UTF-8");
    expect(decoded).toContain("<p>Hi there</p>");
  });

  it("encodes non-ascii subjects as encoded words", () => {
    const raw = buildRawHtmlEmail({
      from: "tim.personal@gmail.com",
      to: "founder@example.com",
      subject: "Quick note — ShipBoost",
      html: "<p>Hi</p>",
    });
    const decoded = Buffer.from(raw.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    expect(decoded).toContain("Subject: =?UTF-8?B?");
  });
});
```

- [ ] **Step 2: Run failing test**

Run: `npm test -- tests/gmail/mime.test.ts`

Expected: FAIL because `src/lib/gmail/mime.ts` does not exist.

- [ ] **Step 3: Implement MIME helper**

Create `src/lib/gmail/mime.ts` with:

```ts
type RawHtmlEmailInput = {
  from: string;
  to: string;
  subject: string;
  html: string;
};

export function buildRawHtmlEmail(input: RawHtmlEmailInput): string {
  const message = [
    `From: ${escapeHeader(input.from)}`,
    `To: ${escapeHeader(input.to)}`,
    `Subject: ${encodeSubject(input.subject)}`,
    "MIME-Version: 1.0",
    "Content-Type: text/html; charset=UTF-8",
    "",
    input.html,
  ].join("\r\n");

  return Buffer.from(message, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function escapeHeader(value: string): string {
  return value.replace(/[\r\n]/g, " ").trim();
}

function encodeSubject(subject: string): string {
  const clean = escapeHeader(subject);
  if (/^[\x20-\x7E]*$/.test(clean)) return clean;
  return `=?UTF-8?B?${Buffer.from(clean, "utf8").toString("base64")}?=`;
}
```

- [ ] **Step 4: Run MIME test**

Run: `npm test -- tests/gmail/mime.test.ts`

Expected: PASS.

---

### Task 4: Gmail Send

**Files:**
- Create: `src/lib/gmail/send.ts`
- Modify: `src/app/api/drafts/[id]/send/route.ts`
- Create: `tests/gmail/send.test.ts`

- [ ] **Step 1: Write focused send tests**

Create tests that mock `@/server/db/client`, `@/lib/gmail/client`, and verify:

- Missing Gmail credential throws `No Gmail credential`.
- Sender mismatch throws before marking draft failed.
- Successful send stores `providerMessageId` and `providerThreadId`.

Use the current `sendDraft(draftId: string): Promise<{ gmailMessageId: string; gmailThreadId: string }>` contract.

- [ ] **Step 2: Implement Gmail send**

Create `src/lib/gmail/send.ts`:

```ts
import { prisma } from "@/server/db/client";
import { getConnectedGmailAccount, gmailFetch } from "./client";
import { buildRawHtmlEmail } from "./mime";

const DAILY_CAP = 30;

export async function sendDraft(draftId: string): Promise<{ gmailMessageId: string; gmailThreadId: string }> {
  const draft = await prisma.outreachDraft.findUniqueOrThrow({
    where: { id: draftId },
    include: { contact: true },
  });
  if (draft.status !== "PENDING_REVIEW") throw new Error(`draft not pending (status=${draft.status})`);

  const connected = await getConnectedGmailAccount();
  if (!connected) throw new Error("No Gmail credential - visit /api/gmail/authorize");

  const fromAddress = process.env.SENDER_EMAIL;
  if (!fromAddress) throw new Error("SENDER_EMAIL missing");
  if (connected.accountEmail.toLowerCase() !== fromAddress.toLowerCase()) {
    throw new Error(`SENDER_EMAIL (${fromAddress}) does not match connected Gmail account (${connected.accountEmail})`);
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const sentToday = await prisma.outreachDraft.count({ where: { status: "SENT", sentAt: { gte: todayStart } } });
  if (sentToday >= DAILY_CAP) throw new Error(`daily send cap reached (${DAILY_CAP})`);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const pixel = `<img src="${appUrl}/api/pixel/${draft.id}" width="1" height="1" alt="" style="display:block">`;
  const bodyHtml = draft.body.includes("</body>") ? draft.body.replace("</body>", `${pixel}</body>`) : draft.body + pixel;

  const raw = buildRawHtmlEmail({
    from: fromAddress,
    to: draft.contact.email,
    subject: draft.subject,
    html: bodyHtml,
  });

  const res = await gmailFetch<{ id?: string; threadId?: string }>("/users/me/messages/send", {
    method: "POST",
    body: { raw },
  });

  if (!res.id || !res.threadId) {
    await prisma.outreachDraft.update({ where: { id: draftId }, data: { status: "FAILED" } });
    throw new Error(`Gmail send returned no message id: ${JSON.stringify(res)}`);
  }

  await prisma.$transaction([
    prisma.outreachDraft.update({ where: { id: draftId }, data: { status: "SENT", sentAt: new Date() } }),
    prisma.emailMessage.create({
      data: {
        draftId,
        providerMessageId: res.id,
        providerThreadId: res.threadId,
        direction: "OUT",
        subject: draft.subject,
        snippet: draft.bodyText.slice(0, 200),
        headers: {},
      },
    }),
  ]);

  return { gmailMessageId: res.id, gmailThreadId: res.threadId };
}
```

- [ ] **Step 3: Update send route import**

In `src/app/api/drafts/[id]/send/route.ts`, replace:

```ts
import { sendDraft } from "@/lib/zoho/send";
```

with:

```ts
import { sendDraft } from "@/lib/gmail/send";
```

- [ ] **Step 4: Run Gmail send tests**

Run: `npm test -- tests/gmail/send.test.ts`

Expected: PASS.

---

### Task 5: Gmail Reply Polling

**Files:**
- Create: `src/lib/gmail/replies.ts`
- Modify: `src/lib/pipeline/process-follow-ups.ts`

- [ ] **Step 1: Implement Gmail reply polling**

Create `src/lib/gmail/replies.ts` with:

```ts
import { prisma } from "@/server/db/client";
import { gmailFetch } from "./client";

type GmailListResponse = { messages?: Array<{ id: string; threadId: string }> };
type GmailMessage = {
  id: string;
  threadId: string;
  snippet?: string;
  payload?: { headers?: Array<{ name: string; value: string }> };
};

export async function pollReplies(): Promise<{ matched: number }> {
  const listed = await gmailFetch<GmailListResponse>("/users/me/messages?maxResults=200&labelIds=INBOX&q=newer_than:14d");
  const items = listed.messages ?? [];
  let matched = 0;

  for (const item of items) {
    if (await prisma.emailMessage.findUnique({ where: { providerMessageId: item.id } })) continue;

    const outbound = await prisma.emailMessage.findFirst({
      where: { direction: "OUT", providerThreadId: item.threadId },
    });
    if (!outbound) continue;

    const full = await gmailFetch<GmailMessage>(`/users/me/messages/${item.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=In-Reply-To&metadataHeaders=References`);
    const headers = Object.fromEntries((full.payload?.headers ?? []).map((h) => [h.name.toLowerCase(), h.value]));

    await prisma.$transaction([
      prisma.emailMessage.create({
        data: {
          draftId: outbound.draftId,
          providerMessageId: full.id,
          providerThreadId: full.threadId,
          direction: "IN",
          subject: headers.subject ?? "",
          snippet: (full.snippet ?? "").slice(0, 200),
          headers,
        },
      }),
      prisma.outreachEvent.create({
        data: { draftId: outbound.draftId, kind: "REPLY", payload: { gmailMessageId: full.id, gmailThreadId: full.threadId } },
      }),
    ]);
    matched++;
  }

  return { matched };
}
```

- [ ] **Step 2: Update follow-up import**

In `src/lib/pipeline/process-follow-ups.ts`, replace:

```ts
import { pollReplies } from "@/lib/zoho/replies";
```

with:

```ts
import { pollReplies } from "@/lib/gmail/replies";
```

---

### Task 6: UI And Config Rewire

**Files:**
- Modify: `src/app/inbox/InboxClient.tsx`
- Modify: `.env.local.example`
- Delete: `src/app/api/zoho/accounts/route.ts`
- Delete: `src/app/api/zoho/authorize/route.ts`
- Delete: `src/app/api/zoho/callback/route.ts`
- Delete: `src/lib/zoho/client.ts`
- Delete: `src/lib/zoho/replies.ts`
- Delete: `src/lib/zoho/send.ts`

- [ ] **Step 1: Update inbox send error affordance**

When send fails, keep the alert but append Gmail setup guidance for missing credentials:

```ts
const text = await res.text();
if (text.includes("No Gmail credential")) {
  alert("Gmail is not connected. Visit /api/gmail/authorize to connect your account.");
} else {
  alert(`Send failed: ${text}`);
}
```

Add a small header link to `/api/gmail/authorize` labelled `connect gmail`.

- [ ] **Step 2: Update env example**

Replace Zoho variables in `.env.local.example`:

```env
SENDER_EMAIL=your.personal@gmail.com
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:3000/api/gmail/callback
```

- [ ] **Step 3: Delete Zoho active code**

Remove the Zoho API route files and Zoho library files listed above.

- [ ] **Step 4: Search for stale Zoho imports**

Run: `rg -n "zoho|Zoho|ZOHO" src prisma .env.local.example`

Expected: no active `src` or Prisma references remain.

---

### Task 7: Verification

**Files:**
- No new files unless fixes are needed.

- [ ] **Step 1: Run tests**

Run: `npm test`

Expected: all tests pass.

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit`

Expected: no TypeScript errors.

- [ ] **Step 3: Run lint**

Run: `npm run lint`

Expected: lint completes without new errors.

- [ ] **Step 4: Build**

Run: `npm run build`

Expected: Next.js production build succeeds.

- [ ] **Step 5: Manual local smoke path**

Run: `npm run dev`, then visit `/api/gmail/authorize`, connect Gmail, send one controlled draft, reply to it, and run the follow-up cron.

Expected:

- Draft becomes `SENT`.
- `EmailMessage.providerMessageId` and `EmailMessage.providerThreadId` are populated.
- Reply polling creates one inbound `EmailMessage`.
- Reply polling creates one `OutreachEvent(kind=REPLY)`.

---

## Self-Review

- Spec coverage: provider replacement, Gmail OAuth, Gmail send, reply polling, UI copy, env changes, cap preservation, and verification are covered.
- Placeholder scan: no `TBD`, `TODO`, or unspecified "handle later" steps remain.
- Type consistency: plan uses `EmailCredential`, `EmailProvider.GMAIL`, `providerMessageId`, `providerThreadId`, `gmailFetch`, `sendDraft`, and `pollReplies` consistently.
