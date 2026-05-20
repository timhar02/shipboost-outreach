import { prisma } from "@/server/db/client";
import { zohoFetch } from "./client";

const DAILY_CAP = 30;

export async function sendDraft(draftId: string): Promise<{ zohoMessageId: string }> {
  const draft = await prisma.outreachDraft.findUniqueOrThrow({
    where: { id: draftId }, include: { contact: true },
  });
  if (draft.status !== "PENDING_REVIEW") throw new Error(`draft not pending (status=${draft.status})`);

  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const sentToday = await prisma.outreachDraft.count({ where: { status: "SENT", sentAt: { gte: todayStart } } });
  if (sentToday >= DAILY_CAP) throw new Error(`daily send cap reached (${DAILY_CAP})`);

  const accountId = process.env.ZOHO_ACCOUNT_ID;
  if (!accountId) throw new Error("ZOHO_ACCOUNT_ID missing");
  const fromAddress = process.env.SENDER_EMAIL;
  if (!fromAddress) throw new Error("SENDER_EMAIL missing");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const pixel = `<img src="${appUrl}/api/pixel/${draft.id}" width="1" height="1" alt="" style="display:block">`;
  const bodyHtml = draft.body.includes("</body>") ? draft.body.replace("</body>", `${pixel}</body>`) : draft.body + pixel;

  const payload = {
    fromAddress, toAddress: draft.contact.email,
    subject: draft.subject, content: bodyHtml,
    mailFormat: "html", askReceipt: "no",
  };

  const res = (await zohoFetch(`/accounts/${accountId}/messages`, { method: "POST", body: payload })) as {
    data?: { messageId?: string };
  };
  const messageId = res.data?.messageId;
  if (!messageId) {
    await prisma.outreachDraft.update({ where: { id: draftId }, data: { status: "FAILED" } });
    throw new Error(`Zoho send returned no messageId: ${JSON.stringify(res)}`);
  }

  await prisma.$transaction([
    prisma.outreachDraft.update({ where: { id: draftId }, data: { status: "SENT", sentAt: new Date() } }),
    prisma.emailMessage.create({
      data: {
        draftId, zohoMessageId: messageId, direction: "OUT",
        subject: draft.subject, snippet: draft.bodyText.slice(0, 200), headers: {},
      },
    }),
  ]);

  return { zohoMessageId: messageId };
}
