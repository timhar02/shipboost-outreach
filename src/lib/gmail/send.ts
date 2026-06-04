import { prisma } from "@/server/db/client";
import { getConnectedGmailAccount, gmailFetch } from "./client";
import { buildRawHtmlEmail } from "./mime";
import { autoSendDailyCap } from "@/lib/auto-send/config";

type GmailSendResponse = {
  id?: string;
  threadId?: string;
};

type GmailMessageMetadata = {
  payload?: {
    headers?: Array<{ name?: string; value?: string }>;
  };
};

type ReplyContext = {
  threadId?: string;
  headers: Record<string, string>;
};

type SendDraftOptions = {
  skipDailyCap?: boolean;
};

export async function sendDraft(
  draftId: string,
  options: SendDraftOptions = {},
): Promise<{ gmailMessageId: string; gmailThreadId: string }> {
  const draft = await prisma.outreachDraft.findUniqueOrThrow({
    where: { id: draftId },
    include: {
      contact: true,
      parentDraft: {
        include: {
          messages: {
            where: { direction: "OUT" },
            orderBy: { receivedAt: "desc" },
            take: 1,
          },
        },
      },
    },
  });
  if (draft.status !== "PENDING_REVIEW") throw new Error(`draft not pending (status=${draft.status})`);

  const connected = await getConnectedGmailAccount();
  if (!connected) throw new Error("No Gmail credential - visit /api/gmail/authorize");

  const fromAddress = process.env.SENDER_EMAIL;
  if (!fromAddress) throw new Error("SENDER_EMAIL missing");
  if (connected.accountEmail.toLowerCase() !== fromAddress.toLowerCase()) {
    throw new Error(`SENDER_EMAIL (${fromAddress}) does not match connected Gmail account (${connected.accountEmail})`);
  }

  if (!options.skipDailyCap) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const sentToday = await prisma.outreachDraft.count({ where: { status: "SENT", sentAt: { gte: todayStart } } });
    const dailyCap = autoSendDailyCap();
    if (sentToday >= dailyCap) throw new Error(`daily send cap reached (${dailyCap})`);
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const pixel = `<img src="${appUrl}/api/pixel/${draft.id}" width="1" height="1" alt="" style="display:block">`;
  const bodyHtml = draft.body.includes("</body>") ? draft.body.replace("</body>", `${pixel}</body>`) : draft.body + pixel;
  const replyContext = await getReplyContext(draft.parentDraft?.messages[0]);

  const raw = buildRawHtmlEmail({
    from: fromAddress,
    to: draft.contact.email,
    subject: draft.subject,
    html: bodyHtml,
    headers: replyContext.headers,
  });

  const res = await gmailFetch<GmailSendResponse>("/users/me/messages/send", {
    method: "POST",
    body: replyContext.threadId ? { raw, threadId: replyContext.threadId } : { raw },
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
        headers: replyContext.headers,
      },
    }),
  ]);

  return { gmailMessageId: res.id, gmailThreadId: res.threadId };
}

async function getReplyContext(
  parentMessage?: { providerMessageId: string; providerThreadId: string | null },
): Promise<ReplyContext> {
  if (!parentMessage?.providerThreadId) return { headers: {} };

  const parentHeaders = await getParentMessageHeaders(parentMessage.providerMessageId);
  const parentMessageId = parentHeaders["message-id"];
  const references = [parentHeaders.references, parentMessageId].filter(Boolean).join(" ");

  return {
    threadId: parentMessage.providerThreadId,
    headers: {
      ...(parentMessageId ? { "In-Reply-To": parentMessageId } : {}),
      ...(references ? { References: references } : {}),
    },
  };
}

async function getParentMessageHeaders(providerMessageId: string): Promise<Record<string, string>> {
  try {
    const metadata = await gmailFetch<GmailMessageMetadata>(
      `/users/me/messages/${providerMessageId}?format=metadata&metadataHeaders=Message-ID&metadataHeaders=References`,
    );
    return Object.fromEntries(
      (metadata.payload?.headers ?? [])
        .filter((header): header is { name: string; value: string } => Boolean(header.name && header.value))
        .map((header) => [header.name.toLowerCase(), header.value]),
    );
  } catch {
    return {};
  }
}
