# Outreach $19 Refresh Implementation Plan

**Goal:** Align live cold-email templates and queued drafts with the approved $19 offer.

**Architecture:** Share the offer between first-touch and hybrid templates. Keep
versioned angle keys for measurement. Honor existing Source.enabled and
Contact.suppressedAt fields throughout the queue. Use a backed-up, idempotent
maintenance script for pending drafts and permanent bounces.

**Tech stack:** Next.js, TypeScript, Prisma/Postgres, Vitest, Vercel.

Execution stays in this session under the user's instruction to proceed.

- [x] Save send-lane schedules and temporarily defer sending.
- [x] Add `src/lib/draft/offer.ts`; refresh and version the three template files.
- [x] Update existing pricing/voice checks; add source-pause and suppression checks.
- [x] Honor source enablement in fetch, process-pending, and automatic sending.
- [x] Add a dry-run-first `scripts/refresh-pending-offer.ts` with backup, conditional
  updates, unknown-template rejection, and permanent-bounce cleanup.
- [x] Run `npm test`, `npx tsc --noEmit`, and lint on the changed code.
- [x] Dry-run migration and inspect rendered examples.
- [x] Deploy the tested code to the existing Vercel production project.
- [x] Apply migration, pause HN, verify no stale pending prices, and restore lanes.
- [x] Record final changed counts and production verification.

## Validation and release

- 85 automated tests passed; the manual email sending test remained skipped.
- Typecheck and lint on changed code passed.
- Production build passed on Node 22; deployed to https://shipboost-outreach.vercel.app.
- Refreshed 1,053 pending drafts with backups; repeated dry run found zero changes.
- Suppressed 62 previously unsuppressed permanent-bounce contacts.
- Paused HACKER_NEWS; preserved 588 HN drafts, leaving 465 eligible first emails.
- Authenticated production dashboard returned 200 with the new estimated revenue metric.
- Historical payment amounts and sent email content were not changed.
- Verified zero stale pending prices, restored both prior lane schedules, and left follow-ups disabled as before.
