import { NextResponse, type NextRequest } from "next/server";
import { getSourceYield } from "@/lib/analytics/source-yield";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const headerSecret = req.headers.get("x-cron-secret") ?? req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (headerSecret !== secret) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  return NextResponse.json({ ok: true, sources: await getSourceYield() });
}
