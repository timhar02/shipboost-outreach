import { request } from "undici";
import { prisma } from "@/server/db/client";

const AUTH_BASE = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const GMAIL_BASE = "https://gmail.googleapis.com/gmail/v1";
const USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";

// Access tokens per connected account (lowercased email).
const cachedTokens = new Map<string, { value: string; expiresAt: number }>();

export const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.readonly",
  "openid",
  "email",
].join(" ");

export function authorizeUrl(state: string): string {
  const u = new URL(AUTH_BASE);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("client_id", required("GOOGLE_CLIENT_ID"));
  u.searchParams.set("redirect_uri", required("GOOGLE_REDIRECT_URI"));
  u.searchParams.set("scope", GMAIL_SCOPES);
  u.searchParams.set("access_type", "offline");
  u.searchParams.set("prompt", "consent");
  u.searchParams.set("state", state);
  return u.toString();
}

export async function exchangeCodeForRefreshToken(code: string): Promise<{ refreshToken: string; accountEmail: string }> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: required("GOOGLE_CLIENT_ID"),
    client_secret: required("GOOGLE_CLIENT_SECRET"),
    redirect_uri: required("GOOGLE_REDIRECT_URI"),
    code,
  });

  const { statusCode, body: resBody } = await request(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const json = (await resBody.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };
  if (statusCode !== 200 || !json.access_token || !json.refresh_token) {
    throw new Error(`Google token exchange failed: ${JSON.stringify(json)}`);
  }

  const accountEmail = await fetchAccountEmail(json.access_token);
  cachedTokens.set(accountEmail.toLowerCase(), { value: json.access_token, expiresAt: Date.now() + (json.expires_in ?? 3500) * 1000 });
  return { refreshToken: json.refresh_token, accountEmail };
}

export async function getConnectedGmailAccount(): Promise<{ accountEmail: string } | null> {
  const cred = await prisma.emailCredential.findFirst({
    where: { provider: "GMAIL" },
    orderBy: { updatedAt: "desc" },
    select: { accountEmail: true },
  });
  return cred;
}

export async function listConnectedGmailAccounts(): Promise<string[]> {
  const creds = await prisma.emailCredential.findMany({
    where: { provider: "GMAIL" },
    orderBy: { createdAt: "asc" },
    select: { accountEmail: true },
  });
  return creds.map((cred) => cred.accountEmail);
}

/** Access token for one account, or the most recently connected one when none is given. */
export async function getAccessToken(accountEmail?: string): Promise<string> {
  const cred = accountEmail
    ? await prisma.emailCredential.findFirst({
        where: { provider: "GMAIL", accountEmail: { equals: accountEmail, mode: "insensitive" } },
      })
    : await prisma.emailCredential.findFirst({ where: { provider: "GMAIL" }, orderBy: { updatedAt: "desc" } });
  if (!cred) throw new Error(accountEmail ? `No Gmail credential for ${accountEmail} - visit /api/gmail/authorize` : "No Gmail credential - visit /api/gmail/authorize");
  const cacheKey = cred.accountEmail.toLowerCase();
  const cached = cachedTokens.get(cacheKey);
  if (cached && cached.expiresAt > Date.now() + 30_000) return cached.value;

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: required("GOOGLE_CLIENT_ID"),
    client_secret: required("GOOGLE_CLIENT_SECRET"),
    refresh_token: cred.refreshToken,
  });
  const { statusCode, body: resBody } = await request(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const json = (await resBody.json()) as { access_token?: string; expires_in?: number; error?: string; error_description?: string };
  if (statusCode !== 200 || !json.access_token) throw new Error(`Google refresh failed: ${JSON.stringify(json)}`);
  cachedTokens.set(cacheKey, { value: json.access_token, expiresAt: Date.now() + (json.expires_in ?? 3500) * 1000 });
  return json.access_token;
}

/** Gmail API call as `accountEmail`, or as the most recently connected account. */
export async function gmailFetch<T>(
  path: string,
  init: { method?: string; body?: unknown } = {},
  accountEmail?: string,
): Promise<T> {
  const token = await getAccessToken(accountEmail);
  const { statusCode, body } = await request(`${GMAIL_BASE}${path}`, {
    method: init.method ?? "GET",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json", accept: "application/json" },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  const text = await body.text();
  if (statusCode >= 400) throw new Error(`Gmail ${path} ${statusCode}: ${text}`);
  return (text ? JSON.parse(text) : {}) as T;
}

async function fetchAccountEmail(accessToken: string): Promise<string> {
  const { statusCode, body } = await request(USERINFO_URL, {
    headers: { authorization: `Bearer ${accessToken}`, accept: "application/json" },
  });
  const json = (await body.json()) as { email?: string; error?: string };
  if (statusCode !== 200 || !json.email) throw new Error(`Google userinfo failed: ${JSON.stringify(json)}`);
  return json.email;
}

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} missing`);
  return v;
}
