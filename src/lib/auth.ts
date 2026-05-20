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
