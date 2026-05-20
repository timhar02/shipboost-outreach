import { NextResponse } from "next/server";
import { prisma } from "@/server/db/client";

export const dynamic = "force-dynamic";

const GIF_1x1 = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const draft = await prisma.outreachDraft.findUnique({ where: { id } });
  if (draft) {
    const since = new Date(Date.now() - 60_000);
    const recent = await prisma.outreachEvent.findFirst({
      where: { draftId: id, kind: "OPEN", createdAt: { gte: since } },
    });
    if (!recent) {
      await prisma.outreachEvent.create({
        data: {
          draftId: id, kind: "OPEN",
          payload: {
            ua: req.headers.get("user-agent") ?? "",
            ip: req.headers.get("x-forwarded-for") ?? "",
            ts: new Date().toISOString(),
          },
        },
      });
    }
  }
  return new NextResponse(new Uint8Array(GIF_1x1), {
    status: 200,
    headers: {
      "content-type": "image/gif",
      "content-length": String(GIF_1x1.byteLength),
      "cache-control": "no-store, max-age=0, must-revalidate",
      pragma: "no-cache",
    },
  });
}
