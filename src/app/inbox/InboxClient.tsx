"use client";
import { useState, useEffect, useCallback } from "react";

export type DraftView = {
  id: string;
  subject: string;
  bodyHtml: string;
  templateKey: string;
  contact: { email: string; name: string | null; domain: string; discoveredFrom: string };
  launch: { name: string; tagline: string | null; url: string };
  source: { kind: string; label: string; url: string | null };
};

export function InboxClient({ drafts: initial, sentToday, dailyCap }: { drafts: DraftView[]; sentToday: number; dailyCap: number }) {
  const [drafts, setDrafts] = useState(initial);
  const [activeId, setActiveId] = useState<string | null>(initial[0]?.id ?? null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const active = drafts.find((d) => d.id === activeId) ?? null;

  const remove = (id: string) => {
    setDrafts((ds) => {
      const i = ds.findIndex((d) => d.id === id);
      const next = ds.filter((d) => d.id !== id);
      setActiveId(next[Math.min(i, next.length - 1)]?.id ?? null);
      return next;
    });
  };

  const move = useCallback((delta: number) => {
    setActiveId((cur) => {
      const idx = drafts.findIndex((d) => d.id === cur);
      const next = drafts[Math.max(0, Math.min(drafts.length - 1, idx + delta))];
      return next?.id ?? cur;
    });
  }, [drafts]);

  const send = useCallback(async () => {
    if (!active || busy) return;
    setBusy(true);
    const res = await fetch(`/api/drafts/${active.id}/send`, { method: "POST" });
    setBusy(false);
    if (res.ok) remove(active.id);
    else {
      const text = await res.text();
      if (text.includes("No Gmail credential")) {
        alert("Gmail is not connected. Visit /api/gmail/authorize to connect your account.");
      } else {
        alert(`Send failed: ${text}`);
      }
    }
  }, [active, busy]);

  const skip = useCallback(async () => {
    if (!active || busy) return;
    setBusy(true);
    await fetch(`/api/drafts/${active.id}/skip`, { method: "POST" });
    setBusy(false);
    remove(active.id);
  }, [active, busy]);

  useEffect(() => {
    if (editing) return;
    const h = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && ["INPUT", "TEXTAREA"].includes(e.target.tagName)) return;
      if (e.key === "j") move(1);
      else if (e.key === "k") move(-1);
      else if (e.key === "s") send();
      else if (e.key === "x") skip();
      else if (e.key === "e") setEditing(true);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [move, send, skip, editing]);

  return (
    <main className="ops-grid-bg min-h-screen text-zinc-100">
      <div className="grid min-h-screen lg:grid-cols-[360px_1fr]">
        <aside className="border-b border-zinc-800 bg-[#0c0f0d]/95 lg:h-screen lg:border-b-0 lg:border-r lg:border-zinc-800">
          <div className="border-b border-zinc-800 p-4">
            <div className="ops-kicker">Review queue</div>
            <div className="mt-2 flex items-end justify-between gap-3">
              <div>
                <h1 className="text-2xl font-black tracking-tight text-zinc-50">Inbox Control</h1>
                <p className="mt-1 text-xs text-zinc-500">
                  {drafts.length} pending | sent today: {sentToday}/{dailyCap}
                </p>
              </div>
              <div className="rounded-md border border-lime-300/25 bg-[#101410] px-3 py-2 text-right">
                <div className="text-[10px] font-black uppercase tracking-widest text-zinc-600">Cap</div>
                <div className="text-lg font-black text-lime-300">{dailyCap - sentToday}</div>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
              <a
                href="/dashboard"
                className="rounded-md bg-lime-300 px-3 py-2 text-zinc-950 transition hover:bg-lime-200"
              >
                Pipeline
              </a>
              <a
                href="/dashboard/conversions"
                className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-300 transition hover:border-lime-300/70 hover:text-lime-200"
              >
                Attribution
              </a>
              <a
                href="/api/gmail/authorize"
                className="rounded-md border border-zinc-800 px-3 py-2 text-zinc-500 transition hover:border-zinc-600 hover:text-zinc-200"
              >
                Connect Gmail
              </a>
            </div>
          </div>
          <div className="max-h-[36vh] overflow-y-auto lg:max-h-none lg:h-[calc(100vh-177px)]">
            {drafts.map((d) => (
              <button
                key={d.id}
                onClick={() => { setActiveId(d.id); setEditing(false); }}
                className={`w-full border-b border-zinc-900 p-3 text-left transition hover:bg-lime-300/5 ${d.id === activeId ? "border-l-4 border-l-lime-300 bg-[#101410]" : "border-l-4 border-l-transparent"}`}
              >
                <div className="truncate text-sm font-bold text-zinc-100">{d.launch.name}</div>
                <div className="mt-1 truncate text-xs text-zinc-500">{d.contact.email}</div>
                <div className="mt-1 truncate text-[11px] text-zinc-600">{d.subject}</div>
              </button>
            ))}
            {drafts.length === 0 && (
              <div className="p-4 text-sm text-zinc-600">Inbox zero.</div>
            )}
          </div>
        </aside>
        <section className="min-w-0 overflow-y-auto p-4 sm:p-5 lg:h-screen lg:p-6">
          {!active ? (
            <div className="ops-panel flex min-h-[50vh] items-center justify-center rounded-lg text-zinc-500">
              Inbox zero.
            </div>
          ) : (
            <DraftPanel
              key={active.id}
              draft={active}
              editing={editing}
              setEditing={setEditing}
              onSend={send}
              onSkip={skip}
              busy={busy}
              onUpdated={(patch) => setDrafts((ds) => ds.map((d) => d.id === active.id ? { ...d, ...patch } : d))}
            />
          )}
        </section>
      </div>
    </main>
  );
}

function DraftPanel({
  draft, editing, setEditing, onSend, onSkip, busy, onUpdated,
}: {
  draft: DraftView;
  editing: boolean;
  setEditing: (b: boolean) => void;
  onSend: () => void;
  onSkip: () => void;
  busy: boolean;
  onUpdated: (patch: Partial<DraftView>) => void;
}) {
  const [subject, setSubject] = useState(draft.subject);
  const [bodyHtml, setBodyHtml] = useState(draft.bodyHtml);

  const save = async () => {
    const res = await fetch(`/api/drafts/${draft.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ subject, bodyHtml }),
    });
    if (!res.ok) { alert(await res.text()); return; }
    onUpdated({ subject, bodyHtml });
    setEditing(false);
  };

  const iframeDoc = `<!doctype html><html><head><meta charset="utf-8"><style>
    body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#111;background:#fff;font-size:14px;line-height:1.5;margin:16px}
    a{color:#1d4ed8}
  </style></head><body>${draft.bodyHtml}</body></html>`;

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <header className="ops-panel rounded-lg p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="ops-kicker">Draft review</div>
            <h1 className="mt-2 truncate text-2xl font-black tracking-tight text-zinc-50">
              {draft.launch.name}
            </h1>
            <p className="mt-1 text-sm text-zinc-500">{draft.launch.tagline}</p>
            <p className="mt-2 truncate text-xs text-zinc-600">
              <a href={draft.launch.url} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-zinc-300">{draft.launch.url}</a>
            </p>
            <p className="mt-1 text-xs text-zinc-600">
              Found via {draft.source.url ? (
                <a href={draft.source.url} target="_blank" rel="noreferrer" className="text-zinc-400 underline underline-offset-2 hover:text-zinc-200">
                  {draft.source.label}
                </a>
              ) : (
                <span className="text-zinc-500">{draft.source.label}</span>
              )}
            </p>
          </div>
          <div className="shrink-0 rounded-md border border-zinc-800 bg-[#101410] p-3 text-left lg:text-right">
            <div className="text-sm font-semibold text-zinc-200">{draft.contact.email}</div>
            {draft.contact.name && <div className="mt-1 text-xs text-zinc-500">{draft.contact.name}</div>}
            <div className="mt-1 text-xs text-zinc-600">via {draft.contact.discoveredFrom.toLowerCase()}</div>
            <div className="mt-2 text-[10px] font-black uppercase tracking-widest text-zinc-700">
              tmpl: {draft.templateKey}
            </div>
          </div>
        </div>
      </header>
      <div className="ops-panel rounded-lg p-4">
        {editing ? (
          <div className="space-y-3">
            <input value={subject} onChange={(e) => setSubject(e.target.value)}
              className="w-full rounded-md border border-zinc-800 bg-[#101410] px-3 py-2 text-sm text-zinc-100 outline-none focus:border-lime-300/70" />
            <textarea value={bodyHtml} onChange={(e) => setBodyHtml(e.target.value)}
              rows={14}
              className="w-full rounded-md border border-zinc-800 bg-[#101410] px-3 py-2 font-mono text-sm text-zinc-100 outline-none focus:border-lime-300/70" />
            <div className="flex flex-wrap gap-2">
              <button onClick={save} className="rounded-md bg-lime-300 px-3 py-1.5 text-xs font-black text-zinc-950 transition hover:bg-lime-200">Save</button>
              <button onClick={() => setEditing(false)} className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs font-bold text-zinc-300 transition hover:border-zinc-500">Cancel</button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="text-sm font-bold text-zinc-100">{draft.subject}</div>
            <iframe
              title="email preview"
              sandbox=""
              srcDoc={iframeDoc}
              className="h-[520px] w-full rounded-md bg-white"
            />
            <div className="flex flex-wrap gap-2 pt-1">
              <button onClick={onSend} disabled={busy} className="rounded-md bg-lime-300 px-3 py-1.5 text-xs font-black text-zinc-950 transition hover:bg-lime-200 disabled:opacity-50">Send (s)</button>
              <button onClick={() => setEditing(true)} className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs font-bold text-zinc-300 transition hover:border-zinc-500">Edit (e)</button>
              <button onClick={onSkip} disabled={busy} className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs font-bold text-zinc-300 transition hover:border-zinc-500 disabled:opacity-50">Skip (x)</button>
            </div>
            <div className="text-xs text-zinc-600">j/k navigate | e edit | s send | x skip</div>
          </div>
        )}
      </div>
    </div>
  );
}
