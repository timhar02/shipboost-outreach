import { NextResponse } from "next/server";
import { zohoFetch } from "@/lib/zoho/client";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await zohoFetch("/accounts");
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
