# Gmail Sending Replacement Design

Date: 2026-05-22

## Goal

Replace the existing Zoho Mail integration with a personal Gmail account integration for ShipBoost Outreach. The app should connect to Gmail through OAuth, send reviewed outreach drafts directly from the connected Gmail account, and poll Gmail for replies so follow-up logic continues to work.

## Motivation

The operator does not want outreach sent from the official ShipBoost domain email. Using a personal Gmail account avoids the current Zoho/domain setup path and removes the need to configure ShipBoost-domain SPF, DKIM, DMARC, and warming before this tool can send mail.

Gmail does not remove deliverability risk. Gmail still enforces account reputation, daily limits, automated-send detection, and spam policies. The app will keep conservative send caps and should not present Gmail as guaranteed inbox placement.

## Scope

In scope:

- Replace Zoho-facing UI text and connection paths with Gmail.
- Add Gmail OAuth authorization and callback routes.
- Store the connected Gmail refresh token.
- Send reviewed drafts through the Gmail API.
- Record Gmail message IDs and thread IDs.
- Poll Gmail for replies and match them to sent outreach.
- Update environment variable examples and setup instructions.
- Keep the existing daily send cap.

Out of scope:

- Multi-account rotation.
- Warm-up automation.
- Bulk campaign scheduling beyond the existing review/send workflow.
- Gmail draft creation as a separate review step.
- Historical migration of old Zoho message IDs into Gmail threads.

## Recommended Approach

Use the Gmail API with OAuth. This mirrors the current Zoho architecture: authorize once, store a refresh token, refresh access tokens server-side, send via provider REST API, and poll the inbox for replies.

SMTP/app-password sending is not recommended because it would still need a second mechanism for reply polling and is less aligned with Google's current OAuth-first account security model.

## UI Design

The inbox remains the primary operator surface.

Changes:

- Replace Zoho connection copy with Gmail copy.
- Provide a "Connect Gmail" action that links to `/api/gmail/authorize`.
- Keep the current "Send" button behavior and keyboard shortcut.
- Show Gmail-specific error text when the provider is not connected.
- Keep the visible daily cap indicator, currently `sent today: n/30`.

The UI should not claim Gmail guarantees higher arrival rate. If helper text is added, it should say that Gmail is connected for sending and replies.

## Backend Architecture

Add a new Gmail provider module:

- `src/lib/gmail/client.ts`
  - Builds the Google OAuth URL.
  - Exchanges authorization codes for refresh tokens.
  - Refreshes access tokens on demand.
  - Provides a typed `gmailFetch` helper.

- `src/lib/gmail/send.ts`
  - Loads the draft and contact.
  - Enforces `PENDING_REVIEW` status.
  - Enforces the existing daily cap of 30.
  - Injects the existing tracking pixel.
  - Builds an RFC 5322 MIME email.
  - Sends via `POST https://gmail.googleapis.com/gmail/v1/users/me/messages/send`.
  - Persists Gmail `id` and `threadId`.

- `src/lib/gmail/replies.ts`
  - Lists recent inbox messages using Gmail API search.
  - Matches replies by Gmail `threadId` first.
  - Falls back to `In-Reply-To`/`References` headers when available.
  - Creates `EmailMessage` and `OutreachEvent(kind=REPLY)` records for new replies.

Add routes:

- `src/app/api/gmail/authorize/route.ts`
- `src/app/api/gmail/callback/route.ts`

Update existing callers:

- `src/app/api/drafts/[id]/send/route.ts` imports Gmail send.
- `src/lib/pipeline/process-follow-ups.ts` imports Gmail reply polling.
- `src/proxy.ts` allows `/api/gmail/callback`.

Remove Zoho routes or leave them unreachable during migration. The preferred final state is Gmail-only code paths for active sending.

## OAuth Scopes

Use the narrowest practical scopes:

- `https://www.googleapis.com/auth/gmail.send`
- `https://www.googleapis.com/auth/gmail.readonly`
- `openid`
- `email`

