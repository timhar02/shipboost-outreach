import { NextResponse } from "next/server";
import { z } from "zod";
import { convert } from "html-to-text";
import DOMPurify from "isomorphic-dompurify";
import { prisma } from "@/server/db/client";

const Patch = z.object({ subject: z.string().min(1).max(200), bodyHtml: z.string().min(1) });

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = Patch.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const cleanHtml = DOMPurify.sanitize(parsed.data.bodyHtml, {
    ALLOWED_TAGS: ["p", "br", "a", "strong", "em", "ul", "ol", "li", "blockquote"],
    ALLOWED_ATTR: ["href"],
  });
  const bodyText = convert(cleanHtml, { wordwrap: 80 });
  await prisma.outreachDraft.update({
    where: { id }, data: { subject: parsed.data.subject, body: cleanHtml, bodyText },
  });
  return NextResponse.json({ ok: true });
}
