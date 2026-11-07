import { NextResponse, type NextRequest } from "next/server";
import { runFetchAndQueue } from "@/lib/pipeline/fetch-and-queue";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const headerSecret = req.headers.get("x-cron-secret") ?? req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (headerSecret !== secret) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  try {
    // Optional one-off backfill: ?sinceDays=28&sources=SCROLLLAUNCH,NICK_LAUNCHES
    const sinceDays = Number.parseInt(req.nextUrl.searchParams.get("sinceDays") ?? "", 10);
    const kinds = req.nextUrl.searchParams.get("sources")?.split(",").map((kind) => kind.trim()).filter(Boolean);
    const result = await runFetchAndQueue({
      sinceDays: Number.isFinite(sinceDays) ? Math.min(Math.max(sinceDays, 1), 35) : undefined,
      kinds,
    });
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
