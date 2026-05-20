import { prisma } from "@/server/db/client";
import { ProductHuntSource } from "@/lib/sources/product-hunt";
import { extractEmail } from "@/lib/scrape/extract-email";
import { jitter } from "@/lib/scrape/fetch-html";
import { templates } from "@/lib/draft/templates";
import { selectTemplate } from "@/lib/draft/select";
import { renderTemplate } from "@/lib/draft/render";

const DAILY_CAP = 30;

export type FetchResult = { launchesSeen: number; emailsFound: number; draftsCreated: number; skipped: number };

export async function runFetchAndQueue(): Promise<FetchResult> {
  const source = await prisma.source.upsert({
    where: { kind: "PRODUCT_HUNT" },
    create: { kind: "PRODUCT_HUNT", name: "Product Hunt" },
    update: {},
  });

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const launches = await new ProductHuntSource().fetchSince(since);

  const result: FetchResult = { launchesSeen: launches.length, emailsFound: 0, draftsCreated: 0, skipped: 0 };
  const senderFirstName = process.env.SENDER_FIRST_NAME ?? "Tim";

  for (const raw of launches) {
    if (result.draftsCreated >= DAILY_CAP) break;

    const launch = await prisma.launch.upsert({
      where: { sourceId_externalId: { sourceId: source.id, externalId: raw.externalId } },
      create: {
        sourceId: source.id, externalId: raw.externalId, name: raw.name, tagline: raw.tagline,
        url: raw.url, launchedAt: raw.launchedAt, raw: raw.raw as object,
      },
      update: {},
    });

    const domain = new URL(raw.url).hostname.replace(/^www\./, "").toLowerCase();
    const dupeByDomain = await prisma.contact.findUnique({ where: { domain } });
    if (dupeByDomain) { result.skipped++; continue; }

    const hit = await extractEmail(raw.url);
    await jitter();
    if (!hit) { result.skipped++; continue; }
    result.emailsFound++;

    const dupeByEmail = await prisma.contact.findUnique({ where: { email: hit.email } });
    if (dupeByEmail) { result.skipped++; continue; }

    let contact;
    try {
      contact = await prisma.contact.create({
        data: { email: hit.email, domain, name: hit.name, launchId: launch.id, discoveredFrom: hit.source },
      });
    } catch { result.skipped++; continue; }

    const eligible = hit.name ? templates : templates.filter((t) => t.key.endsWith("-noname"));
    const pool = eligible.length ? eligible : templates;
    const tmpl = selectTemplate(domain, pool);

    const rendered = renderTemplate(tmpl, {
      first_name: hit.name,
      product_name: raw.name,
      tagline: raw.tagline ?? raw.name,
      website_domain: domain,
      sender_first_name: senderFirstName,
    });

    await prisma.outreachDraft.create({
      data: {
        contactId: contact.id, templateKey: tmpl.key,
        subject: rendered.subject, body: rendered.bodyHtml, bodyText: rendered.bodyText,
      },
    });
    result.draftsCreated++;
  }

  return result;
}
