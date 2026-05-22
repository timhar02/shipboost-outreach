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
