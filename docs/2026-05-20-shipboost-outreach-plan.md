# ShipBoost Outreach Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a daily cold-outreach tool that fetches Product Hunt launches, scrapes founder emails, drafts personalized emails via rotating templates, and lets the operator review + send via Zoho Mail with auto follow-ups.

**Architecture:** Single Next.js 16 + React 19 app deployed to Vercel. Postgres on Neon for persistence. Vercel Cron triggers the daily fetch + follow-up pipelines. Zoho Mail REST API handles sending and reply polling. Drafts are produced from 10–15 pre-written templates with variable substitution — no LLM. GitHub Actions escape hatch designed-in for v2 directory scraping but not built in MVP.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind v4, shadcn/ui, Prisma, Postgres (Neon), Zod, undici, cheerio, robots-parser, Vitest. Node 20.x.

**Spec:** [`./2026-05-20-shipboost-outreach-design.md`](./2026-05-20-shipboost-outreach-design.md)

**Working directory for all tasks:** `/Users/tsth/Coding/shipboost/outreach`

---

## File Structure

```
outreach/
├── docs/
│   ├── 2026-05-20-shipboost-outreach-design.md
│   └── 2026-05-20-shipboost-outreach-plan.md
├── prisma/
│   └── schema.prisma                              # Task 2
├── src/
│   ├── app/
│   │   ├── layout.tsx                             # Task 1
│   │   ├── page.tsx                               # Task 1
│   │   ├── inbox/page.tsx                         # Task 10
│   │   ├── inbox/InboxClient.tsx                  # Task 10
│   │   ├── login/page.tsx                         # Task 3
│   │   └── api/
│   │       ├── cron/fetch-launches/route.ts       # Task 9
│   │       ├── cron/follow-ups/route.ts           # Task 14
│   │       ├── drafts/[id]/route.ts               # Task 10
│   │       ├── drafts/[id]/send/route.ts          # Task 12
│   │       ├── drafts/[id]/skip/route.ts          # Task 10
│   │       ├── pixel/[id]/route.ts                # Task 13
│   │       ├── ingest/launches/route.ts           # Task 15
│   │       ├── login/route.ts                     # Task 3
│   │       └── zoho/
│   │           ├── authorize/route.ts             # Task 11
│   │           └── callback/route.ts              # Task 11
│   ├── lib/
│   │   ├── sources/{types.ts,product-hunt.ts}     # Task 6
│   │   ├── scrape/{fetch-html.ts,extract-email.ts} # Tasks 4, 5
│   │   ├── draft/{templates,follow-up-templates,select,render}.ts # Task 7
│   │   ├── zoho/{client,send,replies}.ts          # Tasks 11, 12, 14
│   │   ├── pipeline/{fetch-and-queue,process-follow-ups}.ts # Tasks 8, 14
│   │   └── auth.ts                                # Task 3
│   ├── server/db/client.ts                        # Task 2
│   └── middleware.ts                              # Task 3
├── tests/                                         # colocated per task
├── scripts/run-with-env.mjs                       # Task 1
├── .env.local.example                             # Task 1
├── vercel.json                                    # Task 15
├── vitest.config.ts, tsconfig.json, next.config.ts,
│   postcss.config.mjs, eslint.config.mjs,
│   package.json, .gitignore                       # Task 1
```

---

## Task 1: Project scaffold

**Files:** all root configs + base Next app.

- [ ] **Step 1: Initialize**

```bash
cd /Users/tsth/Coding/shipboost/outreach
git init
npm init -y
```

- [ ] **Step 2: Write `package.json`**

Replace `package.json` with:

```json
{
  "name": "shipboost-outreach",
  "version": "0.1.0",
  "private": true,
  "engines": { "node": "20.x" },
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "test": "vitest run",
    "test:watch": "vitest",
    "prisma:generate": "prisma generate",
    "prisma:studio": "node scripts/run-with-env.mjs prisma studio",
    "db:migrate": "node scripts/run-with-env.mjs prisma migrate dev",
    "db:deploy": "prisma migrate deploy"
  },
  "dependencies": {
    "next": "^16.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "@prisma/client": "^6.0.0",
    "zod": "^3.23.0",
    "undici": "^7.0.0",
    "cheerio": "^1.0.0",
    "robots-parser": "^3.0.1",
    "html-to-text": "^9.0.5",
    "isomorphic-dompurify": "^2.16.0",
    "jose": "^5.9.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@types/html-to-text": "^9.0.4",
    "typescript": "^5.6.0",
    "prisma": "^6.0.0",
    "vitest": "^2.1.0",
    "@vitest/coverage-v8": "^2.1.0",
    "eslint": "^9.0.0",
    "eslint-config-next": "^16.0.0",
    "tailwindcss": "^4.0.0",
    "@tailwindcss/postcss": "^4.0.0",
    "postcss": "^8.4.0"
  }
}
```

- [ ] **Step 3: Write base configs**

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

Create `next.config.ts`:

```ts
import type { NextConfig } from "next";
const config: NextConfig = { reactStrictMode: true };
export default config;
```

Create `postcss.config.mjs`:

```js
export default { plugins: { "@tailwindcss/postcss": {} } };
```

Create `eslint.config.mjs`:

```js
import next from "eslint-config-next";
export default [...next()];
```

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";
export default defineConfig({
  test: { environment: "node", include: ["tests/**/*.test.ts"] },
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
});
```

Create `.gitignore`:

```
node_modules
.next
.env.local
.env*.local
*.tsbuildinfo
coverage
.DS_Store
```

Create `.env.local.example`:

```
DATABASE_URL=postgresql://user:pass@localhost:5432/outreach
CRON_SECRET=replace-me
OUTREACH_PASSWORD=replace-me
SESSION_SECRET=at-least-32-chars-of-random
SENDER_FIRST_NAME=Tim
SENDER_EMAIL=tim@shipboost.com
PRODUCT_HUNT_TOKEN=
ZOHO_CLIENT_ID=
ZOHO_CLIENT_SECRET=
ZOHO_REDIRECT_URI=http://localhost:3000/api/zoho/callback
ZOHO_ACCOUNT_ID=
INGEST_SECRET=
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

- [ ] **Step 4: Write `scripts/run-with-env.mjs`**

Create `scripts/run-with-env.mjs`:

```js
#!/usr/bin/env node
import { spawn } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const envPath = resolve(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  const text = readFileSync(envPath, "utf8");
  for (const line of text.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!(m[1] in process.env)) process.env[m[1]] = v;
  }
}

const [cmd, ...args] = process.argv.slice(2);
if (!cmd) { console.error("usage: run-with-env.mjs <cmd> [args...]"); process.exit(2); }
const child = spawn(cmd, args, { stdio: "inherit", env: process.env });
child.on("exit", (code) => process.exit(code ?? 0));
```

- [ ] **Step 5: Write base Next app files**

Create `src/app/layout.tsx`:

```tsx
import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "ShipBoost Outreach" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-zinc-950 text-zinc-100 min-h-screen">{children}</body>
    </html>
  );
}
```

Create `src/app/globals.css`:

```css
@import "tailwindcss";
```

Create `src/app/page.tsx`:

```tsx
import { redirect } from "next/navigation";
export default function Home() { redirect("/inbox"); }
```

- [ ] **Step 6: Install + verify build**

```bash
npm install
npx next telemetry disable
npm run build
```
Expected: build succeeds.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js 16 + Prisma project"
```

---

## Task 2: Prisma schema + DB client

**Files:** `prisma/schema.prisma`, `src/server/db/client.ts`

- [ ] **Step 1: Write schema**

Create `prisma/schema.prisma`:

```prisma
generator client { provider = "prisma-client-js" }

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum SourceKind { PRODUCT_HUNT PEERPUSH PEERLIST UNEED FOUNDRLIST SCROLLLAUNCH }
enum DraftStatus { PENDING_REVIEW SENT SKIPPED FAILED }
enum EventKind { OPEN REPLY FOLLOWUP_SENT }
enum Direction { OUT IN }
enum DiscoveredFrom { CONTACT_PAGE ABOUT_PAGE HOMEPAGE_FOOTER MAILTO_LINK META_TAG }

model Source {
  id       String     @id @default(cuid())
  kind     SourceKind @unique
  name     String
  enabled  Boolean    @default(true)
  launches Launch[]
}

model Launch {
  id         String   @id @default(cuid())
  source     Source   @relation(fields: [sourceId], references: [id])
  sourceId   String
  externalId String
  name       String
  tagline    String?
  url        String
  launchedAt DateTime
  raw        Json
  fetchedAt  DateTime @default(now())
  contact    Contact?
  @@unique([sourceId, externalId])
}

model Contact {
  id             String         @id @default(cuid())
  email          String         @unique
  domain         String         @unique
  name           String?
  launch         Launch         @relation(fields: [launchId], references: [id])
  launchId       String         @unique
  discoveredFrom DiscoveredFrom
  drafts         OutreachDraft[]
  createdAt      DateTime       @default(now())
}

model OutreachDraft {
  id            String          @id @default(cuid())
  contact       Contact         @relation(fields: [contactId], references: [id])
  contactId     String
  parentDraft   OutreachDraft?  @relation("FollowUp", fields: [parentDraftId], references: [id])
  parentDraftId String?
  followUps     OutreachDraft[] @relation("FollowUp")
  templateKey   String
  subject       String
  body          String
  bodyText      String
  status        DraftStatus     @default(PENDING_REVIEW)
  createdAt     DateTime        @default(now())
  sentAt        DateTime?
  events        OutreachEvent[]
  messages      EmailMessage[]
}

model OutreachEvent {
  id        String        @id @default(cuid())
  draft     OutreachDraft @relation(fields: [draftId], references: [id])
  draftId   String
  kind      EventKind
  payload   Json
  createdAt DateTime      @default(now())
}

model EmailMessage {
  id            String        @id @default(cuid())
  draft         OutreachDraft @relation(fields: [draftId], references: [id])
  draftId       String
  zohoMessageId String        @unique
  direction     Direction
  subject       String
  snippet       String
  headers       Json
  receivedAt    DateTime      @default(now())
}

