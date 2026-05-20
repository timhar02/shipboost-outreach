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
