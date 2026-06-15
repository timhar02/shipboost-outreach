import { prisma } from "@/server/db/client";
import { gmailFetch } from "./client";
import { classifyInboundEmail } from "@/lib/email/bounce";

type GmailListResponse = { messages?: Array<{ id: string; threadId: string }> };
type GmailMessage = {
  id: string;
  threadId: string;
  snippet?: string;
  payload?: { headers?: Array<{ name: string; value: string }> };
};

export async function pollReplies(): Promise<{ matched: number; bounced: number }> {
  const listed = await gmailFetch<GmailListResponse>("/users/me/messages?maxResults=200&labelIds=INBOX&q=newer_than:14d");
  const items = listed.messages ?? [];

  let matched = 0;
  let bounced = 0;
  for (const item of items) {
    if (await prisma.emailMessage.findUnique({ where: { providerMessageId: item.id } })) continue;

    const parent = await prisma.emailMessage.findFirst({
      where: { direction: "OUT", providerThreadId: item.threadId },
      include: { draft: { select: { contactId: true } } },
    });
    if (!parent) continue;

    const full = await gmailFetch<GmailMessage>(
      `/users/me/messages/${item.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=In-Reply-To&metadataHeaders=References`,
    );
    const headers = Object.fromEntries((full.payload?.headers ?? []).map((h) => [h.name.toLowerCase(), h.value]));
    const classification = classifyInboundEmail({
      from: headers.from,
      subject: headers.subject,
      snippet: full.snippet,
    });

    if (classification.kind === "BOUNCE") {
      await prisma.$transaction([
        prisma.emailMessage.create({
          data: {
            draftId: parent.draftId,
            providerMessageId: full.id,
            providerThreadId: full.threadId,
            direction: "IN",
            subject: headers.subject ?? "",
            snippet: (full.snippet ?? "").slice(0, 200),
            headers,
          },
        }),
        prisma.outreachEvent.create({
          data: {
            draftId: parent.draftId,
            kind: "BOUNCE",
            payload: {
              gmailMessageId: full.id,
              gmailThreadId: full.threadId,
              severity: classification.severity,
              reason: classification.reason,
            },
          },
        }),
        prisma.outreachDraft.update({ where: { id: parent.draftId }, data: { status: "BOUNCED" } }),
        prisma.contact.update({
          where: { id: parent.draft.contactId },
          data: {
            suppressedAt: new Date(),
            suppressionReason: `bounce:${classification.reason}`,
          },
        }),
      ]);
      bounced++;
      continue;
    }

    await prisma.$transaction([
      prisma.emailMessage.create({
        data: {
          draftId: parent.draftId,
          providerMessageId: full.id,
          providerThreadId: full.threadId,
          direction: "IN",
          subject: headers.subject ?? "",
          snippet: (full.snippet ?? "").slice(0, 200),
          headers,
        },
      }),
      prisma.outreachEvent.create({
        data: { draftId: parent.draftId, kind: "REPLY", payload: { gmailMessageId: full.id, gmailThreadId: full.threadId } },
      }),
    ]);
    matched++;
  }

  return { matched, bounced };
}
