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

const COLUMNS: { key: Bucket; title: string; sub?: string; tint: string }[] = [
  { key: "pending", title: "Pending Review", sub: "awaiting send", tint: "bg-zinc-800" },
  { key: "sent", title: "Sent", sub: "no activity yet", tint: "bg-blue-900" },
  { key: "opened", title: "Opened", sub: "no reply yet", tint: "bg-sky-900" },
  { key: "awaiting_followup", title: "Awaiting Follow-up", sub: "sent > 5d", tint: "bg-amber-900" },
  { key: "followed_up", title: "Followed Up", sub: "no reply", tint: "bg-violet-900" },
  { key: "replied", title: "Replied", sub: "wins", tint: "bg-emerald-900" },
];

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

export function DashboardClient({ cards }: { cards: Card[] }) {
  const [showArchive, setShowArchive] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const buckets = useMemo(() => {
    const m: Record<Bucket, Card[]> = {
      pending: [], sent: [], opened: [], awaiting_followup: [], followed_up: [], replied: [], archive: [],
    };
    for (const c of cards) m[c.bucket].push(c);
    return m;
  }, [cards]);

  const skip = async (id: string) => {
    setBusyId(id);
    await fetch(`/api/drafts/${id}/skip`, { method: "POST" });
    setBusyId(null);
    location.reload();
  };

  return (
    <main className="min-h-screen p-4 space-y-4">
      <header className="flex items-baseline justify-between">
        <h1 className="text-lg font-medium">Outreach pipeline</h1>
        <nav className="text-sm text-zinc-500 space-x-4">
          <a href="/inbox" className="hover:text-zinc-300 underline">go to inbox</a>
          <span className="text-zinc-700">{cards.length} total</span>
        </nav>
      </header>

      <div className="grid grid-cols-6 gap-3 overflow-x-auto pb-4">
        {COLUMNS.map((col) => (
          <section key={col.key} className="min-w-[220px]">
            <div className={`flex items-baseline justify-between rounded-t px-3 py-2 ${col.tint}`}>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide">{col.title}</div>
                {col.sub && <div className="text-[10px] text-zinc-400">{col.sub}</div>}
              </div>
              <div className="text-xs text-zinc-300 font-medium">{buckets[col.key].length}</div>
            </div>
            <div className="space-y-2 p-2 bg-zinc-950 rounded-b min-h-[200px] border-x border-b border-zinc-900">
              {buckets[col.key].map((c) => (
                <CardView key={c.id} card={c} busy={busyId === c.id} onSkip={() => skip(c.id)} />
              ))}
              {buckets[col.key].length === 0 && (
                <div className="text-[11px] text-zinc-700 italic px-1 py-2">empty</div>
              )}
            </div>
          </section>
        ))}
      </div>

      <section className="border-t border-zinc-900 pt-3">
        <button
          onClick={() => setShowArchive((v) => !v)}
          className="text-xs text-zinc-500 hover:text-zinc-300"
        >
          {showArchive ? "▾ Hide" : "▸ Show"} archive ({buckets.archive.length})
        </button>
        {showArchive && (
          <div className="grid grid-cols-6 gap-2 mt-2">
            {buckets.archive.map((c) => (
              <div key={c.id} className="bg-zinc-950 rounded p-2 opacity-60">
                <div className="text-xs truncate">{c.launch.name}</div>
                <div className="text-[10px] text-zinc-600 truncate">{c.contact.email}</div>
                <div className="text-[10px] text-zinc-700 uppercase">{c.status}</div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function CardView({ card, busy, onSkip }: { card: Card; busy: boolean; onSkip: () => void }) {
  const stamp = (() => {
    if (card.bucket === "pending") return `drafted ${timeAgo(card.createdAt)}`;
    if (card.bucket === "sent" || card.bucket === "opened" || card.bucket === "awaiting_followup") return `sent ${timeAgo(card.sentAt)}`;
    if (card.bucket === "followed_up") return `follow-up ${timeAgo(card.sentAt)}`;
    if (card.bucket === "replied") return `replied`;
    return "";
  })();

  return (
    <article className="bg-zinc-900 rounded p-2.5 space-y-1.5 border border-zinc-800 hover:border-zinc-700 transition">
      <div className="text-sm font-medium truncate">{card.launch.name}</div>
      {card.launch.tagline && (
        <div className="text-[11px] text-zinc-500 line-clamp-2">{card.launch.tagline}</div>
      )}
      <div className="text-[11px] text-zinc-400 truncate">{card.contact.email}</div>
      <div className="flex items-center justify-between gap-2 pt-1 text-[10px] text-zinc-500">
        <span>{stamp}</span>
        <span className="flex items-center gap-2">
          {card.openCount > 0 && (
            <span className="text-sky-400">{card.openCount} open{card.openCount > 1 ? "s" : ""}</span>
          )}
          {card.source.url ? (
            <a
              href={card.source.url}
              target="_blank"
              rel="noreferrer"
              className="text-zinc-500 hover:text-zinc-300 underline"
              onClick={(e) => e.stopPropagation()}
            >
              {card.source.label}
            </a>
          ) : (
            <span className="text-zinc-600">{card.source.label}</span>
          )}
        </span>
      </div>
      {card.bucket === "pending" ? (
        <div className="flex gap-1.5 pt-1">
          <a
            href={`/inbox`}
            className="flex-1 text-center text-[11px] py-1 bg-zinc-100 text-zinc-900 rounded hover:bg-white"
          >
            Open in inbox
          </a>
          <button
            onClick={onSkip}
            disabled={busy}
            className="text-[11px] px-2 py-1 bg-zinc-800 rounded disabled:opacity-50"
          >
            Skip
          </button>
        </div>
      ) : null}
    </article>
  );
}
