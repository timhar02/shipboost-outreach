import { NextResponse, type NextRequest } from "next/server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/auth";

const PUBLIC = [
  /^\/login$/,
  /^\/api\/login$/,
  /^\/api\/cron\//,
  /^\/api\/pixel\//,
  /^\/api\/ingest\//,
  /^\/api\/zoho\/callback$/,
  /^\/api\/debug\//,
  /^\/api\/admin\//,
];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((re) => re.test(pathname))) return NextResponse.next();
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (await verifySessionToken(token)) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  return NextResponse.redirect(url);
}

export const config = { matcher: ["/((?!_next|favicon.ico).*)"] };
