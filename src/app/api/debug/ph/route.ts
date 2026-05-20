import { NextResponse } from "next/server";
import { ProductHuntSource } from "@/lib/sources/product-hunt";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET() {
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const src = new ProductHuntSource();
    const launches = await src.fetchSince(since);
    return NextResponse.json({
      ok: true,
      sinceUtc: since.toISOString(),
      count: launches.length,
      sample: launches.slice(0, 5).map((l) => ({
        id: l.externalId,
        name: l.name,
        tagline: l.tagline,
        url: l.url,
        topics: l.topics,
      })),
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err), stack: err instanceof Error ? err.stack : undefined },
      { status: 500 },
    );
  }
}
