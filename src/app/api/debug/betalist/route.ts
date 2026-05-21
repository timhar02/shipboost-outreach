import { NextResponse } from "next/server";
import { BetaListSource } from "@/lib/sources/betalist";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  try {
    const launches = await new BetaListSource().fetchSince(new Date(0));
    return NextResponse.json({
      ok: true,
      count: launches.length,
      sample: launches.slice(0, 20).map((l) => ({
        name: l.name,
        tagline: l.tagline,
        url: l.url,
        externalId: l.externalId,
      })),
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
