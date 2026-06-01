import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/server/db/client";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

const Patch = z.object({ decision: z.enum(["confirm", "reject"]) });

/**
 * Resolve a POSSIBLE (name-similarity) conversion match. `confirm` promotes it
 * to a counted, email-attributed conversion; `reject` marks it organic. Either
 * way the decision sticks — the hourly sync won't overwrite it.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const parsed = Patch.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const conversion = await prisma.conversion.findUnique({ where: { id } });
  if (!conversion) {
    return NextResponse.json({ error: "Conversion not found." }, { status: 404 });
  }
  if (conversion.matchStatus !== "POSSIBLE") {
    return NextResponse.json(
      { error: "Only POSSIBLE matches can be reviewed." },
      { status: 409 },
    );
  }

  const updated = await prisma.conversion.update({
    where: { id },
    data:
      parsed.data.decision === "confirm"
        ? { matchStatus: "CONFIRMED" }
        : {
            matchStatus: "REJECTED",
            matchedContactId: null,
            matchedDraftId: null,
            matchedTemplateKey: null,
            matchConfidence: null,
          },
  });

  return NextResponse.json({ ok: true, data: { id: updated.id, matchStatus: updated.matchStatus } });
}