model ZohoCredential {
  id           String   @id @default(cuid())
  accountId    String
  refreshToken String
  scope        String
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}
```

- [ ] **Step 2: Write Prisma client singleton**

Create `src/server/db/client.ts`:

```ts
import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma = global.__prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") global.__prisma = prisma;
```

- [ ] **Step 3: Generate client**

Run: `npm run prisma:generate`
Expected: `✔ Generated Prisma Client`.

- [ ] **Step 4: Create initial migration**

Provision a Postgres DB (Neon free tier recommended). Put the URL in `.env.local`.

Run: `npm run db:migrate -- --name init`
Expected: migration created, schema applied.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(db): prisma schema + client singleton"
```

---

## Task 3: Single-user auth

**Files:** `src/lib/auth.ts`, `src/middleware.ts`, `src/app/login/page.tsx`, `src/app/api/login/route.ts`

- [ ] **Step 1: Write auth helpers**

Create `src/lib/auth.ts`:

```ts
import { SignJWT, jwtVerify } from "jose";

const COOKIE_NAME = "outreach_session";
const SESSION_TTL = 60 * 60 * 24 * 30;

function secret(): Uint8Array {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET missing or <32 chars");
  return new TextEncoder().encode(s);
}

export async function createSessionCookie(): Promise<{ name: string; value: string; maxAge: number }> {
  const token = await new SignJWT({ sub: "outreach-user" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL}s`)
    .sign(secret());
  return { name: COOKIE_NAME, value: token, maxAge: SESSION_TTL };
}

export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  try { await jwtVerify(token, secret()); return true; } catch { return false; }
}

export const SESSION_COOKIE = COOKIE_NAME;
```

- [ ] **Step 2: Write middleware**

Create `src/middleware.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/auth";

const PUBLIC = [
  /^\/login$/,
  /^\/api\/login$/,
  /^\/api\/cron\//,
  /^\/api\/pixel\//,
  /^\/api\/ingest\//,
  /^\/api\/zoho\/callback$/,
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((re) => re.test(pathname))) return NextResponse.next();
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (await verifySessionToken(token)) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  return NextResponse.redirect(url);
}

export const config = { matcher: ["/((?!_next|favicon.ico).*)"] };
```

- [ ] **Step 3: Write login page + handler**

Create `src/app/login/page.tsx`:

```tsx
export default function LoginPage({ searchParams }: { searchParams: { error?: string } }) {
  return (
    <main className="min-h-screen flex items-center justify-center">
      <form action="/api/login" method="post" className="w-80 space-y-4">
        <h1 className="text-xl">ShipBoost Outreach</h1>
        <input
          name="password"
          type="password"
          required
          autoFocus
          placeholder="Password"
          className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded"
        />
        {searchParams.error && <p className="text-red-400 text-sm">Wrong password.</p>}
        <button className="w-full py-2 bg-zinc-100 text-zinc-900 rounded">Sign in</button>
      </form>
    </main>
  );
}
```

Create `src/app/api/login/route.ts`:

```ts
import { NextResponse } from "next/server";
import { createSessionCookie } from "@/lib/auth";

export async function POST(req: Request) {
  const form = await req.formData();
  const password = form.get("password");
  if (typeof password !== "string" || password !== process.env.OUTREACH_PASSWORD) {
    return NextResponse.redirect(new URL("/login?error=1", req.url));
  }
  const cookie = await createSessionCookie();
  const res = NextResponse.redirect(new URL("/inbox", req.url));
  res.cookies.set(cookie.name, cookie.value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: cookie.maxAge,
  });
  return res;
}
```

- [ ] **Step 4: Manual verification**

`npm run dev`. Visit `/` → redirected to `/login`. Submit wrong password → error. Submit correct → goes to `/inbox` (404 until Task 10, expected).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(auth): single-user password + signed session cookie"
```

---

## Task 4: Polite HTML fetcher

**Files:** `src/lib/scrape/fetch-html.ts`, `tests/scrape/fetch-html.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/scrape/fetch-html.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { canonicalizeUrl } from "@/lib/scrape/fetch-html";

describe("canonicalizeUrl", () => {
  it("strips trailing slash and lowercases host", () => {
    expect(canonicalizeUrl("HTTPS://Example.COM/path/")).toBe("https://example.com/path");
  });
  it("preserves root slash", () => {
    expect(canonicalizeUrl("https://example.com/")).toBe("https://example.com/");
  });
  it("removes utm params", () => {
    expect(canonicalizeUrl("https://example.com/?utm_source=x&keep=1")).toBe("https://example.com/?keep=1");
  });
});
```

- [ ] **Step 2: Run test (fail)**

Run: `npx vitest run tests/scrape/fetch-html.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/lib/scrape/fetch-html.ts`:

```ts
import { request } from "undici";
import robotsParser from "robots-parser";

const UA = "ShipBoost-Outreach/1.0 (+https://shipboost.com)";
const TIMEOUT_MS = 10_000;

export function canonicalizeUrl(input: string): string {
  const u = new URL(input);
  u.hostname = u.hostname.toLowerCase();
  for (const k of [...u.searchParams.keys()]) {
    if (k.startsWith("utm_")) u.searchParams.delete(k);
  }
  let s = u.toString();
  if (u.pathname !== "/" && s.endsWith("/")) s = s.slice(0, -1);
  return s;
}

export async function fetchHtml(url: string): Promise<string | null> {
  if (!(await checkRobots(url))) return null;
  try {
    const { statusCode, body, headers } = await request(url, {
      method: "GET",
      headers: { "user-agent": UA, "accept-language": "en-US,en;q=0.9", accept: "text/html,*/*" },
      headersTimeout: TIMEOUT_MS,
      bodyTimeout: TIMEOUT_MS,
      maxRedirections: 5,
    });
    if (statusCode < 200 || statusCode >= 300) return null;
    const ct = String(headers["content-type"] || "");
    if (!ct.includes("text/html")) return null;
    return await body.text();
  } catch {
    return null;
  }
}

async function checkRobots(url: string): Promise<boolean> {
  try {
    const u = new URL(url);
    const robotsUrl = `${u.protocol}//${u.host}/robots.txt`;
    const { statusCode, body } = await request(robotsUrl, {
      method: "GET", headers: { "user-agent": UA },
      headersTimeout: 5_000, bodyTimeout: 5_000,
    });
    if (statusCode !== 200) return true;
    const txt = await body.text();
    return robotsParser(robotsUrl, txt).isAllowed(url, UA) ?? true;
  } catch {
    return true;
  }
}

export async function jitter(minMs = 2000, maxMs = 5000): Promise<void> {
  const ms = Math.floor(minMs + Math.random() * (maxMs - minMs));
  await new Promise((r) => setTimeout(r, ms));
}
```

- [ ] **Step 4: Run test (pass)**

Run: `npx vitest run tests/scrape/fetch-html.test.ts`
Expected: 3 pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(scrape): polite HTML fetcher with robots.txt + canonicalization"
```

---

## Task 5: Email extractor

**Files:** `src/lib/scrape/extract-email.ts`, `tests/scrape/extract-email.test.ts`, fixtures.

- [ ] **Step 1: Write fixtures**

Create `tests/scrape/fixtures/footer.html`:

```html
<html><body><main>Hello</main>
<footer>Questions? Email us at sarah@trywavefly.com — usually reply in a day.</footer></body></html>
```

Create `tests/scrape/fixtures/mailto.html`:

```html
<html><body><a href="mailto:founder@acme.io">Contact</a></body></html>
```

Create `tests/scrape/fixtures/contact-page.html`:

```html
<html><body><h1>Contact</h1><p>Reach the team: hi@acme.io</p></body></html>
```

Create `tests/scrape/fixtures/about-page.html`:

```html
<html><body><h1>About</h1>
<p>Hey — I'm Marc Reyes, founder of Acme. Reach me at marc@acme.io.</p></body></html>
```

Create `tests/scrape/fixtures/role-only.html`:

```html
<html><body><footer>For support: support@acme.io</footer></body></html>
```

- [ ] **Step 2: Write failing tests**

Create `tests/scrape/extract-email.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const fx = (n: string) => readFileSync(join(__dirname, "fixtures", `${n}.html`), "utf8");

vi.mock("@/lib/scrape/fetch-html", () => ({
  fetchHtml: vi.fn(),
  canonicalizeUrl: (u: string) => u,
  jitter: async () => {},
}));

import { fetchHtml } from "@/lib/scrape/fetch-html";
import { extractEmail } from "@/lib/scrape/extract-email";

beforeEach(() => { vi.mocked(fetchHtml).mockReset(); });

describe("extractEmail", () => {
  it("finds email in footer text on homepage", async () => {
    vi.mocked(fetchHtml).mockResolvedValueOnce(fx("footer"));
    const r = await extractEmail("https://trywavefly.com");
    expect(r).toEqual({ email: "sarah@trywavefly.com", name: undefined, source: "HOMEPAGE_FOOTER" });
  });

  it("finds mailto link on homepage", async () => {
    vi.mocked(fetchHtml).mockResolvedValueOnce(fx("mailto"));
    const r = await extractEmail("https://acme.io");
    expect(r?.email).toBe("founder@acme.io");
    expect(r?.source).toBe("MAILTO_LINK");
  });

  it("falls back to /contact when homepage has none", async () => {
    vi.mocked(fetchHtml)
      .mockResolvedValueOnce("<html><body>nothing</body></html>")
      .mockResolvedValueOnce(fx("contact-page"));
    const r = await extractEmail("https://acme.io");
    expect(r?.email).toBe("hi@acme.io");
    expect(r?.source).toBe("CONTACT_PAGE");
  });

  it("falls back to /about and extracts founder name", async () => {
    vi.mocked(fetchHtml)
      .mockResolvedValueOnce("<html><body>nothing</body></html>")
      .mockResolvedValueOnce("<html><body>still nothing</body></html>")
      .mockResolvedValueOnce(fx("about-page"));
    const r = await extractEmail("https://acme.io");
    expect(r?.email).toBe("marc@acme.io");
    expect(r?.name).toBe("Marc");
    expect(r?.source).toBe("ABOUT_PAGE");
  });

  it("rejects emails on mismatched domain", async () => {
    vi.mocked(fetchHtml).mockResolvedValueOnce(
      "<html><body><a href='mailto:somebody@otherdomain.com'>x</a></body></html>",
    );
    const r = await extractEmail("https://acme.io");
    expect(r).toBeNull();
  });

  it("accepts role-account email when domain matches", async () => {
    vi.mocked(fetchHtml).mockResolvedValueOnce(fx("role-only"));
    const r = await extractEmail("https://acme.io");
    expect(r?.email).toBe("support@acme.io");
  });

  it("returns null when nothing found", async () => {
    vi.mocked(fetchHtml).mockResolvedValue("<html><body>empty</body></html>");
    const r = await extractEmail("https://acme.io");
    expect(r).toBeNull();
  });
});
```

