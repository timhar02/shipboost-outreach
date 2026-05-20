import { NextResponse } from "next/server";
import { prisma } from "@/server/db/client";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.outreachDraft.update({ where: { id }, data: { status: "SKIPPED" } });
  return NextResponse.json({ ok: true });
}
