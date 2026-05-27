import { NextResponse } from "next/server";
import { PeerPushSource } from "@/lib/sources/peerpush";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
export const maxDuration = 60;

export async function GET() {
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const launches = await new PeerPushSource().fetchSince(since);
    return NextResponse.json({
      ok: true,
      sinceUtc: since.toISOString(),
      count: launches.length,
      sample: launches.slice(0, 10).map((l) => ({
        name: l.name,
        tagline: l.tagline,
        url: l.url,
        topics: l.topics,
        publishedAt: l.launchedAt.toISOString(),
      })),
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
