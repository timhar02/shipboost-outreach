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

export function InboxClient({ drafts: initial, sentToday }: { drafts: DraftView[]; sentToday: number }) {
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
    else alert(`Send failed: ${await res.text()}`);
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
    <main className="grid grid-cols-[320px_1fr] h-screen">
      <aside className="border-r border-zinc-800 overflow-y-auto">
        <div className="p-3 text-xs text-zinc-500 border-b border-zinc-800 flex items-center justify-between">
          <span>{drafts.length} pending · sent today: {sentToday}/30</span>
          <a href="/dashboard" className="text-zinc-400 hover:text-zinc-200 underline">pipeline</a>
        </div>
        {drafts.map((d) => (
          <button
            key={d.id}
            onClick={() => { setActiveId(d.id); setEditing(false); }}
            className={`w-full text-left p-3 border-b border-zinc-900 hover:bg-zinc-900 ${d.id === activeId ? "bg-zinc-900" : ""}`}
          >
            <div className="font-medium truncate">{d.launch.name}</div>
            <div className="text-xs text-zinc-500 truncate">{d.contact.email}</div>
            <div className="text-xs text-zinc-600 truncate">{d.subject}</div>
          </button>
        ))}
      </aside>
      <section className="overflow-y-auto p-6">
        {!active ? (
          <div className="text-zinc-500">Inbox zero.</div>
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
    <div className="max-w-2xl space-y-4">
      <header className="flex items-baseline justify-between">
        <div>
          <h1 className="text-lg font-medium">{draft.launch.name}</h1>
          <p className="text-sm text-zinc-500">{draft.launch.tagline}</p>
          <p className="text-xs text-zinc-600 mt-1">
            <a href={draft.launch.url} target="_blank" rel="noreferrer" className="underline">{draft.launch.url}</a>
          </p>
          <p className="text-xs text-zinc-600 mt-1">
            found via {draft.source.url ? (
              <a href={draft.source.url} target="_blank" rel="noreferrer" className="text-zinc-400 hover:text-zinc-200 underline">
                {draft.source.label}
              </a>
            ) : (
              <span className="text-zinc-500">{draft.source.label}</span>
            )}
          </p>
        </div>
        <div className="text-right">
          <div className="text-sm">{draft.contact.email}</div>
          {draft.contact.name && <div className="text-xs text-zinc-500">{draft.contact.name}</div>}
          <div className="text-xs text-zinc-600">via {draft.contact.discoveredFrom.toLowerCase()}</div>
          <div className="text-xs text-zinc-700 mt-1">tmpl: {draft.templateKey}</div>
        </div>
      </header>
      <div className="rounded border border-zinc-800 p-4 space-y-3 bg-zinc-950">
        {editing ? (
          <>
            <input value={subject} onChange={(e) => setSubject(e.target.value)}
              className="w-full px-2 py-1 bg-zinc-900 border border-zinc-800 rounded" />
            <textarea value={bodyHtml} onChange={(e) => setBodyHtml(e.target.value)}
              rows={14}
              className="w-full px-2 py-1 bg-zinc-900 border border-zinc-800 rounded font-mono text-sm" />
            <div className="flex gap-2">
              <button onClick={save} className="px-3 py-1.5 bg-zinc-100 text-zinc-900 rounded">Save</button>
              <button onClick={() => setEditing(false)} className="px-3 py-1.5 bg-zinc-800 rounded">Cancel</button>
            </div>
          </>
        ) : (
          <>
            <div className="font-medium">{draft.subject}</div>
            <iframe
              title="email preview"
              sandbox=""
              srcDoc={iframeDoc}
              className="w-full h-80 bg-white rounded"
            />
            <div className="flex gap-2 pt-2">
              <button onClick={onSend} disabled={busy} className="px-3 py-1.5 bg-zinc-100 text-zinc-900 rounded disabled:opacity-50">Send (s)</button>
              <button onClick={() => setEditing(true)} className="px-3 py-1.5 bg-zinc-800 rounded">Edit (e)</button>
              <button onClick={onSkip} disabled={busy} className="px-3 py-1.5 bg-zinc-800 rounded">Skip (x)</button>
            </div>
            <div className="text-xs text-zinc-600">j/k navigate · e edit · s send · x skip</div>
          </>
        )}
      </div>
    </div>
  );
}
