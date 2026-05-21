#!/usr/bin/env node
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const drafts = await prisma.outreachDraft.findMany({
  include: { contact: { include: { launch: { include: { source: true } } } } },
  orderBy: { createdAt: "desc" },
});
const byBucket = drafts.reduce((acc, d) => {
  const src = d.contact.launch.source.kind;
  acc[src] = (acc[src] || 0) + 1;
  return acc;
}, {});
console.log("Drafts by source:", byBucket);
console.log("Total drafts:", drafts.length);
console.log();
console.log("UNEED drafts:");
for (const d of drafts.filter((d) => d.contact.launch.source.kind === "UNEED")) {
  console.log(`  ${d.contact.email}  ←  ${d.contact.launch.name}  (template: ${d.templateKey})`);
}
console.log();

const deferred = await prisma.launch.findMany({
  where: { contact: null, source: { kind: "UNEED" } },
  include: { source: true },
  orderBy: { fetchedAt: "desc" },
});
console.log(`Deferred UNEED launches (no contact yet): ${deferred.length}`);
for (const l of deferred.slice(0, 25)) {
  console.log(`  ${l.name}  ←  ${l.url}`);
}
await prisma.$disconnect();