- [ ] **Step 3: Run tests (fail)**

Run: `npx vitest run tests/scrape/extract-email.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement**

Create `src/lib/scrape/extract-email.ts`:

```ts
import { load } from "cheerio";
import { fetchHtml } from "./fetch-html";

const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PERSONAL_DOMAINS = new Set([
  "gmail.com", "hey.com", "fastmail.com", "proton.me", "protonmail.com", "icloud.com", "me.com",
]);
const ROLE_LOCALS = new Set(["noreply", "no-reply", "donotreply"]);

export type DiscoveredFrom = "CONTACT_PAGE" | "ABOUT_PAGE" | "HOMEPAGE_FOOTER" | "MAILTO_LINK" | "META_TAG";
export type EmailHit = { email: string; name?: string; source: DiscoveredFrom };

export async function extractEmail(siteUrl: string): Promise<EmailHit | null> {
  const site = new URL(siteUrl);
  const siteDomain = site.hostname.replace(/^www\./, "").toLowerCase();

  const homepage = await fetchHtml(siteUrl);
  if (homepage) {
    const hit = scanHtml(homepage, siteDomain, "HOMEPAGE_FOOTER");
    if (hit) return hit;
  }
  for (const path of ["/contact", "/contact-us", "/about"]) {
    const url = new URL(path, site).toString();
    const html = await fetchHtml(url);
    if (!html) continue;
    const source: DiscoveredFrom = path === "/about" ? "ABOUT_PAGE" : "CONTACT_PAGE";
    const hit = scanHtml(html, siteDomain, source);
    if (hit) return hit;
  }
  return null;
}

function scanHtml(html: string, siteDomain: string, defaultSource: DiscoveredFrom): EmailHit | null {
  const $ = load(html);

  const mailtos = $("a[href^='mailto:']")
    .map((_, el) => String($(el).attr("href") || "").replace(/^mailto:/i, "").split("?")[0].trim())
    .get()
    .filter(Boolean);
  for (const m of mailtos) {
    if (isAcceptable(m, siteDomain)) return { email: m.toLowerCase(), source: "MAILTO_LINK" };
  }

  const meta = $("meta[property='og:email'], meta[name='email']").attr("content");
  if (meta && isAcceptable(meta, siteDomain)) return { email: meta.toLowerCase(), source: "META_TAG" };

  const text = $("body").text();
  const candidates = text.match(EMAIL_RE) ?? [];
  for (const raw of candidates) {
    if (!isAcceptable(raw, siteDomain)) continue;
    return { email: raw.toLowerCase(), name: guessNameNear(text, raw), source: defaultSource };
  }
  return null;
}

function isAcceptable(email: string, siteDomain: string): boolean {
  if (!/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(email)) return false;
  const [local, domain] = email.toLowerCase().split("@");
  if (!local || !domain) return false;
  if (ROLE_LOCALS.has(local)) return false;
  if (domain === siteDomain || domain.endsWith(`.${siteDomain}`) || siteDomain.endsWith(`.${domain}`)) return true;
  if (PERSONAL_DOMAINS.has(domain)) return /^[a-z]+(\.[a-z]+)?$/.test(local) && local.length >= 3;
  return false;
}

