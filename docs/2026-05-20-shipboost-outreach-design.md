# ShipBoost Outreach — Design Spec

**Date:** 2026-05-20
**Status:** Draft, pending review
**Owner:** Tim (thart@digirx.com)

---

## 1. Goal

Build a daily cold-outreach tool that:

1. Fetches new SaaS launches from Product Hunt (and later other launch platforms).
2. Scrapes each product's website for a founder/contact email.
3. Drafts a personalized cold email using Claude + the ShipBoost voice profile, rotating across multiple templates to avoid spam-pattern detection.
4. Presents drafts in an inbox-style review UI for one-click send through Zoho Mail.
5. Tracks opens, detects replies, and auto-schedules 5-day follow-ups for non-responders.

Single-user (Tim). MVP scope: **Product Hunt only**. Future sources (PeerPush, PeerList, Uneed, Foundrlist, ScrollLaunch) are designed-in but deferred.

---

## 2. Architecture

```
shipboost-outreach (deployed to Vercel)
├── Next.js 16 + React 19 + TypeScript
├── Postgres on Neon (free tier, Vercel-native)
├── Prisma ORM
├── Vercel Cron — daily fetch + daily follow-ups
├── Zoho Mail API (OAuth) — send + read replies
└── undici + cheerio — website scraping

GitHub Actions (deferred to v2)
└── scrape-worker — scrapes directory listing pages
    (PeerPush, Uneed, etc.) and POSTs to /api/ingest/launches
    when Vercel IPs get blocked.
```

### Why this shape

- Vercel handles UI, DB, sending, and product-website scraping (low block risk).
- Cron native to Vercel — no separate scheduler.
- GHA escape hatch covers the case where directory pages block Vercel's AWS IPs. Architecture stays the same; only the scraper origin changes.

---

## 3. Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript |
| Styling | Tailwind v4 + shadcn/ui |
| DB | Postgres on Neon |
| ORM | Prisma |
| Validation | Zod |
| Auth | Single-user — env-gated middleware + signed cookie (`OUTREACH_PASSWORD`) |
| HTTP | undici (Node 20 built-in) |
| HTML parsing | cheerio |
| Robots | robots-parser |
| Drafting | Pre-written template variations + variable substitution (no LLM) |
| Email send | Zoho Mail REST API (direct fetch — no Nodemailer) |
| Cron | Vercel Cron |
| Tests | Vitest |
| Lint | ESLint + Prettier (match `my-app` config) |

Node 20.x. Same versioning rails as the sibling `my-app`.

---

## 4. Repo layout

```
outreach/
├── docs/
│   └── 2026-05-20-shipboost-outreach-design.md   ← this file
├── prisma/
│   └── schema.prisma
├── src/
│   ├── app/
│   │   ├── inbox/page.tsx
│   │   ├── settings/page.tsx
│   │   └── api/
│   │       ├── cron/
│   │       │   ├── fetch-launches/route.ts
│   │       │   └── follow-ups/route.ts
│   │       ├── drafts/[id]/send/route.ts
│   │       ├── drafts/[id]/skip/route.ts
│   │       ├── drafts/[id]/route.ts          ← PATCH edit
│   │       ├── pixel/[id]/route.ts           ← 1x1 GIF
│   │       ├── ingest/launches/route.ts      ← v2 GHA ingress
│   │       └── zoho/
│   │           ├── authorize/route.ts
│   │           └── callback/route.ts
│   ├── lib/
│   │   ├── sources/
│   │   │   ├── types.ts                      ← LaunchSource interface
│   │   │   ├── product-hunt.ts
│   │   │   └── README.md                     ← how to add a new source
│   │   ├── scrape/
│   │   │   ├── fetch-html.ts                 ← polite headers, jitter, robots
│   │   │   └── extract-email.ts
│   │   ├── draft/
│   │   │   ├── templates.ts                  ← 10-15 pre-written variations
│   │   │   ├── render.ts                     ← variable substitution + HTML→text
│   │   │   └── select.ts                     ← deterministic rotation
│   │   ├── zoho/
│   │   │   ├── client.ts                     ← OAuth token mgmt
│   │   │   ├── send.ts
│   │   │   └── replies.ts                    ← poll inbox, match In-Reply-To
│   │   └── pipeline/
│   │       ├── fetch-and-queue.ts            ← orchestrates daily fetch
│   │       └── process-follow-ups.ts
│   └── server/
│       └── db/client.ts                      ← single Prisma client
├── vercel.json                                ← cron schedule
└── package.json
```

