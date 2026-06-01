"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

import type { ConversionStats } from "@/lib/analytics/conversion-stats";

export type PossibleMatch = {
  id: string;
  type: "PREMIUM_LAUNCH" | "AD";
  productName: string;
  websiteDomain: string;
  amountCents: number;
  paidAt: string;
  confidence: number;
  contactName: string | null;
  contactDomain: string | null;
  templateKey: string | null;
};

const TYPE_LABEL: Record<"PREMIUM_LAUNCH" | "AD", string> = {
  PREMIUM_LAUNCH: "Premium Launch",
  AD: "Ads",
};

function money(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

function StatCard({
  label,
  value,
  sub,
  tone = "zinc",
}: {
  label: string;
  value: string | number;
  sub: ReactNode;
  tone?: "lime" | "emerald" | "amber" | "zinc";
}) {
  const toneClass = {
    lime: "border-lime-300/25 text-lime-300",
    emerald: "border-emerald-300/25 text-emerald-300",
    amber: "border-amber-300/25 text-amber-300",
    zinc: "border-zinc-700 text-zinc-100",
  }[tone];

  return (
    <div className={`ops-card rounded-md p-4 ${toneClass}`}>
      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600">
        {label}
      </div>
      <div className="mt-2 text-3xl font-black leading-none text-current">{value}</div>
      <div className="mt-3 space-y-0.5 text-xs text-zinc-400">{sub}</div>
    </div>
  );
}

export function ConversionsClient({
  stats,
  possibleMatches,
  totalConversions,
  lastRunAt,
}: {
  stats: ConversionStats;
  possibleMatches: PossibleMatch[];
  totalConversions: number;
  lastRunAt: string | null;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [resolved, setResolved] = useState<Set<string>>(new Set());

  async function review(id: string, decision: "confirm" | "reject") {
    setPending((p) => ({ ...p, [id]: true }));
    try {
      const res = await fetch(`/api/conversions/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      if (!res.ok) throw new Error("Failed");
      setResolved((s) => new Set(s).add(id));
      router.refresh();
    } finally {
      setPending((p) => ({ ...p, [id]: false }));
    }
  }

  const queue = possibleMatches.filter((m) => !resolved.has(m.id));

  return (
    <main className="ops-grid-bg min-h-screen text-zinc-100">
      <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-5 lg:p-6">
        <header className="ops-panel rounded-lg">
          <div className="flex flex-col gap-5 border-b border-zinc-800/80 p-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="ops-kicker">ShipBoost Outreach</div>
              <h1 className="mt-2 text-2xl font-black tracking-tight text-zinc-50 sm:text-3xl">
                Attribution Control
              </h1>
              <p className="mt-1 max-w-2xl text-sm text-zinc-500">
                Reconcile outreach activity with paid launches and ad revenue.
              </p>
            </div>
            <nav className="flex flex-wrap items-center gap-2 text-xs font-semibold">
              <a
                href="/dashboard"
                className="rounded-md bg-lime-300 px-3 py-2 text-zinc-950 transition hover:bg-lime-200"
              >
                Pipeline
              </a>
              <a
                href="/inbox"
                className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-300 transition hover:border-lime-300/70 hover:text-lime-200"
              >
                Inbox
              </a>
              <span className="rounded-md border border-zinc-800 px-3 py-2 text-zinc-500">
                {totalConversions} conversions
              </span>
              {lastRunAt && (
                <span className="rounded-md border border-zinc-800 px-3 py-2 text-zinc-500">
                  Synced {new Date(lastRunAt).toLocaleString("en-US")}
                </span>
              )}
            </nav>
          </div>
        </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.split.map((row) => (
          <StatCard
            key={row.type}
            label={TYPE_LABEL[row.type]}
            value={row.total}
            tone={row.emailed > 0 ? "lime" : "zinc"}
            sub={(
              <>
                <div>
                  From email: <span className="font-bold text-emerald-300">{row.emailed}</span>{" "}
                  ({row.emailedPct.toFixed(0)}%)
                </div>
                <div>Organic: <span className="font-bold text-zinc-200">{row.organic}</span></div>
                {row.pendingReview > 0 && (
                  <div className="text-amber-300">Pending review: {row.pendingReview}</div>
                )}
              </>
            )}
          />
        ))}

        <StatCard
          label="Attributed revenue"
          value={money(stats.revenue.totalCents)}
          tone="emerald"
          sub={(
            <>
              <div>Premium: {money(stats.revenue.premiumCents)}</div>
              <div>Ads: {money(stats.revenue.adCents)}</div>
            </>
          )}
        />

        <StatCard
          label="Median time to convert"
          value={stats.medianDaysToConvert === null ? "-" : `${stats.medianDaysToConvert.toFixed(1)}d`}
          tone="amber"
          sub={<div>Send to purchase</div>}
        />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-black uppercase tracking-[0.18em] text-zinc-400">
          Conversion by template
        </h2>
        <div className="overflow-x-auto rounded-lg border border-zinc-800 bg-[#0c0f0d]/95">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#101410] text-[10px] uppercase tracking-widest text-zinc-500">
              <tr>
                <th className="px-3 py-2">Template</th>
                <th className="px-3 py-2 text-right">Sent</th>
                <th className="px-3 py-2 text-right">Converted</th>
                <th className="px-3 py-2 text-right">Conv. rate</th>
                <th className="px-3 py-2 text-right">Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-900">
              {stats.byTemplate.length === 0 ? (
                <tr>
                  <td className="px-3 py-4 text-zinc-600" colSpan={5}>
                    No sent emails yet.
                  </td>
                </tr>
              ) : (
                stats.byTemplate.map((row) => (
                  <tr key={row.templateKey} className="hover:bg-lime-300/5">
                    <td className="px-3 py-2 font-mono text-xs">{row.templateKey}</td>
                    <td className="px-3 py-2 text-right text-zinc-400">{row.sent}</td>
                    <td className="px-3 py-2 text-right font-bold">{row.converted}</td>
                    <td className="px-3 py-2 text-right">
                      <span className={row.conversionRate > 0 ? "text-emerald-400" : "text-zinc-600"}>
                        {row.conversionRate.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right text-zinc-300">
                      {row.revenueCents > 0 ? money(row.revenueCents) : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[11px] text-zinc-600">
          Attribution is correlation (we emailed them and they bought), matched by domain to email.
          Not click-proof.
        </p>
      </section>

      {queue.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-black uppercase tracking-[0.18em] text-amber-300">
            Possible matches ({queue.length})
          </h2>
          <div className="space-y-2">
            {queue.map((m) => (
              <div
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-300/25 bg-amber-300/5 p-3 text-sm"
              >
                <div className="min-w-0">
                  <div className="font-medium">
                    {m.productName}{" "}
                    <span className="text-zinc-600">({m.websiteDomain})</span>
                  </div>
                  <div className="text-xs text-zinc-500">
                    {TYPE_LABEL[m.type]} | {money(m.amountCents)} |{" "}
                    {new Date(m.paidAt).toLocaleDateString("en-US")} | looks like contact{" "}
                    <span className="text-zinc-300">{m.contactName ?? m.contactDomain ?? "?"}</span>{" "}
                    ({(m.confidence * 100).toFixed(0)}% name match
                    {m.templateKey ? `, ${m.templateKey}` : ", no send"})
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={pending[m.id]}
                    onClick={() => void review(m.id, "confirm")}
                    className="rounded-md bg-lime-300 px-3 py-1.5 text-xs font-black text-zinc-950 transition hover:bg-lime-200 disabled:opacity-50"
                  >
                    Confirm
                  </button>
                  <button
                    type="button"
                    disabled={pending[m.id]}
                    onClick={() => void review(m.id, "reject")}
                    className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs font-bold text-zinc-300 transition hover:border-zinc-500 hover:bg-zinc-900 disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
      </div>
    </main>
  );
}