`gmail.send` is needed for sending. `gmail.readonly` is needed for reply polling. `openid` and `email` allow the app to know which Gmail account was connected.

OAuth URL requirements:

- `access_type=offline`
- `prompt=consent`
- CSRF state cookie with a short expiry, same as the existing Zoho flow.

## Data Model

Generalize provider-specific storage instead of adding more Zoho-named fields.

Replace:

- `ZohoCredential`
- `EmailMessage.zohoMessageId`

With:

- `EmailCredential`
  - `id`
  - `provider` defaulting to `GMAIL`
  - `accountEmail`
  - `refreshToken`
  - `scope`
  - `createdAt`
  - `updatedAt`

- `EmailMessage`
  - `providerMessageId` unique
  - `providerThreadId` optional indexed field
  - existing `draftId`, `direction`, `subject`, `snippet`, `headers`, `receivedAt`

Historical Zoho rows do not need to keep sending functionality. If local data exists with Zoho message IDs, the migration can copy `zohoMessageId` into `providerMessageId` before dropping the old column.

## Environment Variables

Replace Zoho variables with Google OAuth variables:

```env
SENDER_EMAIL=your.personal@gmail.com
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:3000/api/gmail/callback
```

Remove:

```env
ZOHO_CLIENT_ID=
ZOHO_CLIENT_SECRET=
ZOHO_REDIRECT_URI=
ZOHO_ACCOUNT_ID=
```

`SENDER_EMAIL` should match the connected Gmail account. If the connected account email can be read from OAuth identity claims, the app should prefer validating against that value to avoid accidental mismatch.

## Email Formatting

Gmail API send requires a base64url-encoded raw MIME message.

The message should include:

- `From`
- `To`
- `Subject`
- `MIME-Version: 1.0`
- `Content-Type: text/html; charset=UTF-8`

The app should keep using the generated HTML body plus the tracking pixel. Plain text multipart is optional for this migration; HTML-only matches the current Zoho behavior.

## Reply Matching

When sending, persist:

- Gmail `id` as `providerMessageId`
- Gmail `threadId` as `providerThreadId`

When polling:

1. Query recent inbox messages.
2. Ignore messages already stored by `providerMessageId`.
3. Match `threadId` to a stored outbound email.
4. If no thread match, inspect headers for `In-Reply-To` and `References`.
5. Create inbound message and reply event for matches.

This keeps follow-up suppression working when a recipient replies.

## Error Handling

Expected errors:

- Gmail not connected.
- Google OAuth state mismatch.
- Refresh token revoked.
- Gmail send limit or policy error.
- Sender account mismatch.

Behavior:

- Return a clear API error to the UI.
- Mark draft `FAILED` only after a send attempt reaches Gmail and cannot produce a message ID.
- Do not mark a draft failed for missing credentials or OAuth setup errors.

## Testing And Verification

Static verification:

- Typecheck the app.
- Run the existing test suite.
- Add or update focused tests for MIME generation and Gmail send response handling where practical.

Manual verification:

1. Start the app locally.
2. Visit `/api/gmail/authorize`.
3. Connect the personal Gmail account.
4. Confirm `EmailCredential` stores a Gmail refresh token and account email.
5. Send one draft to a controlled mailbox.
6. Confirm the draft is marked `SENT`.
7. Confirm `EmailMessage` contains Gmail message ID and thread ID.
8. Reply to the message.
9. Run follow-up polling.
10. Confirm a `REPLY` event is created and follow-up generation does not proceed for that thread.

## Rollout

1. Implement schema migration and regenerate Prisma client.
2. Add Gmail client/send/reply modules.
3. Update routes and imports.
4. Update UI copy and env examples.
5. Remove or quarantine Zoho code paths.
6. Run verification.
7. Connect Gmail in production and send a low-volume test.

## Acceptance Criteria

- The active connect flow is Gmail, not Zoho.
- One-click send sends from the connected personal Gmail account.
- New outbound messages store Gmail message ID and thread ID.
- Replies can be matched and recorded.
- Zoho env vars are no longer required for active sending.
- Existing daily cap remains in force.