---

## 5. Data model (Prisma)

```prisma
enum SourceKind { PRODUCT_HUNT PEERPUSH PEERLIST UNEED FOUNDRLIST SCROLLLAUNCH }
enum DraftStatus { PENDING_REVIEW SENT SKIPPED FAILED }
enum EventKind { OPEN REPLY FOLLOWUP_SENT }
enum Direction { OUT IN }
enum DiscoveredFrom { CONTACT_PAGE ABOUT_PAGE HOMEPAGE_FOOTER MAILTO_LINK META_TAG }

model Source {
  id        String     @id @default(cuid())
  kind      SourceKind @unique
  name      String
  enabled   Boolean    @default(true)
  launches  Launch[]
}

model Launch {
  id          String   @id @default(cuid())
  source      Source   @relation(fields: [sourceId], references: [id])
  sourceId    String
  externalId  String   // PH post id, etc.
  name        String
  tagline     String?
  url         String   // product website
  launchedAt  DateTime
  raw         Json
  fetchedAt   DateTime @default(now())
  contact     Contact?
  @@unique([sourceId, externalId])
}

model Contact {
  id              String         @id @default(cuid())
  email           String         @unique
  domain          String         @unique  // free dedup at domain level
  name            String?
  launch          Launch         @relation(fields: [launchId], references: [id])
  launchId        String         @unique
  discoveredFrom  DiscoveredFrom
  drafts          OutreachDraft[]
  createdAt       DateTime       @default(now())
}

model OutreachDraft {
  id           String        @id @default(cuid())
  contact      Contact       @relation(fields: [contactId], references: [id])
  contactId    String
  parentDraft  OutreachDraft? @relation("FollowUp", fields: [parentDraftId], references: [id])
  parentDraftId String?
  followUps    OutreachDraft[] @relation("FollowUp")
  templateKey  String
  subject      String
  body         String         // HTML
  bodyText     String         // plain-text alt
  status       DraftStatus    @default(PENDING_REVIEW)
  createdAt    DateTime       @default(now())
  sentAt       DateTime?
  events       OutreachEvent[]
  messages     EmailMessage[]
}

model OutreachEvent {
  id        String    @id @default(cuid())
  draft     OutreachDraft @relation(fields: [draftId], references: [id])
  draftId   String
  kind      EventKind
  payload   Json
  createdAt DateTime  @default(now())
}

model EmailMessage {
  id             String    @id @default(cuid())
  draft          OutreachDraft @relation(fields: [draftId], references: [id])
  draftId        String
  zohoMessageId  String    @unique
  direction      Direction
  subject        String
  snippet        String
  headers        Json
  receivedAt     DateTime  @default(now())
}

model ZohoCredential {
  id            String   @id @default(cuid())
  accountId     String   // Zoho account ID
  refreshToken  String   // long-lived; access tokens cached in-memory
  scope         String
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}
```

There is at most one `ZohoCredential` row at any time (single-user app).

**Dedup contract:** `Contact.email` and `Contact.domain` are both unique. Insert with `upsert` keyed on email; skip if exists.

---

## 6. Daily pipeline

### 6.1 Fetch (cron `0 9 * * *` UTC)

Endpoint: `GET /api/cron/fetch-launches` (guarded by `x-cron-secret: $CRON_SECRET`).