function guessNameNear(text: string, email: string): string | undefined {
  const idx = text.indexOf(email);
  if (idx < 0) return undefined;
  const window = text.slice(Math.max(0, idx - 200), idx);
  return window.match(/I['’]m ([A-Z][a-z]+)/)?.[1];
}
```

- [ ] **Step 5: Run tests (pass)**

Run: `npx vitest run tests/scrape/extract-email.test.ts`
Expected: 7 pass.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(scrape): email extractor with domain validation + name guess"
```

---

## Task 6: Product Hunt source adapter

**Files:** `src/lib/sources/types.ts`, `src/lib/sources/product-hunt.ts`, `tests/sources/product-hunt.test.ts`

- [ ] **Step 1: Types**

Create `src/lib/sources/types.ts`:

```ts
export type RawLaunch = {
  externalId: string;
  name: string;
  tagline?: string;
  url: string;
  launchedAt: Date;
  votesCount?: number;
  topics?: string[];
  raw: unknown;
};

export interface LaunchSource {
  kind: "PRODUCT_HUNT" | "PEERPUSH" | "PEERLIST" | "UNEED" | "FOUNDRLIST" | "SCROLLLAUNCH";
  fetchSince(date: Date): Promise<RawLaunch[]>;
}
```

- [ ] **Step 2: Failing test**

Create `tests/sources/product-hunt.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const fixture = {
  data: {
    posts: {
      edges: [
        {
          node: {
            id: "post_1", name: "Wavefly", tagline: "Quiet launches for serious SaaS",
            url: "https://www.producthunt.com/posts/wavefly",
            website: "https://trywavefly.com?ref=producthunt",
            votesCount: 42, createdAt: "2026-05-19T16:01:00Z",
            topics: { edges: [{ node: { slug: "saas" } }, { node: { slug: "developer-tools" } }] },
          },
        },
        {
          node: {
            id: "post_2", name: "ExtensionThing", tagline: "Chrome extension",
            url: "https://www.producthunt.com/posts/extensionthing",
            website: "https://chrome.google.com/webstore/x",
            votesCount: 3, createdAt: "2026-05-19T16:00:00Z",
            topics: { edges: [{ node: { slug: "chrome-extensions" } }] },
          },
        },
      ],
    },
  },
};

vi.mock("undici", () => ({
  request: vi.fn().mockResolvedValue({
    statusCode: 200, body: { json: async () => fixture },
  }),
}));

import { ProductHuntSource } from "@/lib/sources/product-hunt";

beforeEach(() => { process.env.PRODUCT_HUNT_TOKEN = "test"; });

describe("ProductHuntSource", () => {
  it("filters extensions/low-votes and normalizes URLs", async () => {
    const src = new ProductHuntSource();
    const out = await src.fetchSince(new Date("2026-05-18T00:00:00Z"));
    expect(out).toHaveLength(1);
    expect(out[0].externalId).toBe("post_1");
    expect(out[0].name).toBe("Wavefly");
    expect(out[0].url).toBe("https://trywavefly.com/");
    expect(out[0].votesCount).toBe(42);
    expect(out[0].topics).toContain("saas");
  });
});
```

- [ ] **Step 3: Run test (fail)**

Run: `npx vitest run tests/sources/product-hunt.test.ts`
Expected: FAIL.

- [ ] **Step 4: Implement**

Create `src/lib/sources/product-hunt.ts`:

```ts
import { request } from "undici";
import { canonicalizeUrl } from "@/lib/scrape/fetch-html";
import type { LaunchSource, RawLaunch } from "./types";

const PH_ENDPOINT = "https://api.producthunt.com/v2/api/graphql";
const DENY_TOPICS = new Set([
  "chrome-extensions", "firefox-extensions", "browser-extensions",
  "ios", "android", "physical-products", "books", "podcasts",
  "notion-templates", "figma-plugins",
]);
const MIN_VOTES = 5;

const QUERY = `
  query Posts($postedAfter: DateTime!) {
    posts(postedAfter: $postedAfter, order: NEWEST, first: 50) {
      edges { node {
        id name tagline url website votesCount createdAt
        topics(first: 10) { edges { node { slug } } }
      } }
    }
  }
`;

type PhEdge = {
  node: {
    id: string; name: string; tagline?: string; url: string; website?: string;
    votesCount: number; createdAt: string;
    topics: { edges: { node: { slug: string } }[] };
  };
};

export class ProductHuntSource implements LaunchSource {
  kind = "PRODUCT_HUNT" as const;

  async fetchSince(date: Date): Promise<RawLaunch[]> {
    const token = process.env.PRODUCT_HUNT_TOKEN;
    if (!token) throw new Error("PRODUCT_HUNT_TOKEN missing");

    const { statusCode, body } = await request(PH_ENDPOINT, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ query: QUERY, variables: { postedAfter: date.toISOString() } }),
    });
    if (statusCode !== 200) throw new Error(`PH API ${statusCode}`);
    const payload = (await body.json()) as { data?: { posts?: { edges?: PhEdge[] } } };
    const edges = payload.data?.posts?.edges ?? [];

    const out: RawLaunch[] = [];
    for (const { node } of edges) {
      if (!node.website) continue;
      if (node.votesCount < MIN_VOTES) continue;
      const topics = node.topics.edges.map((t) => t.node.slug);
      if (topics.some((t) => DENY_TOPICS.has(t))) continue;

      let website: string;
      try { website = canonicalizeUrl(node.website); } catch { continue; }
      const host = new URL(website).hostname;
      if (host.endsWith("chrome.google.com") || host.endsWith("apps.apple.com") || host.endsWith("play.google.com")) continue;

      out.push({
        externalId: node.id, name: node.name, tagline: node.tagline, url: website,
        launchedAt: new Date(node.createdAt), votesCount: node.votesCount, topics, raw: node,
      });
    }
    return out;
  }
}
```

- [ ] **Step 5: Run test (pass)**

Run: `npx vitest run tests/sources/product-hunt.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(sources): Product Hunt adapter with topic/votes filtering"
```

---

## Task 7: Templates + render + select

**Files:** `src/lib/draft/{templates,follow-up-templates,select,render}.ts`, `tests/draft/{select,render,voice-compliance}.test.ts`

- [ ] **Step 1: Failing test for select**

Create `tests/draft/select.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { selectTemplate } from "@/lib/draft/select";

const templates = [
  { key: "a", subject: "", bodyHtml: "" },
  { key: "b", subject: "", bodyHtml: "" },
  { key: "c", subject: "", bodyHtml: "" },
];

describe("selectTemplate", () => {
  it("is deterministic for same domain", () => {
    expect(selectTemplate("acme.io", templates).key).toBe(selectTemplate("acme.io", templates).key);
  });
  it("distributes across templates", () => {
    const counts: Record<string, number> = { a: 0, b: 0, c: 0 };
    for (let i = 0; i < 900; i++) counts[selectTemplate(`d${i}.com`, templates).key]++;
    for (const k of Object.keys(counts)) expect(counts[k]).toBeGreaterThan(200);
  });
});
```

- [ ] **Step 2: Implement select**

Create `src/lib/draft/select.ts`:

```ts
export type Template = { key: string; subject: string; bodyHtml: string };

export function selectTemplate<T extends { key: string }>(domain: string, templates: T[]): T {
  if (templates.length === 0) throw new Error("no templates");
  let h = 2166136261;
  for (let i = 0; i < domain.length; i++) {
    h ^= domain.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return templates[(h >>> 0) % templates.length];
}
```

- [ ] **Step 3: Run select tests (pass)**

Run: `npx vitest run tests/draft/select.test.ts`
Expected: PASS.

- [ ] **Step 4: Failing test for render**

Create `tests/draft/render.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { renderTemplate } from "@/lib/draft/render";

const tmpl = {
  key: "t",
  subject: "{{product_name}} — quick note",
  bodyHtml: "<p>Hey {{first_name}},</p><p>About {{website_domain}} — {{tagline}}.</p><p>— {{sender_first_name}}</p>",
};

describe("renderTemplate", () => {
  it("substitutes variables and derives plain text", () => {
    const r = renderTemplate(tmpl, {
      first_name: "Sarah", product_name: "Wavefly", tagline: "quiet launches",
      website_domain: "trywavefly.com", sender_first_name: "Tim",
    });
    expect(r.subject).toBe("Wavefly — quick note");
    expect(r.bodyHtml).toContain("Hey Sarah,");
    expect(r.bodyText).toContain("Hey Sarah,");
    expect(r.bodyText).toContain("— Tim");
    expect(r.bodyText).not.toContain("<p>");
  });
  it("throws if a referenced variable is missing", () => {
    expect(() => renderTemplate(tmpl, {
      product_name: "Wavefly", tagline: "t", website_domain: "x.com", sender_first_name: "Tim",
    } as never)).toThrow(/first_name/);
  });
});
```

- [ ] **Step 5: Implement render**

Create `src/lib/draft/render.ts`:

```ts
import { convert } from "html-to-text";
import type { Template } from "./select";

export type RenderVars = {
  first_name?: string;
  product_name: string;
  tagline: string;
  website_domain: string;
  sender_first_name: string;
};

export type Rendered = { subject: string; bodyHtml: string; bodyText: string };

export function renderTemplate(t: Template, vars: RenderVars): Rendered {
  const subject = substitute(t.subject, vars);
  const bodyHtml = substitute(t.bodyHtml, vars);
  const bodyText = convert(bodyHtml, {
    wordwrap: 80,
    selectors: [{ selector: "a", options: { ignoreHref: true } }],
  });
  return { subject, bodyHtml, bodyText };
}

function substitute(s: string, vars: RenderVars): string {
  return s.replace(/\{\{([a-z_]+)\}\}/g, (_, key: string) => {
    const v = (vars as Record<string, string | undefined>)[key];
    if (v === undefined || v === "") throw new Error(`missing template variable: ${key}`);
    return v;
  });
}
```

- [ ] **Step 6: Run render tests (pass)**

Run: `npx vitest run tests/draft/render.test.ts`
Expected: PASS.

- [ ] **Step 7: Write 12 outreach templates**

Create `src/lib/draft/templates.ts`:

```ts
import type { Template } from "./select";

const SIG = `<p>— {{sender_first_name}}<br/><a href="https://shipboost.com">shipboost.com</a></p>`;

export const templates: Template[] = [
  {
    key: "ph-01-spike-diagnosis-named",
    subject: "{{product_name}} — past launch day",
    bodyHtml: `<p>Hey {{first_name}},</p>
<p>Saw {{product_name}} on Product Hunt. {{tagline}} — the kind of positioning that usually earns a launch-day spike and then nothing.</p>
<p>Most launch sites give you the spike. Most directories give you a dead listing. ShipBoost is built to handle both — distribution today, discoverability after the launch week rotates.</p>
<p>If that's a problem worth solving for {{website_domain}}, happy to send the breakdown.</p>
${SIG}`,
  },
  {
    key: "ph-02-direct-question-noname",
    subject: "quick question about {{product_name}}",
    bodyHtml: `<p>Hey,</p>
<p>Caught {{product_name}} on PH today. One question: what's the plan for week two?</p>
<p>Launch-day traffic is a one-time event. Buyers searching for what you do next month won't see the launch — they'll see whatever ranks. ShipBoost gives the listing a second job: stay discoverable after the launch window closes.</p>
<p>Worth a look?</p>
${SIG}`,
  },
  {
    key: "ph-03-anti-definition-named",
    subject: "{{product_name}}",
    bodyHtml: `<p>Hey {{first_name}},</p>
<p>Congrats on the {{product_name}} launch.</p>
<p>ShipBoost isn't a Product Hunt clone. Not a generic AI tools list. Not a startup cemetery. It's a founder-ready listing that keeps earning trust through categories, tags, and alternatives pages after launch week ends.</p>
<p>If {{website_domain}} should still be findable in a month, that's what we do.</p>
${SIG}`,
  },
  {
    key: "ph-04-mechanic-first-noname",
    subject: "about {{product_name}}",
    bodyHtml: `<p>Hey,</p>
<p>A launch becomes a public asset: something buyers can discover, compare, and come back to after the launch week rotates. Most directories don't do that work. ShipBoost does.</p>
<p>{{product_name}} just launched. {{tagline}}. The listing should keep earning trust through categories, tags, and alternatives pages when the right buyer is searching later.</p>
<p>If that's useful for {{website_domain}}, I can send a draft listing.</p>
${SIG}`,
  },
  {
    key: "ph-05-week-two-named",
    subject: "{{product_name}} in week two",
    bodyHtml: `<p>Hey {{first_name}},</p>
<p>Saw the {{product_name}} launch. Week one usually takes care of itself — week two is where most launches go quiet.</p>
<p>ShipBoost keeps the listing useful after launch day instead of letting it turn into dead archive furniture. Categories, tags, and alternatives pages keep working when buyers search later.</p>
<p>Send me a yes and I'll draft the {{website_domain}} listing.</p>
${SIG}`,
  },
  {
    key: "ph-06-observation-noname",
    subject: "{{product_name}}",
    bodyHtml: `<p>Hey,</p>
<p>{{tagline}} — clear enough that I clicked through. That's already more than most PH posts earn.</p>
<p>The question now is whether anyone who didn't see launch day will find {{website_domain}} next month. ShipBoost is built to handle that part: discoverability after the launch window ends.</p>
<p>Open to a quick exchange?</p>
${SIG}`,
  },
  {
    key: "ph-07-short-named",
    subject: "{{product_name}}",
    bodyHtml: `<p>Hey {{first_name}},</p>
<p>{{product_name}} on PH today — nice work. Want me to draft a {{website_domain}} listing that keeps working after the launch?</p>
${SIG}`,
  },
  {
    key: "ph-08-noun-forward-named",
    subject: "a listing that keeps working — {{product_name}}",
    bodyHtml: `<p>Hey {{first_name}},</p>
<p>Saw {{product_name}} launch. A listing should be a working tool, not a trophy. ShipBoost gives {{website_domain}} a place buyers can discover, compare, and come back to after the launch rotates off the front page.</p>
<p>If that fits, I'll send the draft.</p>
${SIG}`,
  },
  {
    key: "ph-09-trust-named",
    subject: "{{product_name}} — trust after launch",
    bodyHtml: `<p>Hey {{first_name}},</p>
<p>{{tagline}}. Strong positioning.</p>
<p>Most founders treat trust like a post-launch problem — launch first, build credibility later. In practice it usually works the other way around. The listing that's still working in month two is the one buyers compare against alternatives.</p>
<p>ShipBoost builds that listing for {{website_domain}}. Want a draft?</p>
${SIG}`,
  },
  {
    key: "ph-10-second-job-noname",
    subject: "{{product_name}} — the second job",
    bodyHtml: `<p>Hey,</p>
<p>Most launches do one job: get a spike. {{product_name}} just did that.</p>
<p>The second job is harder: keep getting discovered when launch week ends. ShipBoost handles that — categories, tags, and alternatives pages that stay useful after the front page rotates.</p>
<p>If {{website_domain}} should keep showing up, send a yes.</p>
${SIG}`,
  },
  {
    key: "ph-11-quiet-named",
    subject: "{{product_name}}",
    bodyHtml: `<p>Hey {{first_name}},</p>
<p>{{product_name}} hit PH today. Congrats.</p>
<p>The quiet part of a launch is week three: PH traffic has rotated, the X post is buried, and the listing — if there is one — is dead archive furniture. ShipBoost is the listing that keeps working past week three.</p>
<p>Worth a look for {{website_domain}}?</p>
${SIG}`,
  },
  {
    key: "ph-12-positioning-noname",
    subject: "{{product_name}} — positioning past launch",
    bodyHtml: `<p>Hey,</p>
<p>{{tagline}} reads like real positioning, not a tagline written for launch day. That earns a longer second life — if the listing exists to support it.</p>
<p>ShipBoost is where {{website_domain}} stays discoverable after the launch week rotates. Categories, tags, alternatives pages. The buyer who arrives in month two finds you.</p>
<p>Send a yes and I'll draft it.</p>
${SIG}`,
  },
];
```

Create `src/lib/draft/follow-up-templates.ts`:

```ts
import type { Template } from "./select";

const SIG = `<p>— {{sender_first_name}}</p>`;

export const followUpTemplates: Template[] = [
  {
    key: "fu-01-bump-named",
    subject: "Re: {{product_name}}",
    bodyHtml: `<p>Hey {{first_name}},</p>
<p>Floating this back up in case it got buried. Still worth a look for {{website_domain}}?</p>
${SIG}`,
  },
  {
    key: "fu-02-direct-noname",
    subject: "Re: {{product_name}}",
    bodyHtml: `<p>Hey,</p>
<p>One more nudge on this — does {{website_domain}} need a listing that keeps working past launch week, or are you set?</p>
${SIG}`,
  },
  {
    key: "fu-03-soft-close-named",
    subject: "Re: {{product_name}}",
    bodyHtml: `<p>Hey {{first_name}},</p>
<p>Last note on this — if the answer is no, no problem. If it's "tell me more," reply and I'll send the breakdown.</p>
${SIG}`,
  },
  {
    key: "fu-04-mechanic-noname",
    subject: "Re: {{product_name}}",
    bodyHtml: `<p>Hey,</p>
<p>Quick follow-up. The point of ShipBoost is the buyer who shows up in month two — they find {{website_domain}} or they find whatever ranks. Open to a draft?</p>
${SIG}`,
  },
];
```

- [ ] **Step 8: Voice-compliance test**

Create `tests/draft/voice-compliance.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { templates } from "@/lib/draft/templates";
import { followUpTemplates } from "@/lib/draft/follow-up-templates";

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
];

const STACCATO_STACK = /(?:^|>)\s*([A-Z][a-z]+\.\s+){3,}\s*(?:<|$)/m;

describe("voice-profile compliance", () => {
  for (const t of [...templates, ...followUpTemplates]) {
    it(`${t.key} contains no banned phrases`, () => {
      const blob = `${t.subject}\n${t.bodyHtml}`;
      for (const re of BANNED) expect(blob, `matched ${re}`).not.toMatch(re);
      expect(blob, "staccato fragment stack").not.toMatch(STACCATO_STACK);
    });
  }
  it("template keys are unique", () => {
    const all = [...templates, ...followUpTemplates].map((t) => t.key);
    expect(new Set(all).size).toBe(all.length);
  });
});
```

- [ ] **Step 9: Run all draft tests (pass)**

Run: `npx vitest run tests/draft/`
Expected: all pass.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat(draft): 12 templates + 4 follow-ups + render/select + voice tests"
```

---

## Task 8: Pipeline orchestration

**Files:** `src/lib/pipeline/fetch-and-queue.ts`, `tests/pipeline/dedup.test.ts`

- [ ] **Step 1: Failing test**

Create `tests/pipeline/dedup.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/sources/product-hunt", () => ({
  ProductHuntSource: class {
    kind = "PRODUCT_HUNT" as const;
    async fetchSince() {
      return [{
        externalId: "p1", name: "Wavefly", tagline: "quiet launches",
        url: "https://trywavefly.com/", launchedAt: new Date("2026-05-19T16:00:00Z"),
        votesCount: 12, topics: ["saas"], raw: {},
      }];
    }
  },
}));

