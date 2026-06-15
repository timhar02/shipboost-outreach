#!/usr/bin/env node
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const bouncedEmails = [
  { email: "server@mcp.penlog.app", reason: "bounce:delivery_delayed" },
  { email: "service@slopguard.app", reason: "bounce:recipient_server_timeout" },
  { email: "support@stackoverlap.app", reason: "bounce:address_not_found" },
];

(async () => {
  for (const row of bouncedEmails) {
    const contact = await prisma.contact.findUnique({ where: { email: row.email } });
    if (!contact) {
      console.log(`missing ${row.email}`);
      continue;
    }
    await prisma.contact.update({
      where: { id: contact.id },
      data: { suppressedAt: new Date(), suppressionReason: row.reason },
    });
    await prisma.outreachDraft.updateMany({
      where: { contactId: contact.id, status: "SENT" },
      data: { status: "BOUNCED" },
    });
    console.log(`suppressed ${row.email} (${row.reason})`);
  }
})()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