Steps:
1. Call PH GraphQL `posts(postedAfter: yesterday09:00)`.
2. Filter:
   - Has `website` (not just internal PH URL).
   - Topic NOT in deny-list (`extensions`, `physical`, `templates`, `ai-tools` if too generic, etc. — exact list lives in `lib/sources/product-hunt.ts` and is iterable).
   - `votesCount > 5` (cheap signal it's a real launch, not abandoned).
3. Upsert each into `Launch` (`@@unique([sourceId, externalId])`).
4. For each new launch:
   - Skip if `Contact.domain` already exists (cross-launch dedup).
   - Run `scrape.extractEmail(launch.url)`.
   - If no email found, log and move on.
   - Upsert `Contact`.
   - Generate draft (see §7).
   - Insert `OutreachDraft` with status `PENDING_REVIEW`.
5. Hard cap: stop after 30 drafts created in a single run.

### 6.2 Follow-ups (cron `0 10 * * *` UTC)

Endpoint: `GET /api/cron/follow-ups`.

Steps:
1. Poll Zoho inbox (last 7 days). For each message, look up parent draft by `In-Reply-To` header → matched `EmailMessage.zohoMessageId`. Record `EmailMessage` (direction=IN) + `OutreachEvent(kind=REPLY)`.
2. Find drafts where:
   - `status = SENT`
   - `sentAt < now - 5 days`
   - No `OutreachEvent(kind=REPLY)` exists
   - No `OutreachEvent(kind=FOLLOWUP_SENT)` exists
3. For each, generate a shorter follow-up draft (`templateKey` from `follow-up-*` set). Insert as new `OutreachDraft` with `parentDraftId` pointing at the original. Mark `FOLLOWUP_SENT` on the parent so we don't double-schedule.

### 6.3 Vercel cron config

Hobby tier allows 2 cron jobs. If we hit the limit, merge into one route that branches on `searchParams.task`.

```json
// vercel.json
{
  "crons": [
    { "path": "/api/cron/fetch-launches", "schedule": "0 9 * * *" },
    { "path": "/api/cron/follow-ups",      "schedule": "0 10 * * *" }
  ]
}
```

---

## 7. Draft generation

**No LLM.** Drafts are produced from 10–15 hand-written templates that already follow the ShipBoost voice profile, with variable substitution for personalization. This is deterministic, free, fast, and immune to LLM drift or off-voice output.

### 7.1 Template structure

Each template in `lib/draft/templates.ts`:

```ts
type Template = {
  key: string;                 // stable id, e.g. "ph-01-spike-diagnosis"
  subject: string;             // may contain {{vars}}
  bodyHtml: string;            // may contain {{vars}}
  // bodyText derived automatically from bodyHtml at render time
};
```

All templates share the ShipBoost skeleton — **problem-first hook → mechanism → soft CTA** — but vary in:
- Opener (diagnostic statement, observation, congrats-then-pivot, direct question)
- Structure (3 short paras / 2 paras + bulleted mechanic / single tight para)
- Length (60–140 words)
- CTA shape ("worth a look?", "happy to share more", "want me to send the breakdown?")

### 7.2 Available variables

Substituted by `lib/draft/render.ts`:

| Variable | Source | Fallback |
|---|---|---|
| `{{first_name}}` | Scraped from contact page / about page | `"Hey,"` opener |
| `{{product_name}}` | PH `post.name` | — required |
| `{{tagline}}` | PH `post.tagline` | — required |
| `{{website_domain}}` | normalized hostname of `post.website` | — required |
| `{{sender_first_name}}` | env `SENDER_FIRST_NAME` | "Tim" |

Templates that reference `{{first_name}}` have a `_noname` variant that opens differently when no first name was scraped. Render layer picks the right variant.

### 7.3 Rotation

```ts
selectTemplate(domain: string, available: Template[]): Template
// = available[hashDomain(domain) % available.length]
```

Deterministic per-contact (re-renders never change). Even distribution across recipients over time. Each draft records `templateKey` for later analysis (open rate by template, etc.).

### 7.4 Voice-profile binding

Templates are written by hand to follow `voice-profile-shipboost.md` — no runtime dependency on the profile file. The profile lives in `ShipBoost-Docs` for reference, but the templates themselves are the artifact.

When adding/editing templates, the author must re-read the voice profile and verify each template against the "Never Do This" list (no contrast flips, no LinkedIn hooks, no staccato fragment stacks, no corporate vocabulary).

### 7.5 Sample templates (for reference — full set drafted at implementation)

**Template `ph-01-spike-diagnosis` (with first name):**

> Subject: `{{product_name}} — past launch day`
>
> Hey {{first_name}},
>
> Saw {{product_name}} on Product Hunt. {{tagline}} — the kind of positioning that usually earns a launch-day spike and then nothing.
>
> Most launch sites give you the spike. Most directories give you a dead listing. ShipBoost is built to handle both — distribution today, discoverability after the launch week rotates.
>
> If that's a problem worth solving for {{website_domain}}, happy to send the breakdown.
>
> — {{sender_first_name}}

**Template `ph-02-direct-question` (no name variant):**

> Subject: `quick question about {{product_name}}`
>
> Hey,
>
> Caught {{product_name}} on PH today. One question: what's the plan for week two?
>
> Launch-day traffic is a one-time event. Buyers searching for what you do next month won't see the launch — they'll see whatever ranks. ShipBoost gives the listing a second job: stay discoverable after the launch window closes.
>
> Worth a look?
>
> — {{sender_first_name}}
> shipboost.com

**Template `ph-03-anti-definition`:**

> Subject: `{{product_name}}`
>
> Hey {{first_name}},
>
> Congrats on the {{product_name}} launch.
>
> ShipBoost isn't a Product Hunt clone. Not a generic AI tools list. Not a startup cemetery. It's a founder-ready listing that keeps earning trust through categories, tags, and alternatives pages after launch week ends.
>
> If {{website_domain}} should still be findable in a month, that's what we do.
>
> — {{sender_first_name}}

(The remaining 7–12 templates rotate openers like "Just saw…", "On {{tagline}} —", direct mechanic-first openings, and follow-up shapes. All authored against the voice profile.)

### 7.6 Follow-up templates

Separate set in `lib/draft/follow-up-templates.ts`. Shorter (40–80 words). Same rotation. Reference the original draft's subject line (`Re: {{original_subject}}`). 3–5 variations is enough since each contact only sees one follow-up.

Example:

> Subject: `Re: {{original_subject}}`
>
> Hey {{first_name}},
>
> Floating this back up in case it got buried. Still worth a look for {{website_domain}}?
>
> — {{sender_first_name}}

---

## 8. Email discovery (free scraping)

`lib/scrape/extract-email.ts`:

```ts
extractEmail(url: string): Promise<{ email: string; name?: string; source: DiscoveredFrom } | null>
```

Order of attempts (stop at first hit):
1. Fetch homepage → look for `mailto:` links → look in footer text for email regex.
2. If none, fetch `/contact`, `/contact-us`, `/about` → same parsing.
3. Check `<meta property="og:email">` and structured data (`Organization` JSON-LD).

Validation:
- Must match basic email regex.
- Domain of email must match domain of site (rejects `support@vercel.com` on a hosted indie site, etc.) — with allow-list exception for `gmail.com`/`hey.com`/`fastmail.com` etc. when the email-local-part matches a name on the site.
- Reject role-account locals (`noreply@`, `support@`, `info@`, `hello@` is a soft-reject — keep but flag with lower priority).

### Scraping politeness (`lib/scrape/fetch-html.ts`)

- User-Agent: `ShipBoost-Outreach/1.0 (+https://shipboost.com)`
- `Accept-Language: en-US,en;q=0.9`
- Respect `robots.txt` via `robots-parser`. If disallowed → skip.
- Timeout: 10s.
- 2–5s jitter between requests across the run.
- Max concurrency: 1 (sequential).

---

## 9. Review UI (`/inbox`)

Inbox-style. Left column: list of today's `PENDING_REVIEW` drafts (newest first). Right column: selected draft details.

Per draft:
- Product card (name, tagline, website, PH link, votes, topics)
- Discovered contact (email, name if any, where found)
- Draft (subject + body, HTML preview + raw text toggle)
- Buttons: **Edit**, **Send**, **Skip**, **Schedule follow-up** (checked by default)

Keyboard:
- `j` / `k` — next / previous draft
- `e` — focus subject for edit (Cmd+S to save)
- `s` — send
- `x` — skip
- `?` — keyboard help

**Edit:** PATCH `/api/drafts/[id]` with new subject/body. Plain-text alt regenerated from HTML on save.

---

## 10. Sending (Zoho Mail API)

### 10.1 OAuth

One-time setup:
1. Create Self Client in Zoho API Console.
2. Visit `/api/zoho/authorize` → redirect to Zoho consent → callback stores refresh token in `ZohoCredential` table (single row).
3. `lib/zoho/client.ts` refreshes access token on demand, caches in-memory per cold start.

Scopes: `ZohoMail.messages.ALL`, `ZohoMail.accounts.READ`.

### 10.2 Send

`POST /api/drafts/[id]/send`:
1. Load draft, validate status = `PENDING_REVIEW`.
2. Inject tracking pixel into HTML body just before `</body>`:
   `<img src="https://shipboost-outreach.vercel.app/api/pixel/{draftId}" width="1" height="1" alt="" style="display:block">`
3. Call Zoho `POST /accounts/{accountId}/messages` with `fromAddress`, `toAddress`, `subject`, `content` (HTML), `mailFormat: html`.
4. On 2xx: store returned `messageId` in `EmailMessage` (direction=OUT). Set draft `status = SENT`, `sentAt = now`.
5. On error: status = `FAILED`, log payload.

**Daily send cap:** count `OutreachDraft.status=SENT WHERE sentAt::date = today`. Reject send if >= 30. Surface in UI.

### 10.3 Reply detection

Covered in §6.2.

---

## 11. Open tracking pixel

`GET /api/pixel/[id]`:
1. Look up draft.
2. Insert `OutreachEvent(kind=OPEN, payload={ ua, ip, ts })`. Only insert if no prior OPEN event for this draft in last 60s (dedupe rapid prefetch by Gmail/Apple).
3. Return 1×1 transparent GIF with `Cache-Control: no-store, max-age=0`.

Known limitation: Apple Mail Privacy Protection pre-fetches images → opens get inflated/falsified for ~50% of recipients. We log but don't trust open count as a hard signal. We use it as a soft input only.

---

## 12. Deliverability infrastructure

One-time setup on `shipboost.com` DNS:
- **SPF** — `v=spf1 include:zoho.com ~all`
- **DKIM** — generate selector in Zoho admin, add TXT record
- **DMARC** — `v=DMARC1; p=quarantine; rua=mailto:dmarc@shipboost.com`

Sending from `tristan@shipboost.com` (real human address). Plain-text alt body included on every send. No links in body except domain in signature.

---

## 13. v2: GitHub Actions escape hatch (designed-in, deferred)

When we add directory sources that block Vercel IPs:

```
.github/workflows/scrape-directories.yml
  - runs hourly or daily
  - executes node scripts/scrape-{peerpush,uneed,...}.mjs
  - POSTs { source: "peerpush", launches: [...] } to
    https://shipboost-outreach.vercel.app/api/ingest/launches
    with header: x-ingest-secret: $INGEST_SECRET
```

Vercel endpoint `/api/ingest/launches`:
- Validates secret.
- Validates payload with Zod.
- Upserts into `Launch` table via the same flow as PH fetch (§6.1 step 3 onward).

Source adapters live in `lib/sources/`. PH fetches via API in-process; directory sources fetched via GHA. Same `LaunchSource` interface:

```ts
interface LaunchSource {
  kind: SourceKind;
  fetch(since: Date): Promise<RawLaunch[]>;  // PH: API call. Directory: parse pre-fetched HTML.
  normalize(raw: RawLaunch): NormalizedLaunch;
}
```

For PH, `fetch` runs in-process. For directory sources, `fetch` is implemented in a GHA script that posts raw HTML to ingest, and `normalize` runs on the Vercel side. v2 only — not built in MVP.

---

## 14. Testing

Vitest unit tests for:
- `extract-email.ts` — fixtures of common indie-SaaS HTML (mailto in footer, /contact page with form, /about page with team).
- `select.ts` — deterministic template selection per domain; even distribution across templates.
- `render.ts` — variable substitution; `{{first_name}}` fallback to `_noname` variant; HTML-to-plaintext conversion.
- Voice-profile compliance: each template asserted not to contain banned phrases ("leverage", "seamlessly", "robust", "elevate", "empower", "game-changing", "revolutionary", "Here's what most founders get wrong", "Let's dive in", staccato fragment stacks, etc.). Catches drift if templates are edited.
- Zoho client OAuth refresh flow (mocked).
- Dedup: re-running fetch with same PH posts → no duplicate Contacts/Drafts.
- Pixel route returns valid 1×1 GIF.

Integration test (optional): full pipeline against PH staging credentials → mocked Zoho → assert draft created in test DB.

---

## 15. Environment variables

```
DATABASE_URL=
CRON_SECRET=
OUTREACH_PASSWORD=
SENDER_FIRST_NAME=Tim
PRODUCT_HUNT_TOKEN=
ZOHO_CLIENT_ID=
ZOHO_CLIENT_SECRET=
ZOHO_REDIRECT_URI=https://shipboost-outreach.vercel.app/api/zoho/callback
ZOHO_ACCOUNT_ID=
INGEST_SECRET=                     # v2 only
NEXT_PUBLIC_APP_URL=https://shipboost-outreach.vercel.app
```

---

## 16. Out of scope for MVP

- Sources other than Product Hunt (designed-in via §13).
- A/B testing of templates beyond manual review of `templateKey` open rates.
- Reply auto-classification (positive/negative/unsubscribe) — manual triage in Zoho inbox is fine.
- Multi-user / team features.
- Webhook-based reply detection (we poll Zoho every 24h with follow-up cron).
- Paid enrichment providers (Hunter, Apollo, Snov.io).

---

## 17. Success criteria

MVP is successful when:
- Daily cron reliably produces 5–20 drafts/day from PH launches.
- ≥40% of fetched launches yield a usable email via free scraping.
- Drafts read on-voice and don't need rewriting more than half the time.
- One-click send works without manual Zoho intervention.
- Follow-ups auto-generate 5 days post-send for non-responders.
- Zero duplicate emails to the same domain across all-time history.