vi.mock("@/lib/scrape/extract-email", () => ({
  extractEmail: vi.fn().mockResolvedValue({ email: "sarah@trywavefly.com", name: "Sarah", source: "ABOUT_PAGE" }),
}));

vi.mock("@/lib/scrape/fetch-html", () => ({ jitter: async () => {} }));

type Row = Record<string, unknown> & { id: string };
const db = {
  contactsByEmail: new Map<string, Row>(),
  contactsByDomain: new Map<string, Row>(),
  drafts: [] as Row[],
  launches: new Map<string, Row>(),
  sources: new Map<string, Row>(),
};

vi.mock("@/server/db/client", () => {
  return {
    prisma: {
      source: {
        upsert: async ({ where, create }: { where: { kind: string }; create: Row }) => {
          if (!db.sources.has(where.kind)) db.sources.set(where.kind, { id: `s_${where.kind}`, ...create });
          return db.sources.get(where.kind)!;
        },
      },
      launch: {
        upsert: async ({ create }: { create: Row & { sourceId: string; externalId: string } }) => {
          const key = `${create.sourceId}:${create.externalId}`;
          if (db.launches.has(key)) return db.launches.get(key)!;
          const row = { id: `l_${db.launches.size}`, ...create };
          db.launches.set(key, row); return row;
        },
      },
      contact: {
        findUnique: async ({ where }: { where: { email?: string; domain?: string } }) =>
          (where.email && db.contactsByEmail.get(where.email)) ||
          (where.domain && db.contactsByDomain.get(where.domain)) ||
          null,
        create: async ({ data }: { data: Row & { email: string; domain: string } }) => {
          const row = { id: `c_${db.contactsByEmail.size}`, ...data };
          db.contactsByEmail.set(data.email, row);
          db.contactsByDomain.set(data.domain, row);
          return row;
        },
      },
      outreachDraft: {
        create: async ({ data }: { data: Row }) => { const row = { id: `d_${db.drafts.length}`, ...data }; db.drafts.push(row); return row; },
        count: async () => db.drafts.length,
      },
    },
  };
});

beforeEach(() => {
  db.contactsByEmail.clear(); db.contactsByDomain.clear();
  db.drafts.length = 0; db.launches.clear(); db.sources.clear();
});

import { runFetchAndQueue } from "@/lib/pipeline/fetch-and-queue";

