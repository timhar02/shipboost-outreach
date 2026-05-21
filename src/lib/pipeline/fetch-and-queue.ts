import { prisma } from "@/server/db/client";
import { PeerPushSource } from "@/lib/sources/peerpush";
import { HackerNewsSource } from "@/lib/sources/hacker-news";
import { BetaListSource } from "@/lib/sources/betalist";
import { extractEmail } from "@/lib/scrape/extract-email";
import { jitter } from "@/lib/scrape/fetch-html";
import { templates } from "@/lib/draft/templates";
import { selectTemplate } from "@/lib/draft/select";
import { renderTemplate } from "@/lib/draft/render";

const DAILY_CAP = 30;

export type FetchResult = {
  launchesSeen: number;
  emailsFound: number;
  draftsCreated: number;
  skipped: number;
  bySource: Record<string, number>;
};

const SOURCES = [new PeerPushSource(), new HackerNewsSource(), new BetaListSource()];

export async function runFetchAndQueue(): Promise<FetchResult> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const senderFirstName = process.env.SENDER_FIRST_NAME ?? "Tim";
  const shipboostDr = process.env.SHIPBOOST_DR ?? "44";

  const result: FetchResult = {
    launchesSeen: 0,
    emailsFound: 0,
    draftsCreated: 0,
    skipped: 0,
    bySource: {},
  };

  for (const sourceAdapter of SOURCES) {
    const source = await prisma.source.upsert({
      where: { kind: sourceAdapter.kind },
      create: { kind: sourceAdapter.kind, name: sourceAdapter.kind },
      update: {},
    });

    let launches: Awaited<ReturnType<typeof sourceAdapter.fetchSince>>;
    try {
      launches = await sourceAdapter.fetchSince(since);
    } catch {
      // If one source errors, continue to next rather than aborting all.
      continue;
    }

    result.launchesSeen += launches.length;
    result.bySource[sourceAdapter.kind] = 0;

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
        shipboost_dr: shipboostDr,
      });

      await prisma.outreachDraft.create({
        data: {
          contactId: contact.id, templateKey: tmpl.key,
          subject: rendered.subject, body: rendered.bodyHtml, bodyText: rendered.bodyText,
        },
      });
      result.draftsCreated++;
      result.bySource[sourceAdapter.kind]++;
    }
  }

  return result;
}
