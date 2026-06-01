"use client";
import { useMemo, useState } from "react";

export type Bucket =
  | "pending"
  | "sent"
  | "opened"
  | "awaiting_followup"
  | "followed_up"
  | "replied"
  | "archive";

export type Card = {
  id: string;
  bucket: Bucket;
  subject: string;
  templateKey: string;
  status: string;
  sentAt: string | null;
  createdAt: string;
  openCount: number;
  lastOpenAt: string | null;
  hasFollowUp: boolean;
  hasReply: boolean;
  contact: { email: string; name: string | null; domain: string };
  launch: { name: string; tagline: string | null; url: string };
  source: { kind: string; label: string; url: string | null };
};

const COLUMNS: {
  key: Bucket;
  title: string;
  sub: string;
  accent: string;
  rail: string;
  header: string;
}[] = [
  {
    key: "pending",
    title: "Pending",
    sub: "review and send",
    accent: "text-lime-300",
    rail: "border-lime-300",
    header: "from-lime-300/12",
  },
  {
    key: "sent",
    title: "Sent",
    sub: "waiting for signal",
    accent: "text-blue-300",
    rail: "border-blue-300",
    header: "from-blue-300/12",
  },
  {
    key: "opened",
    title: "Opened",
    sub: "interest, no reply",
    accent: "text-cyan-300",
    rail: "border-cyan-300",
    header: "from-cyan-300/12",
  },
  {
    key: "awaiting_followup",
    title: "Due",
    sub: "follow-up needed",
    accent: "text-amber-300",
    rail: "border-amber-300",
    header: "from-amber-300/12",
  },
  {
    key: "followed_up",
    title: "Followed",
    sub: "second touch sent",
    accent: "text-fuchsia-300",
    rail: "border-fuchsia-300",
    header: "from-fuchsia-300/12",
  },
  {
    key: "replied",
    title: "Replied",
    sub: "active outcomes",
    accent: "text-emerald-300",
    rail: "border-emerald-300",
    header: "from-emerald-300/12",
  },
];

const BUCKET_LABEL: Record<Bucket, string> = {
  pending: "pending",
  sent: "sent",
  opened: "opened",
  awaiting_followup: "due",
  followed_up: "followed",
  replied: "replied",
  archive: "archive",
};

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function count(cards: Card[], bucket: Bucket): number {
  return cards.filter((card) => card.bucket === bucket).length;
}

