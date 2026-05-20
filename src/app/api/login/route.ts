import { NextResponse } from "next/server";
import { createSessionCookie } from "@/lib/auth";

export async function POST(req: Request) {
  const form = await req.formData();
  const password = form.get("password");
  if (typeof password !== "string" || password !== process.env.OUTREACH_PASSWORD) {
    return NextResponse.redirect(new URL("/login?error=1", req.url), { status: 303 });
  }
  const cookie = await createSessionCookie();
  const res = NextResponse.redirect(new URL("/inbox", req.url), { status: 303 });
  res.cookies.set(cookie.name, cookie.value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: cookie.maxAge,
  });
  return res;
}
