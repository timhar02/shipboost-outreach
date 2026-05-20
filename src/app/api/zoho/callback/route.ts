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