export function DashboardClient({ cards }: { cards: Card[] }) {
  const [showArchive, setShowArchive] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const filteredCards = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return cards;
    return cards.filter((c) => {
      const searchable = [
        c.launch.name,
        c.launch.url,
        c.contact.domain,
        c.contact.email,
        c.contact.name ?? "",
      ].join(" ").toLowerCase();
      return searchable.includes(q);
    });
  }, [cards, query]);

  const buckets = useMemo(() => {
    const m: Record<Bucket, Card[]> = {
      pending: [], sent: [], opened: [], awaiting_followup: [], followed_up: [], replied: [], archive: [],
    };
    for (const c of filteredCards) m[c.bucket].push(c);
    return m;
  }, [filteredCards]);

  const totals = useMemo(() => {
    const total = filteredCards.length;
    const visibleActive = COLUMNS.reduce((sum, col) => sum + count(filteredCards, col.key), 0);
    const opened = count(filteredCards, "opened");
    const replied = count(filteredCards, "replied");
    const due = count(filteredCards, "awaiting_followup");
    const replyRate = cards.length ? Math.round((count(cards, "replied") / cards.length) * 100) : 0;

    return {
      total,
      visibleActive,
      pending: count(filteredCards, "pending"),
      sent: count(filteredCards, "sent"),
      opened,
      due,
      followed: count(filteredCards, "followed_up"),
      replied,
      archive: count(filteredCards, "archive"),
      opens: filteredCards.reduce((sum, card) => sum + card.openCount, 0),
      replyRate,
    };
  }, [cards, filteredCards]);

  const skip = async (id: string) => {
    setBusyId(id);
    await fetch(`/api/drafts/${id}/skip`, { method: "POST" });
    setBusyId(null);
    location.reload();
  };

  return (
    <main className="ops-grid-bg min-h-screen overflow-hidden text-zinc-100">
      <div className="pointer-events-none fixed inset-0 ops-grid-bg" />
      <div className="relative mx-auto flex min-h-screen max-w-[1800px] flex-col gap-5 p-4 sm:p-5 lg:p-6">
        <header className="ops-panel rounded-lg">
          <div className="flex flex-col gap-5 border-b border-zinc-800/80 p-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="ops-kicker">
                ShipBoost Outreach
              </div>
              <h1 className="mt-2 text-2xl font-black tracking-tight text-zinc-50 sm:text-3xl">
                Pipeline Control
              </h1>
              <p className="mt-1 max-w-2xl text-sm text-zinc-500">
                Review drafts, watch engagement, and keep follow-ups moving.
              </p>
            </div>
            <nav className="flex flex-wrap items-center gap-2 text-xs font-semibold">
              <a
                href="/dashboard/conversions"
                className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-300 transition hover:border-lime-300/70 hover:text-lime-200"
              >
                Attribution
              </a>
              <a
                href="/inbox"
                className="rounded-md bg-lime-300 px-3 py-2 text-zinc-950 transition hover:bg-lime-200"
              >
                Open Inbox
              </a>
              <span className="rounded-md border border-zinc-800 px-3 py-2 text-zinc-500">
                {cards.length} total records
              </span>
            </nav>
          </div>

          <div className="grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
            <Stat label="Active" value={totals.visibleActive} sub={`${totals.archive} archived`} tone="lime" />
            <Stat label="Pending" value={totals.pending} sub="needs review" tone="lime" />
            <Stat label="Sent" value={totals.sent} sub="quiet" tone="blue" />
            <Stat label="Opened" value={totals.opened} sub={`${totals.opens} total opens`} tone="cyan" />
            <Stat label="Due" value={totals.due} sub="follow-up queue" tone="amber" />
            <Stat label="Followed" value={totals.followed} sub="second touch" tone="fuchsia" />
            <Stat label="Replied" value={totals.replied} sub={`${totals.replyRate}% all-time`} tone="emerald" />
            <Stat label="Showing" value={totals.total} sub={query.trim() ? "filtered" : "unfiltered"} tone="zinc" />
          </div>
        </header>

        <section className="flex flex-col gap-3 border-y border-zinc-800/80 bg-[#0b0d0c]/80 py-3 sm:flex-row sm:items-center sm:justify-between">
          <label className="relative block w-full sm:max-w-xl">
            <span className="sr-only">Search products</span>
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold uppercase tracking-widest text-zinc-600">
              Find
            </span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Product, domain, URL, email"
              className="h-11 w-full rounded-md border border-zinc-800 bg-[#101410] pl-16 pr-3 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-lime-300/70 focus:bg-[#121812]"
            />
          </label>
          <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
            {query.trim() ? (
              <>
                <span className="rounded border border-zinc-800 px-2.5 py-1.5">
                  {filteredCards.length} match{filteredCards.length === 1 ? "" : "es"}
                </span>
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="rounded border border-zinc-800 px-2.5 py-1.5 text-zinc-400 transition hover:border-zinc-600 hover:text-zinc-100"
                >
                  Clear search
                </button>
              </>
            ) : (
              <span className="rounded border border-zinc-800 px-2.5 py-1.5">
                Search scans product, domain, URL, email, and contact name.
              </span>
            )}
          </div>
        </section>

        <div className="grid flex-1 grid-cols-6 gap-3 overflow-x-auto pb-4">
        {COLUMNS.map((col) => (
          <section key={col.key} className="min-w-[245px]">
            <div className={`rounded-t-lg border border-b-0 border-zinc-800 bg-gradient-to-r ${col.header} to-[#101410] px-3 py-3`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className={`text-[11px] font-black uppercase tracking-[0.18em] ${col.accent}`}>
                    {col.title}
                  </div>
                  <div className="mt-0.5 text-[11px] text-zinc-500">{col.sub}</div>
                </div>
                <div className="rounded bg-black/40 px-2 py-1 text-xs font-black text-zinc-200">
                  {buckets[col.key].length}
                </div>
              </div>
            </div>
            <div className="min-h-[420px] space-y-2 rounded-b-lg border-x border-b border-zinc-800 bg-[#0c0f0d]/95 p-2">
              {buckets[col.key].map((c) => (
                <CardView
                  key={c.id}
                  card={c}
                  busy={busyId === c.id}
                  onSkip={() => skip(c.id)}
                  rail={col.rail}
                />
              ))}
              {buckets[col.key].length === 0 && (
                <div className="rounded-md border border-dashed border-zinc-800 px-3 py-8 text-center text-[11px] uppercase tracking-widest text-zinc-700">
                  Empty
                </div>
              )}
            </div>
          </section>
        ))}
        </div>

        <section className="border-t border-zinc-800/80 pt-3">
          <button
            onClick={() => setShowArchive((v) => !v)}
            className="rounded-md border border-zinc-800 px-3 py-2 text-xs font-semibold uppercase tracking-widest text-zinc-500 transition hover:border-zinc-600 hover:text-zinc-200"
          >
            {showArchive ? "Hide" : "Show"} archive ({buckets.archive.length})
          </button>
          {showArchive && (
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
              {buckets.archive.map((c) => (
                <div key={c.id} className="rounded-md border border-zinc-900 bg-zinc-950/60 p-3 opacity-70">
                  <div className="truncate text-xs font-semibold">{c.launch.name}</div>
                  <div className="mt-1 truncate text-[11px] text-zinc-600">{c.contact.email}</div>
                  <div className="mt-2 text-[10px] font-bold uppercase tracking-widest text-zinc-700">
                    {c.status}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: number;
  sub: string;
  tone: "lime" | "blue" | "cyan" | "amber" | "fuchsia" | "emerald" | "zinc";
}) {
  const toneClass = {
    lime: "text-lime-300 border-lime-300/25",
    blue: "text-blue-300 border-blue-300/25",
    cyan: "text-cyan-300 border-cyan-300/25",
    amber: "text-amber-300 border-amber-300/25",
    fuchsia: "text-fuchsia-300 border-fuchsia-300/25",
    emerald: "text-emerald-300 border-emerald-300/25",
    zinc: "text-zinc-200 border-zinc-700",
  }[tone];

  return (
    <div className={`rounded-md border bg-[#101410] p-3 ${toneClass}`}>
      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600">{label}</div>
      <div className="mt-2 text-2xl font-black leading-none text-current">{value}</div>
      <div className="mt-2 truncate text-[11px] text-zinc-500">{sub}</div>
    </div>
  );
}

function CardView({
  card,
  busy,
  onSkip,
  rail,
}: {
  card: Card;
  busy: boolean;
  onSkip: () => void;
  rail: string;
}) {
  const stamp = (() => {
    if (card.bucket === "pending") return `drafted ${timeAgo(card.createdAt)}`;
    if (card.bucket === "sent" || card.bucket === "opened" || card.bucket === "awaiting_followup") return `sent ${timeAgo(card.sentAt)}`;
    if (card.bucket === "followed_up") return `follow-up ${timeAgo(card.sentAt)}`;
    if (card.bucket === "replied") return `replied`;
    return "";
  })();

  return (
    <article className={`rounded-md border border-zinc-800 bg-[#151914] p-3 shadow-lg shadow-black/10 transition hover:-translate-y-0.5 hover:border-zinc-600 ${rail} border-l-4`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-bold text-zinc-100">{card.launch.name}</div>
          <div className="mt-0.5 truncate text-[11px] text-zinc-500">{card.contact.domain}</div>
        </div>
        <span className="shrink-0 rounded bg-black/30 px-1.5 py-1 text-[9px] font-black uppercase tracking-widest text-zinc-500">
          {BUCKET_LABEL[card.bucket]}
        </span>
      </div>
      {card.launch.tagline && (
        <div className="mt-2 line-clamp-2 text-[11px] leading-4 text-zinc-500">{card.launch.tagline}</div>
      )}
      <div className="mt-2 truncate border-t border-zinc-800 pt-2 text-[11px] text-zinc-300">
        {card.contact.email}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-zinc-500">
        <span>{stamp}</span>
        <span className="flex min-w-0 items-center gap-2">
          {card.openCount > 0 && (
            <span className="shrink-0 text-cyan-300">{card.openCount} open{card.openCount > 1 ? "s" : ""}</span>
          )}
          {card.source.url ? (
            <a
              href={card.source.url}
              target="_blank"
              rel="noreferrer"
              className="block max-w-16 overflow-hidden text-ellipsis whitespace-nowrap text-zinc-500 underline underline-offset-2 hover:text-zinc-300"
              onClick={(e) => e.stopPropagation()}
            >
              {card.source.label}
            </a>
          ) : (
            <span className="block max-w-16 overflow-hidden text-ellipsis whitespace-nowrap text-zinc-600">{card.source.label}</span>
          )}
        </span>
      </div>
      {card.bucket === "pending" ? (
        <div className="mt-3 flex gap-1.5">
          <a
            href={`/inbox`}
            className="flex-1 rounded bg-lime-300 py-1.5 text-center text-[11px] font-black text-zinc-950 transition hover:bg-lime-200"
          >
            Open in inbox
          </a>
          <button
            onClick={onSkip}
            disabled={busy}
            className="rounded border border-zinc-700 px-2 py-1.5 text-[11px] font-semibold text-zinc-400 transition hover:border-zinc-500 hover:text-zinc-100 disabled:opacity-50"
          >
            Skip
          </button>
        </div>
      ) : null}
    </article>
  );
}