describe("runFetchAndQueue", () => {
  it("creates one draft on first run, zero on second (domain dedup)", async () => {
    const r1 = await runFetchAndQueue();
    expect(r1.draftsCreated).toBe(1);
    expect(db.drafts).toHaveLength(1);

    const r2 = await runFetchAndQueue();
    expect(r2.draftsCreated).toBe(0);
    expect(db.drafts).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test (fail)**

Run: `npx vitest run tests/pipeline/dedup.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/lib/pipeline/fetch-and-queue.ts`:

```ts
import { prisma } from "@/server/db/client";
import { ProductHuntSource } from "@/lib/sources/product-hunt";
import { extractEmail } from "@/lib/scrape/extract-email";
import { jitter } from "@/lib/scrape/fetch-html";
import { templates } from "@/lib/draft/templates";
import { selectTemplate } from "@/lib/draft/select";
import { renderTemplate } from "@/lib/draft/render";

const DAILY_CAP = 30;

export type FetchResult = { launchesSeen: number; emailsFound: number; draftsCreated: number; skipped: number };

export async function runFetchAndQueue(): Promise<FetchResult> {
  const source = await prisma.source.upsert({
    where: { kind: "PRODUCT_HUNT" },
    create: { kind: "PRODUCT_HUNT", name: "Product Hunt" },
    update: {},
  });

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const launches = await new ProductHuntSource().fetchSince(since);

  const result: FetchResult = { launchesSeen: launches.length, emailsFound: 0, draftsCreated: 0, skipped: 0 };
  const senderFirstName = process.env.SENDER_FIRST_NAME ?? "Tim";

  for (const raw of launches) {
    if (result.draftsCreated >= DAILY_CAP) break;

    const launch = await prisma.launch.upsert({
      where: { sourceId_externalId: { sourceId: source.id, externalId: raw.externalId } },
      create: {
        sourceId: source.id, externalId: raw.externalId, name: raw.name, tagline: raw.tagline,
        url: raw.url, launchedAt: raw.launchedAt, raw: raw.raw as object,
      },
      update: {},
    });

    const domain = new URL(raw.url).hostname.replace(/^www\./, "").toLowerCase();
    const dupeByDomain = await prisma.contact.findUnique({ where: { domain } });
    if (dupeByDomain) { result.skipped++; continue; }

    const hit = await extractEmail(raw.url);
    await jitter();
    if (!hit) { result.skipped++; continue; }
    result.emailsFound++;

    const dupeByEmail = await prisma.contact.findUnique({ where: { email: hit.email } });
    if (dupeByEmail) { result.skipped++; continue; }

    let contact;
    try {
      contact = await prisma.contact.create({
        data: { email: hit.email, domain, name: hit.name, launchId: launch.id, discoveredFrom: hit.source },
      });
    } catch { result.skipped++; continue; }

    const eligible = hit.name ? templates : templates.filter((t) => t.key.endsWith("-noname"));
    const pool = eligible.length ? eligible : templates;
    const tmpl = selectTemplate(domain, pool);

    const rendered = renderTemplate(tmpl, {
      first_name: hit.name,
      product_name: raw.name,
      tagline: raw.tagline ?? raw.name,
      website_domain: domain,
      sender_first_name: senderFirstName,
    });

    await prisma.outreachDraft.create({
      data: {
        contactId: contact.id, templateKey: tmpl.key,
        subject: rendered.subject, body: rendered.bodyHtml, bodyText: rendered.bodyText,
      },
    });
    result.draftsCreated++;
  }

  return result;
}
```

- [ ] **Step 4: Run test (pass)**

Run: `npx vitest run tests/pipeline/dedup.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(pipeline): fetch-and-queue with dedup + daily cap"
```

---

## Task 9: Daily fetch cron route

**Files:** `src/app/api/cron/fetch-launches/route.ts`

- [ ] **Step 1: Write route**

Create `src/app/api/cron/fetch-launches/route.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { runFetchAndQueue } from "@/lib/pipeline/fetch-and-queue";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const headerSecret = req.headers.get("x-cron-secret") ?? req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (headerSecret !== secret) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json({ ok: true, result: await runFetchAndQueue() });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
```

- [ ] **Step 2: Manual verification**

`npm run dev`, then:

```bash
curl -i -H "x-cron-secret: $(grep CRON_SECRET .env.local | cut -d= -f2)" \
  http://localhost:3000/api/cron/fetch-launches
```
Expected: 200 with `{ "ok": true, "result": {...} }`. Without header: 401.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(api): /api/cron/fetch-launches with secret guard"
```

---

## Task 10: Inbox UI + edit/skip endpoints

**Files:** `src/app/inbox/{page.tsx,InboxClient.tsx}`, `src/app/api/drafts/[id]/{route.ts,skip/route.ts}`

The inbox renders draft HTML inside a sandboxed iframe (`srcDoc`, `sandbox` attribute with no permissions). This avoids `dangerouslySetInnerHTML` and matches how real email clients render untrusted HTML.

- [ ] **Step 1: Write inbox server component**

Create `src/app/inbox/page.tsx`:

```tsx
import { prisma } from "@/server/db/client";
import { InboxClient, type DraftView } from "./InboxClient";

export const dynamic = "force-dynamic";

export default async function InboxPage() {
  const rows = await prisma.outreachDraft.findMany({
    where: { status: "PENDING_REVIEW" },
    orderBy: { createdAt: "desc" },
    include: { contact: { include: { launch: true } } },
  });
  const sentToday = await prisma.outreachDraft.count({
    where: { status: "SENT", sentAt: { gte: new Date(new Date().setHours(0,0,0,0)) } },
  });
  const drafts: DraftView[] = rows.map((d) => ({
    id: d.id,
    subject: d.subject,
    bodyHtml: d.body,
    templateKey: d.templateKey,
    contact: {
      email: d.contact.email, name: d.contact.name, domain: d.contact.domain,
      discoveredFrom: d.contact.discoveredFrom,
    },
    launch: { name: d.contact.launch.name, tagline: d.contact.launch.tagline, url: d.contact.launch.url },
  }));
  return <InboxClient drafts={drafts} sentToday={sentToday} />;
}
```

- [ ] **Step 2: Write inbox client**

Create `src/app/inbox/InboxClient.tsx`:

```tsx
"use client";
import { useState, useEffect, useCallback } from "react";

export type DraftView = {
  id: string;
  subject: string;
  bodyHtml: string;
  templateKey: string;
  contact: { email: string; name: string | null; domain: string; discoveredFrom: string };
  launch: { name: string; tagline: string | null; url: string };
};

export function InboxClient({ drafts: initial, sentToday }: { drafts: DraftView[]; sentToday: number }) {
  const [drafts, setDrafts] = useState(initial);
  const [activeId, setActiveId] = useState<string | null>(initial[0]?.id ?? null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const active = drafts.find((d) => d.id === activeId) ?? null;

  const remove = (id: string) => {
    setDrafts((ds) => {
      const i = ds.findIndex((d) => d.id === id);
      const next = ds.filter((d) => d.id !== id);
      setActiveId(next[Math.min(i, next.length - 1)]?.id ?? null);
      return next;
    });
  };

  const move = useCallback((delta: number) => {
    setActiveId((cur) => {
      const idx = drafts.findIndex((d) => d.id === cur);
      const next = drafts[Math.max(0, Math.min(drafts.length - 1, idx + delta))];
      return next?.id ?? cur;
    });
  }, [drafts]);

  const send = useCallback(async () => {
    if (!active || busy) return;
    setBusy(true);
    const res = await fetch(`/api/drafts/${active.id}/send`, { method: "POST" });
    setBusy(false);
    if (res.ok) remove(active.id);
    else alert(`Send failed: ${await res.text()}`);
  }, [active, busy]);

  const skip = useCallback(async () => {
    if (!active || busy) return;
    setBusy(true);
    await fetch(`/api/drafts/${active.id}/skip`, { method: "POST" });
    setBusy(false);
    remove(active.id);
  }, [active, busy]);

  useEffect(() => {
    if (editing) return;
    const h = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && ["INPUT", "TEXTAREA"].includes(e.target.tagName)) return;
      if (e.key === "j") move(1);
      else if (e.key === "k") move(-1);
      else if (e.key === "s") send();
      else if (e.key === "x") skip();
      else if (e.key === "e") setEditing(true);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [move, send, skip, editing]);

  return (
    <main className="grid grid-cols-[320px_1fr] h-screen">
      <aside className="border-r border-zinc-800 overflow-y-auto">
        <div className="p-3 text-xs text-zinc-500 border-b border-zinc-800">
          {drafts.length} pending · sent today: {sentToday}/30
        </div>
        {drafts.map((d) => (
          <button
            key={d.id}
            onClick={() => { setActiveId(d.id); setEditing(false); }}
            className={`w-full text-left p-3 border-b border-zinc-900 hover:bg-zinc-900 ${d.id === activeId ? "bg-zinc-900" : ""}`}
          >
            <div className="font-medium truncate">{d.launch.name}</div>
            <div className="text-xs text-zinc-500 truncate">{d.contact.email}</div>
            <div className="text-xs text-zinc-600 truncate">{d.subject}</div>
          </button>
        ))}
      </aside>
      <section className="overflow-y-auto p-6">
        {!active ? (
          <div className="text-zinc-500">Inbox zero.</div>
        ) : (
          <DraftPanel
            key={active.id}
            draft={active}
            editing={editing}
            setEditing={setEditing}
            onSend={send}
            onSkip={skip}
            busy={busy}
            onUpdated={(patch) => setDrafts((ds) => ds.map((d) => d.id === active.id ? { ...d, ...patch } : d))}
          />
        )}
      </section>
    </main>
  );
}

function DraftPanel({
  draft, editing, setEditing, onSend, onSkip, busy, onUpdated,
}: {
  draft: DraftView;
  editing: boolean;
  setEditing: (b: boolean) => void;
  onSend: () => void;
  onSkip: () => void;
  busy: boolean;
  onUpdated: (patch: Partial<DraftView>) => void;
}) {
  const [subject, setSubject] = useState(draft.subject);
  const [bodyHtml, setBodyHtml] = useState(draft.bodyHtml);

  const save = async () => {
    const res = await fetch(`/api/drafts/${draft.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ subject, bodyHtml }),
    });
    if (!res.ok) { alert(await res.text()); return; }
    onUpdated({ subject, bodyHtml });
    setEditing(false);
  };

  // Wrap body in a minimal document so iframe srcDoc renders cleanly with white background.
  const iframeDoc = `<!doctype html><html><head><meta charset="utf-8"><style>
    body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#111;background:#fff;font-size:14px;line-height:1.5;margin:16px}
    a{color:#1d4ed8}
  </style></head><body>${draft.bodyHtml}</body></html>`;

  return (
    <div className="max-w-2xl space-y-4">
      <header className="flex items-baseline justify-between">
        <div>
          <h1 className="text-lg font-medium">{draft.launch.name}</h1>
          <p className="text-sm text-zinc-500">{draft.launch.tagline}</p>
          <p className="text-xs text-zinc-600 mt-1">
            <a href={draft.launch.url} target="_blank" rel="noreferrer" className="underline">{draft.launch.url}</a>
          </p>
        </div>
        <div className="text-right">
          <div className="text-sm">{draft.contact.email}</div>
          {draft.contact.name && <div className="text-xs text-zinc-500">{draft.contact.name}</div>}
          <div className="text-xs text-zinc-600">via {draft.contact.discoveredFrom.toLowerCase()}</div>
          <div className="text-xs text-zinc-700 mt-1">tmpl: {draft.templateKey}</div>
        </div>
      </header>
      <div className="rounded border border-zinc-800 p-4 space-y-3 bg-zinc-950">
        {editing ? (
          <>
            <input value={subject} onChange={(e) => setSubject(e.target.value)}
              className="w-full px-2 py-1 bg-zinc-900 border border-zinc-800 rounded" />
            <textarea value={bodyHtml} onChange={(e) => setBodyHtml(e.target.value)}
              rows={14}
              className="w-full px-2 py-1 bg-zinc-900 border border-zinc-800 rounded font-mono text-sm" />
            <div className="flex gap-2">
              <button onClick={save} className="px-3 py-1.5 bg-zinc-100 text-zinc-900 rounded">Save</button>
              <button onClick={() => setEditing(false)} className="px-3 py-1.5 bg-zinc-800 rounded">Cancel</button>
            </div>
          </>
        ) : (
          <>
            <div className="font-medium">{draft.subject}</div>
            <iframe
              title="email preview"
              sandbox=""
              srcDoc={iframeDoc}
              className="w-full h-80 bg-white rounded"
            />
            <div className="flex gap-2 pt-2">
              <button onClick={onSend} disabled={busy} className="px-3 py-1.5 bg-zinc-100 text-zinc-900 rounded disabled:opacity-50">Send (s)</button>
              <button onClick={() => setEditing(true)} className="px-3 py-1.5 bg-zinc-800 rounded">Edit (e)</button>
              <button onClick={onSkip} disabled={busy} className="px-3 py-1.5 bg-zinc-800 rounded">Skip (x)</button>
            </div>
            <div className="text-xs text-zinc-600">j/k navigate · e edit · s send · x skip</div>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Write PATCH /api/drafts/[id]**

Create `src/app/api/drafts/[id]/route.ts`:

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { convert } from "html-to-text";
import DOMPurify from "isomorphic-dompurify";
import { prisma } from "@/server/db/client";

const Patch = z.object({ subject: z.string().min(1).max(200), bodyHtml: z.string().min(1) });

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = Patch.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const cleanHtml = DOMPurify.sanitize(parsed.data.bodyHtml, {
    ALLOWED_TAGS: ["p", "br", "a", "strong", "em", "ul", "ol", "li", "blockquote"],
    ALLOWED_ATTR: ["href"],
  });
  const bodyText = convert(cleanHtml, { wordwrap: 80 });
  await prisma.outreachDraft.update({
    where: { id }, data: { subject: parsed.data.subject, body: cleanHtml, bodyText },
  });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Write skip route**

Create `src/app/api/drafts/[id]/skip/route.ts`:

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/server/db/client";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.outreachDraft.update({ where: { id }, data: { status: "SKIPPED" } });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 5: Manual verification**

`npm run dev`, log in, seed drafts via `/api/cron/fetch-launches`, visit `/inbox`. Verify:
- Draft renders in the iframe with white background.
- `j`/`k` navigates.
- `e` opens editor, save persists.
- `x` removes the draft.

Send button will 500 until Task 12.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(ui): inbox with sandboxed iframe preview + edit/skip endpoints"
```

---

## Task 11: Zoho OAuth client

**Files:** `src/lib/zoho/client.ts`, `src/app/api/zoho/authorize/route.ts`, `src/app/api/zoho/callback/route.ts`

- [ ] **Step 1: Write Zoho client**

Create `src/lib/zoho/client.ts`:

```ts
import { request } from "undici";
import { prisma } from "@/server/db/client";

const ACCOUNTS_BASE = "https://accounts.zoho.com";
const MAIL_BASE = "https://mail.zoho.com/api";

let cachedToken: { value: string; expiresAt: number } | null = null;

export const ZOHO_SCOPES = "ZohoMail.messages.ALL,ZohoMail.accounts.READ";

export function authorizeUrl(state: string): string {
  const u = new URL(`${ACCOUNTS_BASE}/oauth/v2/auth`);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("client_id", required("ZOHO_CLIENT_ID"));
  u.searchParams.set("scope", ZOHO_SCOPES);
  u.searchParams.set("redirect_uri", required("ZOHO_REDIRECT_URI"));
  u.searchParams.set("access_type", "offline");
  u.searchParams.set("prompt", "consent");
  u.searchParams.set("state", state);
  return u.toString();
}

export async function exchangeCodeForRefreshToken(code: string): Promise<{ refreshToken: string }> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: required("ZOHO_CLIENT_ID"),
    client_secret: required("ZOHO_CLIENT_SECRET"),
    redirect_uri: required("ZOHO_REDIRECT_URI"),
    code,
  });
  const { statusCode, body: resBody } = await request(`${ACCOUNTS_BASE}/oauth/v2/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const json = (await resBody.json()) as { refresh_token?: string; error?: string };
  if (statusCode !== 200 || !json.refresh_token) throw new Error(`Zoho token exchange failed: ${JSON.stringify(json)}`);
  return { refreshToken: json.refresh_token };
}

export async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) return cachedToken.value;
  const cred = await prisma.zohoCredential.findFirst({ orderBy: { updatedAt: "desc" } });
  if (!cred) throw new Error("No Zoho credential — visit /api/zoho/authorize");
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: required("ZOHO_CLIENT_ID"),
    client_secret: required("ZOHO_CLIENT_SECRET"),
    refresh_token: cred.refreshToken,
  });
  const { statusCode, body: resBody } = await request(`${ACCOUNTS_BASE}/oauth/v2/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const json = (await resBody.json()) as { access_token?: string; expires_in?: number; error?: string };
  if (statusCode !== 200 || !json.access_token) throw new Error(`Zoho refresh failed: ${JSON.stringify(json)}`);
  cachedToken = { value: json.access_token, expiresAt: Date.now() + (json.expires_in ?? 3500) * 1000 };
  return json.access_token;
}

export async function zohoFetch(path: string, init: { method?: string; body?: unknown } = {}): Promise<unknown> {
  const token = await getAccessToken();
  const { statusCode, body } = await request(`${MAIL_BASE}${path}`, {
    method: init.method ?? "GET",
    headers: { authorization: `Zoho-oauthtoken ${token}`, "content-type": "application/json", accept: "application/json" },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  const text = await body.text();
  if (statusCode >= 400) throw new Error(`Zoho ${path} ${statusCode}: ${text}`);
  return text ? JSON.parse(text) : {};
}

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} missing`);
  return v;
}
```

- [ ] **Step 2: Write authorize route**

Create `src/app/api/zoho/authorize/route.ts`:

```ts
import { NextResponse } from "next/server";
import { authorizeUrl } from "@/lib/zoho/client";
import crypto from "node:crypto";

export async function GET() {
  const state = crypto.randomBytes(16).toString("hex");
  const res = NextResponse.redirect(authorizeUrl(state));
  res.cookies.set("zoho_oauth_state", state, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 600 });
  return res;
}
```

- [ ] **Step 3: Write callback route**

Create `src/app/api/zoho/callback/route.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { exchangeCodeForRefreshToken, ZOHO_SCOPES } from "@/lib/zoho/client";
import { prisma } from "@/server/db/client";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const expected = req.cookies.get("zoho_oauth_state")?.value;
  if (!code || !state || state !== expected) {
    return NextResponse.json({ ok: false, error: "state mismatch" }, { status: 400 });
  }
  const { refreshToken } = await exchangeCodeForRefreshToken(code);
  const existing = await prisma.zohoCredential.findFirst();
  const accountId = process.env.ZOHO_ACCOUNT_ID ?? "";
  if (existing) {
    await prisma.zohoCredential.update({ where: { id: existing.id }, data: { refreshToken, accountId, scope: ZOHO_SCOPES } });
  } else {
    await prisma.zohoCredential.create({ data: { refreshToken, accountId, scope: ZOHO_SCOPES } });
  }
  return NextResponse.redirect(new URL("/inbox", req.url));
}
```

- [ ] **Step 4: Manual verification**

1. Register Self Client at `https://api-console.zoho.com/` → grab Client ID/Secret. Add redirect URI from env.
2. Find Zoho Account ID via Zoho Mail admin or `GET /api/accounts`.
3. Fill `.env.local`.
4. `npm run dev`, log in, visit `http://localhost:3000/api/zoho/authorize` → consent → callback → redirect to `/inbox`.
5. Confirm `ZohoCredential` row exists via `npm run prisma:studio`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(zoho): OAuth flow + access-token refresh + REST helper"
```

---

## Task 12: Send endpoint

**Files:** `src/lib/zoho/send.ts`, `src/app/api/drafts/[id]/send/route.ts`

- [ ] **Step 1: Write send helper**

Create `src/lib/zoho/send.ts`:

```ts
import { prisma } from "@/server/db/client";
import { zohoFetch } from "./client";

const DAILY_CAP = 30;

export async function sendDraft(draftId: string): Promise<{ zohoMessageId: string }> {
  const draft = await prisma.outreachDraft.findUniqueOrThrow({
    where: { id: draftId }, include: { contact: true },
  });
  if (draft.status !== "PENDING_REVIEW") throw new Error(`draft not pending (status=${draft.status})`);

  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const sentToday = await prisma.outreachDraft.count({ where: { status: "SENT", sentAt: { gte: todayStart } } });
  if (sentToday >= DAILY_CAP) throw new Error(`daily send cap reached (${DAILY_CAP})`);

  const accountId = process.env.ZOHO_ACCOUNT_ID;
  if (!accountId) throw new Error("ZOHO_ACCOUNT_ID missing");
  const fromAddress = process.env.SENDER_EMAIL;
  if (!fromAddress) throw new Error("SENDER_EMAIL missing");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const pixel = `<img src="${appUrl}/api/pixel/${draft.id}" width="1" height="1" alt="" style="display:block">`;
  const bodyHtml = draft.body.includes("</body>") ? draft.body.replace("</body>", `${pixel}</body>`) : draft.body + pixel;

  const payload = {
    fromAddress, toAddress: draft.contact.email,
    subject: draft.subject, content: bodyHtml,
    mailFormat: "html", askReceipt: "no",
  };

  const res = (await zohoFetch(`/accounts/${accountId}/messages`, { method: "POST", body: payload })) as {
    data?: { messageId?: string };
  };
  const messageId = res.data?.messageId;
  if (!messageId) {
    await prisma.outreachDraft.update({ where: { id: draftId }, data: { status: "FAILED" } });
    throw new Error(`Zoho send returned no messageId: ${JSON.stringify(res)}`);
  }

  await prisma.$transaction([
    prisma.outreachDraft.update({ where: { id: draftId }, data: { status: "SENT", sentAt: new Date() } }),
    prisma.emailMessage.create({
      data: {
        draftId, zohoMessageId: messageId, direction: "OUT",
        subject: draft.subject, snippet: draft.bodyText.slice(0, 200), headers: {},
      },
    }),
  ]);

  return { zohoMessageId: messageId };
}
```

- [ ] **Step 2: Write send route**

Create `src/app/api/drafts/[id]/send/route.ts`:

```ts
import { NextResponse } from "next/server";
import { sendDraft } from "@/lib/zoho/send";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    return NextResponse.json({ ok: true, ...(await sendDraft(id)) });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
```

- [ ] **Step 3: Manual verification**

In `/inbox`, click Send on a draft addressed to a mailbox you control. Confirm:
- Message arrives at recipient.
- Message also appears in Zoho Sent folder.
- `OutreachDraft.status = SENT`, `EmailMessage` row exists with `direction = OUT`.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(zoho): send endpoint with daily cap + pixel injection"
```

---

## Task 13: Tracking pixel

**Files:** `src/app/api/pixel/[id]/route.ts`

- [ ] **Step 1: Write route**

Create `src/app/api/pixel/[id]/route.ts`:

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/server/db/client";

export const dynamic = "force-dynamic";

const GIF_1x1 = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const draft = await prisma.outreachDraft.findUnique({ where: { id } });
  if (draft) {
    const since = new Date(Date.now() - 60_000);
    const recent = await prisma.outreachEvent.findFirst({
      where: { draftId: id, kind: "OPEN", createdAt: { gte: since } },
    });
    if (!recent) {
      await prisma.outreachEvent.create({
        data: {
          draftId: id, kind: "OPEN",
          payload: {
            ua: req.headers.get("user-agent") ?? "",
            ip: req.headers.get("x-forwarded-for") ?? "",
            ts: new Date().toISOString(),
          },
        },
      });
    }
  }
  return new NextResponse(GIF_1x1, {
    status: 200,
    headers: {
      "content-type": "image/gif",
      "content-length": String(GIF_1x1.byteLength),
      "cache-control": "no-store, max-age=0, must-revalidate",
      pragma: "no-cache",
    },
  });
}
```

- [ ] **Step 2: Manual verification**

```bash
curl -i http://localhost:3000/api/pixel/<real-draft-id>
```
Expected: 200, `content-type: image/gif`, 43-byte body. Second call within 60s → no new `OutreachEvent`. After 60s → new event.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(api): tracking pixel with 60s dedup"
```

---

## Task 14: Reply detection + follow-up cron

**Files:** `src/lib/zoho/replies.ts`, `src/lib/pipeline/process-follow-ups.ts`, `src/app/api/cron/follow-ups/route.ts`

- [ ] **Step 1: Write reply poller**

Create `src/lib/zoho/replies.ts`:

```ts
import { prisma } from "@/server/db/client";
import { zohoFetch } from "./client";

type ZohoListItem = { messageId: string; inReplyTo?: string; subject?: string; summary?: string };

export async function pollReplies(): Promise<{ matched: number }> {
  const accountId = process.env.ZOHO_ACCOUNT_ID;
  if (!accountId) throw new Error("ZOHO_ACCOUNT_ID missing");

  const inbox = (await zohoFetch(`/accounts/${accountId}/messages/view?folder=Inbox&limit=200`)) as {
    data?: ZohoListItem[];
  };
  const items = inbox.data ?? [];

  let matched = 0;
  for (const m of items) {
    if (!m.inReplyTo) continue;
    const parent = await prisma.emailMessage.findUnique({ where: { zohoMessageId: m.inReplyTo } });
    if (!parent) continue;
    if (await prisma.emailMessage.findUnique({ where: { zohoMessageId: m.messageId } })) continue;

    await prisma.$transaction([
      prisma.emailMessage.create({
        data: {
          draftId: parent.draftId, zohoMessageId: m.messageId, direction: "IN",
          subject: m.subject ?? "", snippet: (m.summary ?? "").slice(0, 200),
          headers: { inReplyTo: m.inReplyTo },
        },
      }),
      prisma.outreachEvent.create({
        data: { draftId: parent.draftId, kind: "REPLY", payload: { zohoMessageId: m.messageId } },
      }),
    ]);
    matched++;
  }
  return { matched };
}
```

- [ ] **Step 2: Write follow-up processor**

Create `src/lib/pipeline/process-follow-ups.ts`:

```ts
import { prisma } from "@/server/db/client";
import { pollReplies } from "@/lib/zoho/replies";
import { followUpTemplates } from "@/lib/draft/follow-up-templates";
import { selectTemplate } from "@/lib/draft/select";
import { renderTemplate } from "@/lib/draft/render";

const FOLLOW_UP_AFTER_DAYS = 5;

export async function runFollowUps(): Promise<{ replied: number; followUpsQueued: number }> {
  const { matched } = await pollReplies();

  const cutoff = new Date(Date.now() - FOLLOW_UP_AFTER_DAYS * 24 * 60 * 60 * 1000);
  const candidates = await prisma.outreachDraft.findMany({
    where: {
      status: "SENT", sentAt: { lt: cutoff }, parentDraftId: null,
      events: { none: { kind: { in: ["REPLY", "FOLLOWUP_SENT"] } } },
    },
    include: { contact: { include: { launch: true } } },
  });

  const senderFirstName = process.env.SENDER_FIRST_NAME ?? "Tim";
  let queued = 0;

  for (const parent of candidates) {
    const c = parent.contact;
    const eligible = c.name ? followUpTemplates : followUpTemplates.filter((t) => t.key.endsWith("-noname"));
    const pool = eligible.length ? eligible : followUpTemplates;
    const tmpl = selectTemplate(c.domain, pool);

    const rendered = renderTemplate(tmpl, {
      first_name: c.name ?? undefined,
      product_name: c.launch.name,
      tagline: c.launch.tagline ?? c.launch.name,
      website_domain: c.domain,
      sender_first_name: senderFirstName,
    });

    await prisma.$transaction([
      prisma.outreachDraft.create({
        data: {
          contactId: c.id, parentDraftId: parent.id, templateKey: tmpl.key,
          subject: rendered.subject.startsWith("Re:") ? rendered.subject : `Re: ${parent.subject}`,
          body: rendered.bodyHtml, bodyText: rendered.bodyText,
        },
      }),
      prisma.outreachEvent.create({ data: { draftId: parent.id, kind: "FOLLOWUP_SENT", payload: {} } }),
    ]);
    queued++;
  }
  return { replied: matched, followUpsQueued: queued };
}
```

- [ ] **Step 3: Write follow-up cron route**

Create `src/app/api/cron/follow-ups/route.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { runFollowUps } from "@/lib/pipeline/process-follow-ups";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const headerSecret = req.headers.get("x-cron-secret") ?? req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (headerSecret !== secret) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json({ ok: true, ...(await runFollowUps()) });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
```

- [ ] **Step 4: Manual verification**

Send a draft to a mailbox you own, reply to it from that mailbox, then call the follow-up cron. Expect `replied >= 1`. For the follow-up generation half, temporarily set `FOLLOW_UP_AFTER_DAYS = 0` to exercise it; **revert to 5 before committing**.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(pipeline): reply detection + follow-up generation"
```

---

## Task 15: Vercel cron config + v2 ingest stub

**Files:** `vercel.json`, `src/app/api/ingest/launches/route.ts`

- [ ] **Step 1: Write vercel.json**

Create `vercel.json`:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "crons": [
    { "path": "/api/cron/fetch-launches", "schedule": "0 9 * * *" },
    { "path": "/api/cron/follow-ups",      "schedule": "0 10 * * *" }
  ]
}
```

- [ ] **Step 2: Write v2 ingest stub**

Create `src/app/api/ingest/launches/route.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

const Payload = z.object({
  source: z.enum(["PEERPUSH", "PEERLIST", "UNEED", "FOUNDRLIST", "SCROLLLAUNCH"]),
  launches: z.array(z.object({
    externalId: z.string(),
    name: z.string(),
    tagline: z.string().optional(),
    url: z.string().url(),
    launchedAt: z.string().datetime(),
  })),
});

export async function POST(req: NextRequest) {
  const secret = process.env.INGEST_SECRET;
  if (!secret || req.headers.get("x-ingest-secret") !== secret) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const parsed = Payload.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });
  return NextResponse.json({
    ok: true, accepted: parsed.data.launches.length,
    note: "v2 stub — not yet wired into pipeline",
  });
}
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore(deploy): vercel cron config + v2 ingest stub"
```

---

## Task 16: Deployment + smoke test

- [ ] **Step 1: Provision Neon Postgres**

Create a project at `https://neon.tech`. Copy connection string into Vercel project env as `DATABASE_URL`.

- [ ] **Step 2: Push to GitHub + import to Vercel**

```bash
cd /Users/tsth/Coding/shipboost/outreach
gh repo create shipboost-outreach --private --source=. --remote=origin --push
```
Import the repo at `https://vercel.com/new`. Root Directory = repo root.

- [ ] **Step 3: Set Vercel env vars**

In Vercel → Settings → Environment Variables, add the same keys as `.env.local.example` with production values. Set `ZOHO_REDIRECT_URI` and `NEXT_PUBLIC_APP_URL` to the deployed origin.

- [ ] **Step 4: Run prod migration**

```bash
DATABASE_URL=<neon-prod-url> npx prisma migrate deploy
```

- [ ] **Step 5: First deploy**

Trigger a deploy. After it completes, visit `/api/zoho/authorize` on the deployed origin and complete OAuth against the production callback URL (must be registered in Zoho API Console).

- [ ] **Step 6: DNS deliverability**

On `shipboost.com` DNS:
- SPF: `v=spf1 include:zoho.com ~all`
- DKIM: selector + TXT generated by Zoho Mail admin → Email Configuration → DKIM
- DMARC: `v=DMARC1; p=quarantine; rua=mailto:dmarc@shipboost.com`

Verify with `dig TXT shipboost.com` and `https://www.mail-tester.com/`.

- [ ] **Step 7: Cron smoke test**

```bash
curl -H "x-cron-secret: $CRON_SECRET" https://<deployed>/api/cron/fetch-launches
```
Expected: 200 with result summary. Visit `/inbox`, confirm drafts, send one to an address you control, verify delivery.

- [ ] **Step 8: Tag**

```bash
git tag v0.1.0
git push --tags
```

---

## Self-review notes

Spec ↔ plan coverage:
- §1 goal — Tasks 6, 8, 9, 10, 12, 14 ✓
- §2 architecture — Tasks 1, 2, 9, 14, 15 ✓
- §3 stack — Task 1 ✓
- §4 repo layout — mirrored ✓
- §5 data model — Task 2 ✓
- §6.1 fetch pipeline — Tasks 8, 9 ✓
- §6.2 follow-up pipeline — Task 14 ✓
- §6.3 vercel cron — Task 15 ✓
- §7 drafting — Task 7 ✓
- §8 email discovery — Tasks 4, 5 ✓
- §9 inbox UI — Task 10 (sandboxed iframe — addresses XSS concern by isolating untrusted HTML even though source is operator-controlled) ✓
- §10 sending — Tasks 11, 12 ✓
- §11 pixel — Task 13 ✓
- §12 deliverability — Task 16 step 6 ✓
- §13 v2 escape hatch — Task 15 stub ✓
- §14 testing — Tasks 4, 5, 6, 7, 8 ✓
- §15 env vars — Task 1 `.env.local.example` ✓
