import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

const Payload = z.object({
  source: z.enum(["PEERPUSH", "PEERLIST", "UNEED", "FOUNDRLIST", "SCROLLLAUNCH"]),
  launches: z.array(z.object({
    externalId: z.string(),
    name: z.string(),
    tagline: z.string().optional(),
    url: z.string().url(),
    launchedAt: z.string().datetime(),
  })),
});

export async function POST(req: NextRequest) {
  const secret = process.env.INGEST_SECRET;
  if (!secret || req.headers.get("x-ingest-secret") !== secret) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const parsed = Payload.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });
  return NextResponse.json({
    ok: true, accepted: parsed.data.launches.length,
    note: "v2 stub — not yet wired into pipeline",
  });
}
