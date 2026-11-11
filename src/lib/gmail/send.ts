import { prisma } from "@/server/db/client";
import { gmailFetch } from "./client";
import { availableSenders, pickSender, primarySender } from "./senders";
import { buildRawHtmlEmail } from "./mime";
import { autoSendDailyCap } from "@/lib/auto-send/config";
import { validateRecipientEmail } from "@/lib/email/validation";

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
  if (draft.contact.suppressedAt) {
    throw new Error(`recipient suppressed: ${draft.contact.suppressionReason ?? "unknown"}`);
  }

  // A follow-up goes out from the account that sent its first email, so it
  // lands in the same thread; first emails rotate across connected senders.
  const fromAddress = draft.parentDraft
    ? (draft.parentDraft.senderEmail ?? primarySender()).toLowerCase()
    : (draft.senderEmail?.toLowerCase() ?? (await pickSender()));
  const senders = await availableSenders();
  if (!senders.length) throw new Error("No Gmail credential - visit /api/gmail/authorize");
  if (!senders.includes(fromAddress)) {
    throw new Error(`Sender ${fromAddress} is not a connected account listed in SENDER_EMAILS`);
  }

  if (!options.skipDailyCap) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const sentToday = await prisma.outreachDraft.count({ where: { status: "SENT", sentAt: { gte: todayStart } } });
    const dailyCap = autoSendDailyCap();
    if (sentToday >= dailyCap) throw new Error(`daily send cap reached (${dailyCap})`);
  }

  const validation = await validateRecipientEmail(draft.contact.email);
  if (!validation.ok) {
    await prisma.$transaction([
      prisma.outreachDraft.update({ where: { id: draftId }, data: { status: "FAILED" } }),
      prisma.contact.update({
        where: { id: draft.contactId },
        data: {
          suppressedAt: new Date(),
          suppressionReason: `validation:${validation.reason}`,
        },
      }),
    ]);
    throw new Error(`recipient validation failed: ${validation.reason}`);
  }

  const replyContext = await getReplyContext(draft.parentDraft?.messages[0], fromAddress);

  const raw = buildRawHtmlEmail({
    from: fromAddress,
    to: draft.contact.email,
    subject: draft.subject,
    // No open-tracking pixel: it is a spam signal for cold email, and image
    // proxies (Gmail, Apple) make the opens it reports meaningless.
    html: draft.body,
    headers: replyContext.headers,
  });

  const res = await gmailFetch<GmailSendResponse>(
    "/users/me/messages/send",
    {
      method: "POST",
      body: replyContext.threadId ? { raw, threadId: replyContext.threadId } : { raw },
    },
    fromAddress,
  );

  if (!res.id || !res.threadId) {
    await prisma.outreachDraft.update({ where: { id: draftId }, data: { status: "FAILED" } });
    throw new Error(`Gmail send returned no message id: ${JSON.stringify(res)}`);
  }

  await prisma.$transaction([
    prisma.outreachDraft.update({
      where: { id: draftId },
      data: { status: "SENT", sentAt: new Date(), senderEmail: fromAddress },
    }),
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
  parentMessage: { providerMessageId: string; providerThreadId: string | null } | undefined,
  accountEmail: string,
): Promise<ReplyContext> {
  if (!parentMessage?.providerThreadId) return { headers: {} };

  const parentHeaders = await getParentMessageHeaders(parentMessage.providerMessageId, accountEmail);
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

async function getParentMessageHeaders(providerMessageId: string, accountEmail: string): Promise<Record<string, string>> {
  try {
    const metadata = await gmailFetch<GmailMessageMetadata>(
      `/users/me/messages/${providerMessageId}?format=metadata&metadataHeaders=Message-ID&metadataHeaders=References`,
      {},
      accountEmail,
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
