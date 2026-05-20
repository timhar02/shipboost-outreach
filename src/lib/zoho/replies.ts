import { prisma } from "@/server/db/client";
import { zohoFetch } from "./client";

type ZohoListItem = { messageId: string; inReplyTo?: string; subject?: string; summary?: string };

export async function pollReplies(): Promise<{ matched: number }> {
  const accountId = process.env.ZOHO_ACCOUNT_ID;
  if (!accountId) throw new Error("ZOHO_ACCOUNT_ID missing");

  const inbox = (await zohoFetch(`/accounts/${accountId}/messages/view?folder=Inbox&limit=200`)) as {
    data?: ZohoListItem[];
  };
  const items = inbox.data ?? [];

  let matched = 0;
  for (const m of items) {
    if (!m.inReplyTo) continue;
    const parent = await prisma.emailMessage.findUnique({ where: { zohoMessageId: m.inReplyTo } });
    if (!parent) continue;
    if (await prisma.emailMessage.findUnique({ where: { zohoMessageId: m.messageId } })) continue;

    await prisma.$transaction([
      prisma.emailMessage.create({
        data: {
          draftId: parent.draftId, zohoMessageId: m.messageId, direction: "IN",
          subject: m.subject ?? "", snippet: (m.summary ?? "").slice(0, 200),
          headers: { inReplyTo: m.inReplyTo },
        },
      }),
      prisma.outreachEvent.create({
        data: { draftId: parent.draftId, kind: "REPLY", payload: { zohoMessageId: m.messageId } },
      }),
    ]);
    matched++;
  }
  return { matched };
}
