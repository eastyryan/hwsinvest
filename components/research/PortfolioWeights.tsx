"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  getServerWatchlistSnapshot,
  getWatchlistSnapshot,
  subscribeWatchlist,
} from "@/lib/research/watchlist";
import { summarizePortfolio, type PortfolioHolding } from "@/lib/research/portfolio";

const WEIGHTS_KEY = "watchlistWeights:v1";

type RowMetrics = {
  revYoy: number | null;
  netMargin: number | null;
  fcfMargin: number | null;
};

function loadWeights(): Record<string, number> {
  try {
    const raw = localStorage.getItem(WEIGHTS_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, number>;
  } catch {
    return {};
  }
}

function saveWeights(w: Record<string, number>) {
  try {
    localStorage.setItem(WEIGHTS_KEY, JSON.stringify(w));
  } catch {
    /* private mode */
  }
}

function fmtPct(v: number | null) {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${(v * 100).toFixed(1)}%`;
}

/**
 * Equal-weight or custom weights over the free watchlist,
 * with optional EDGAR metrics contribution when financials load.
 */
export default function PortfolioWeights() {
  const list = useSyncExternalStore(
    subscribeWatchlist,
    getWatchlistSnapshot,
    getServerWatchlistSnapshot
  );
  const [weights, setWeights] = useState<Record<string, number>>({});
  const [metrics, setMetrics] = useState<Record<string, RowMetrics>>({});
  const [loadingMetrics, setLoadingMetrics] = useState(false);

  useEffect(() => {
    setWeights(loadWeights());
  }, []);

  // Load filing metrics for watchlist (capped concurrency, free EDGAR).
  useEffect(() => {
    if (list.length === 0) {
      setMetrics({});
      return;
    }
    let cancelled = false;
    setLoadingMetrics(true);

    (async () => {
      const next: Record<string, RowMetrics> = {};
      const batch = list.slice(0, 16);
      for (const w of batch) {
        if (cancelled) return;
        try {
          let cik = w.cik;
          if (!cik) {
            const s = await fetch(
              `/api/research/search?q=${encodeURIComponent(w.ticker)}`
            );
            if (s.ok) {
              const body = (await s.json()) as {
                results?: { cik: string; ticker: string }[];
              };
              const hit = (body.results ?? []).find(
                (h) => h.ticker.toUpperCase() === w.ticker.toUpperCase()
              );
              cik = hit?.cik;
            }
          }
          if (!cik) continue;
          const res = await fetch(
            `/api/research/financials/${cik}?ticker=${encodeURIComponent(w.ticker)}`
          );
          if (!res.ok) continue;
          const fin = await res.json();
          // Prefer precomputed insights if present; else nulls.
          const revYoy =
            typeof fin?.insights?.revYoy === "number"
              ? fin.insights.revYoy
              : null;
          const netMargin =
            typeof fin?.insights?.netMargin === "number"
              ? fin.insights.netMargin
              : null;
          const fcfMargin =
            typeof fin?.insights?.fcfMargin === "number"
              ? fin.insights.fcfMargin
              : null;

          // Fallback: pull from annual lines / ratios payload if API includes them
          let ry = revYoy;
          let nm = netMargin;
          let fm = fcfMargin;
          if (ry == null || nm == null || fm == null) {
            const set = fin.annual;
            const p = set?.periods?.[0];
            if (p && set?.statements) {
              const find = (key: string) => {
                for (const st of set.statements) {
                  const l = st.lines?.find(
                    (x: { key: string }) => x.key === key
                  );
                  if (l) return l.values?.[p.key] ?? null;
                }
                return null;
              };
              const rev = find("revenue");
              const ni = find("netIncome");
              const fcf = find("fcf");
              if (nm == null && rev && ni != null && rev !== 0) nm = ni / rev;
              if (fm == null && rev && fcf != null && rev !== 0) fm = fcf / rev;
              // YoY: second period if available
              if (ry == null && set.periods?.length > 1) {
                const p1 = set.periods[1];
                let rev0 = rev;
                let rev1: number | null = null;
                for (const st of set.statements) {
                  const l = st.lines?.find(
                    (x: { key: string }) => x.key === "revenue"
                  );
                  if (l) {
                    rev0 = l.values?.[p.key] ?? rev0;
                    rev1 = l.values?.[p1.key] ?? null;
                    break;
                  }
                }
                if (
                  rev0 != null &&
                  rev1 != null &&
                  rev1 !== 0 &&
                  Number.isFinite(rev0) &&
                  Number.isFinite(rev1)
                ) {
                  ry = rev0 / rev1 - 1;
                }
              }
            }
          }

          next[w.ticker.toUpperCase()] = {
            revYoy: ry,
            netMargin: nm,
            fcfMargin: fm,
          };
        } catch {
          /* skip name */
        }
      }
      if (!cancelled) {
        setMetrics(next);
        setLoadingMetrics(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [list]);

  const holdings: PortfolioHolding[] = useMemo(
    () =>
      list.map((e) => {
        const t = e.ticker.toUpperCase();
        const m = metrics[t];
        return {
          ticker: t,
          weight:
            weights[t] ?? (list.length > 0 ? 1 / list.length : 0),
          revYoy: m?.revYoy ?? null,
          netMargin: m?.netMargin ?? null,
          fcfMargin: m?.fcfMargin ?? null,
        };
      }),
    [list, weights, metrics]
  );

  const summary = useMemo(() => summarizePortfolio(holdings), [holdings]);

  // Stay silent on the landing page until the watchlist has enough names.
  if (list.length < 2) {
    return null;
  }

  function setWeight(ticker: string, pct: string) {
    const n = Number(pct);
    const next = {
      ...weights,
      [ticker]: Number.isFinite(n) ? Math.max(0, n) / 100 : 0,
    };
    setWeights(next);
    saveWeights(next);
  }

  function equalWeight() {
    const w = 1 / list.length;
    const next: Record<string, number> = {};
    for (const e of list) next[e.ticker.toUpperCase()] = w;
    setWeights(next);
    saveWeights(next);
  }

  return (
    <div className="space-y-2 rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold">Watchlist portfolio</p>
          <p className="text-[11px] text-zinc-500">
            Weights + weighted filing metrics
            {loadingMetrics ? " · loading…" : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={equalWeight}
          className="text-[11px] font-medium text-sky-700 underline-offset-2 hover:underline dark:text-sky-300"
        >
          Equal weight
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-zinc-200 text-zinc-500 dark:border-zinc-800">
              <th className="py-1 text-left font-medium">Ticker</th>
              <th className="py-1 text-right font-medium">Weight</th>
              <th className="py-1 text-right font-medium">Rev YoY</th>
              <th className="py-1 text-right font-medium">Net mgn</th>
              <th className="py-1 text-right font-medium">FCF mgn</th>
            </tr>
          </thead>
          <tbody>
            {summary.normalized.map((h) => (
              <tr
                key={h.ticker}
                className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/60"
              >
                <td className="py-1.5">
                  <Link
                    href={`/members/research/${encodeURIComponent(h.ticker)}`}
                    className="font-mono font-bold text-sky-800 hover:underline dark:text-sky-300"
                  >
                    {h.ticker}
                  </Link>
                </td>
                <td className="py-1.5 text-right">
                  <input
                    type="number"
                    step="1"
                    value={((weights[h.ticker] ?? h.weight) * 100).toFixed(0)}
                    onChange={(e) => setWeight(h.ticker, e.target.value)}
                    className="w-14 rounded border border-zinc-300 px-1 py-0.5 text-right font-mono dark:border-zinc-700 dark:bg-zinc-900"
                  />
                  <span className="ml-0.5 text-zinc-500">%</span>
                </td>
                <td className="py-1.5 text-right font-mono tabular-nums">
                  {fmtPct(h.revYoy ?? null)}
                </td>
                <td className="py-1.5 text-right font-mono tabular-nums">
                  {fmtPct(h.netMargin ?? null)}
                </td>
                <td className="py-1.5 text-right font-mono tabular-nums">
                  {fmtPct(h.fcfMargin ?? null)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-3 gap-2 rounded-lg bg-zinc-50 px-2 py-2 dark:bg-zinc-900/50">
        <div>
          <p className="text-[10px] uppercase text-zinc-500">Wtd Rev YoY</p>
          <p className="font-mono text-xs font-medium">
            {fmtPct(summary.weightedRevYoy)}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase text-zinc-500">Wtd net mgn</p>
          <p className="font-mono text-xs font-medium">
            {fmtPct(summary.weightedNetMargin)}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase text-zinc-500">Wtd FCF mgn</p>
          <p className="font-mono text-xs font-medium">
            {fmtPct(summary.weightedFcfMargin)}
          </p>
        </div>
      </div>
      <p className="text-[11px] text-zinc-500">
        Σ weights {fmtPct(summary.weightSum)} · metrics from latest annual SEC
        filings
      </p>
    </div>
  );
}
