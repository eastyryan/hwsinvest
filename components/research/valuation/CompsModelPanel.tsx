"use client";

import { useEffect, useState } from "react";
import type { CompMultipleKey, CompsResult } from "@/lib/research/valuation/comps";
import ExpandableModel from "./ExpandableModel";
import { fmtMult, fmtPerShare, fmtRange } from "./fmt";

type CompsApi = CompsResult & { peerSource?: string };

const MULT_LABELS: Record<CompMultipleKey, string> = {
  evEbitda: "EV / EBITDA",
  evEbit: "EV / EBIT",
  evSales: "EV / Sales",
  pe: "P / E",
  ps: "P / S",
};

function periodCell(basis?: string, periodEnd?: string): string {
  if (basis && periodEnd) return `${basis.toUpperCase()} ${periodEnd}`;
  if (basis) return basis.toUpperCase();
  if (periodEnd) return periodEnd;
  return "—";
}

export default function CompsModelPanel({
  ticker,
  cik,
  sector,
  industry,
  marketCap,
  onRange,
}: {
  ticker: string;
  cik: string;
  sector: string | null;
  industry: string | null;
  marketCap: number | null;
  onRange?: (r: { low: number | null; mid: number | null; high: number | null }) => void;
}) {
  const [data, setData] = useState<CompsApi | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  async function load() {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ cik });
      if (sector) qs.set("sector", sector);
      if (industry) qs.set("industry", industry);
      if (marketCap != null && marketCap > 0) qs.set("marketCap", String(marketCap));
      const res = await fetch(
        `/api/research/valuation/comps/${encodeURIComponent(ticker)}?${qs}`
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load comps");
      setData(json as CompsApi);
      onRange?.(json.range);
      setLoaded(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load comps");
    } finally {
      setLoading(false);
    }
  }

  // Lazy: only fetch when first expanded (handled by ExpandableModel children mount)
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once on mount (panel mounts when expanded)
  }, [ticker, cik]);

  const summary = data ? fmtRange(data.range) : loading ? "Loading…" : undefined;
  const peerCount = data?.peers.length ?? 0;

  return (
    <ExpandableModel
      title="Trading comps"
      subtitle="Comparable company analysis — peer EV/EBITDA, EV/Sales, P/E, P/S applied to this company."
      summary={summary}
      defaultOpen={false}
    >
      {loading && !data && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Loading peer filings and prices…
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
      {data && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-4">
            {(Object.keys(MULT_LABELS) as CompMultipleKey[]).map((k) => (
              <div
                key={k}
                className="rounded-lg border border-zinc-200 bg-zinc-50/60 p-3 dark:border-zinc-800 dark:bg-zinc-900/40"
              >
                <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                  {MULT_LABELS[k]}
                </p>
                <p className="mt-1 font-mono text-sm font-semibold tabular-nums">
                  {fmtPerShare(data.implied[k].perShare)}
                </p>
                <p className="mt-0.5 font-mono text-[11px] text-zinc-500">
                  @ {fmtMult(data.implied[k].multiple)} median
                </p>
                <p className="mt-0.5 text-[11px] text-zinc-500">
                  n = {data.peerMultiples[k].values.length} of {peerCount}
                </p>
              </div>
            ))}
          </div>

          <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 text-xs font-medium text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/70">
                  <th className="px-3 py-2 text-left">Company</th>
                  <th className="px-3 py-2 text-left">Period</th>
                  <th className="px-3 py-2 text-right">EV/EBITDA</th>
                  <th className="px-3 py-2 text-right">EV/Sales</th>
                  <th className="px-3 py-2 text-right">P/E</th>
                  <th className="px-3 py-2 text-right">P/S</th>
                </tr>
              </thead>
              <tbody>
                {[data.subject, ...data.peers].map((row) => {
                  const isSub =
                    row.ticker.toUpperCase() === ticker.toUpperCase();
                  return (
                    <tr
                      key={row.ticker}
                      className={`border-b border-zinc-100 last:border-0 dark:border-zinc-800/60 ${
                        isSub ? "bg-sky-50/50 dark:bg-sky-950/20" : ""
                      }`}
                    >
                      <td className="px-3 py-2">
                        <span className="font-mono text-xs font-bold">
                          {row.ticker}
                        </span>
                        {isSub && (
                          <span className="ml-1.5 text-[10px] font-medium uppercase text-sky-700 dark:text-sky-300">
                            subject
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 font-mono text-[11px] tabular-nums text-zinc-500">
                        {periodCell(row.basis, row.periodEnd)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-xs tabular-nums">
                        {fmtMult(row.multiples.evEbitda)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-xs tabular-nums">
                        {fmtMult(row.multiples.evSales)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-xs tabular-nums">
                        {fmtMult(row.multiples.pe)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-xs tabular-nums">
                        {fmtMult(row.multiples.ps)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="text-[11px] leading-snug text-zinc-500 dark:text-zinc-400">
            Curated liquid US names (not a complete universe). Multiples use TTM
            when four quarters exist. Implied values apply peer median multiples
            to the subject. EV methods bridge via net debt. Range:{" "}
            <span className="font-mono">{fmtRange(data.range)}</span>
            {loaded ? "" : ""}.
          </p>
          {data.notes.length > 0 && (
            <ul className="list-inside list-disc text-[11px] text-zinc-500 dark:text-zinc-400">
              {data.notes.slice(0, 8).map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          )}
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="text-xs font-medium text-zinc-600 underline-offset-2 hover:underline dark:text-zinc-300"
          >
            {loading ? "Refreshing…" : "Refresh peers"}
          </button>
        </div>
      )}
    </ExpandableModel>
  );
}
