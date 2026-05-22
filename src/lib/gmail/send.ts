import { prisma } from "@/server/db/client";
import { getConnectedGmailAccount, gmailFetch } from "./client";
import { buildRawHtmlEmail } from "./mime";
import { autoSendDailyCap } from "@/lib/auto-send/config";

export async function sendDraft(draftId: string): Promise<{ gmailMessageId: string; gmailThreadId: string }> {
  const draft = await prisma.outreachDraft.findUniqueOrThrow({
    where: { id: draftId },
    include: { contact: true },
  });
  if (draft.status !== "PENDING_REVIEW") throw new Error(`draft not pending (status=${draft.status})`);

  const connected = await getConnectedGmailAccount();
  if (!connected) throw new Error("No Gmail credential - visit /api/gmail/authorize");

  const fromAddress = process.env.SENDER_EMAIL;
  if (!fromAddress) throw new Error("SENDER_EMAIL missing");
  if (connected.accountEmail.toLowerCase() !== fromAddress.toLowerCase()) {
    throw new Error(`SENDER_EMAIL (${fromAddress}) does not match connected Gmail account (${connected.accountEmail})`);
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const sentToday = await prisma.outreachDraft.count({ where: { status: "SENT", sentAt: { gte: todayStart } } });
  const dailyCap = autoSendDailyCap();
  if (sentToday >= dailyCap) throw new Error(`daily send cap reached (${dailyCap})`);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const pixel = `<img src="${appUrl}/api/pixel/${draft.id}" width="1" height="1" alt="" style="display:block">`;
  const bodyHtml = draft.body.includes("</body>") ? draft.body.replace("</body>", `${pixel}</body>`) : draft.body + pixel;

  const raw = buildRawHtmlEmail({
    from: fromAddress,
    to: draft.contact.email,
    subject: draft.subject,
    html: bodyHtml,
  });

  const res = await gmailFetch<{ id?: string; threadId?: string }>("/users/me/messages/send", {
    method: "POST",
    body: { raw },
  });

  if (!res.id || !res.threadId) {
    await prisma.outreachDraft.update({ where: { id: draftId }, data: { status: "FAILED" } });
    throw new Error(`Gmail send returned no message id: ${JSON.stringify(res)}`);
  }

  await prisma.$transaction([
    prisma.outreachDraft.update({ where: { id: draftId }, data: { status: "SENT", sentAt: new Date() } }),
    prisma.emailMessage.create({
      data: {
        draftId,
        providerMessageId: res.id,
        providerThreadId: res.threadId,
        direction: "OUT",
        subject: draft.subject,
        snippet: draft.bodyText.slice(0, 200),
        headers: {},
      },
    }),
  ]);

  return { gmailMessageId: res.id, gmailThreadId: res.threadId };
}
