"use client";

import { useEffect, useMemo, useState } from "react";
import type { CompanyFinancials } from "@/lib/research/edgar";
import { companyOperatingMetrics } from "@/lib/research/valuation/metrics";
import {
  runTradingRange,
  type TradingRangeResult,
} from "@/lib/research/valuation/trading-range";
import ExpandableModel from "./ExpandableModel";
import { fmtMoney, fmtMult, fmtPerShare, fmtPct, fmtRange } from "./fmt";

export default function TradingRangePanel({
  fin,
  marketPrice,
  onRange,
}: {
  fin: CompanyFinancials;
  marketPrice: number | null;
  onRange?: (r: { low: number | null; mid: number | null; high: number | null }) => void;
}) {
  const metrics = useMemo(() => companyOperatingMetrics(fin), [fin]);
  const [result, setResult] = useState<TradingRangeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const res = await fetch(
          `/api/research/prices/${encodeURIComponent(fin.ticker)}?range=1y`
        );
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Price data unavailable");
        if (cancelled) return;
        const points = (json.points ?? []) as { t: number; c: number }[];
        // Prefer live market price when parent has a fresher quote.
        if (
          marketPrice != null &&
          marketPrice > 0 &&
          points.length > 0
        ) {
          const last = points[points.length - 1];
          if (last) points[points.length - 1] = { ...last, c: marketPrice };
        }
        const tr = runTradingRange({
          points,
          shares: metrics.shares,
          netDebt: metrics.netDebt,
          netIncome: metrics.netIncome,
          ebitda: metrics.ebitda,
          revenue: metrics.revenue,
        });
        setResult(tr);
        onRange?.(tr.range);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load prices");
          setResult(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fin.ticker, marketPrice, metrics, onRange]);

  const summary = result
    ? fmtRange(result.range)
    : loading
      ? "Loading…"
      : "—";

  return (
    <ExpandableModel
      title="52-week trading range"
      subtitle="Market-based valuation band from the last year of prices, mapped to equity/EV and implied multiples."
      summary={summary}
      defaultOpen={false}
    >
      {loading && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Loading price history…
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
      {result && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Tile label="52w low" value={fmtPerShare(result.low52)} />
            <Tile label="52w mid" value={fmtPerShare(result.mid52)} />
            <Tile label="52w high" value={fmtPerShare(result.high52)} />
            <Tile label="Current" value={fmtPerShare(result.current)} />
          </div>

          {/* Visual position in range */}
          {result.low52 != null &&
            result.high52 != null &&
            result.current != null &&
            result.high52 > result.low52 && (
              <div>
                <p className="mb-1.5 text-xs font-medium text-zinc-500">
                  Position in range ·{" "}
                  {fmtPct(result.positionInRange)} from low ·{" "}
                  {fmtPct(result.pctFromHigh)} from high
                </p>
                <div className="relative h-3 rounded-full bg-zinc-200 dark:bg-zinc-800">
                  <div
                    className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-sky-600 shadow dark:border-zinc-950"
                    style={{
                      left: `${Math.min(
                        100,
                        Math.max(0, (result.positionInRange ?? 0) * 100)
                      )}%`,
                    }}
                  />
                </div>
              </div>
            )}

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
              <p className="text-xs font-semibold">Equity / EV at range</p>
              <ul className="mt-2 space-y-1 text-xs text-zinc-600 dark:text-zinc-400">
                <li className="flex justify-between font-mono">
                  <span>Equity @ low</span>
                  <span>{fmtMoney(result.equityAtLow)}</span>
                </li>
                <li className="flex justify-between font-mono">
                  <span>Equity @ high</span>
                  <span>{fmtMoney(result.equityAtHigh)}</span>
                </li>
                <li className="flex justify-between font-mono">
                  <span>EV @ low</span>
                  <span>{fmtMoney(result.evAtLow)}</span>
                </li>
                <li className="flex justify-between font-mono">
                  <span>EV @ high</span>
                  <span>{fmtMoney(result.evAtHigh)}</span>
                </li>
              </ul>
            </div>
            <div className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
              <p className="text-xs font-semibold">Implied multiples @ extremes</p>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="text-zinc-500">At high</p>
                  <p className="font-mono">P/E {fmtMult(result.multiplesAtHigh.pe)}</p>
                  <p className="font-mono">
                    EV/EBITDA {fmtMult(result.multiplesAtHigh.evEbitda)}
                  </p>
                  <p className="font-mono">
                    EV/Sales {fmtMult(result.multiplesAtHigh.evSales)}
                  </p>
                </div>
                <div>
                  <p className="text-zinc-500">At low</p>
                  <p className="font-mono">P/E {fmtMult(result.multiplesAtLow.pe)}</p>
                  <p className="font-mono">
                    EV/EBITDA {fmtMult(result.multiplesAtLow.evEbitda)}
                  </p>
                  <p className="font-mono">
                    EV/Sales {fmtMult(result.multiplesAtLow.evSales)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
            Window ≈ {result.windowDays} days of history. Multiples use latest
            annual fundamentals × price levels — not forward estimates.
          </p>
          {result.notes.map((n) => (
            <p key={n} className="text-[11px] text-zinc-500 dark:text-zinc-400">
              {n}
            </p>
          ))}
        </div>
      )}
    </ExpandableModel>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50/60 p-3 dark:border-zinc-800 dark:bg-zinc-900/40">
      <p className="text-[11px] font-medium uppercase text-zinc-500">{label}</p>
      <p className="mt-1 font-mono text-sm font-semibold tabular-nums">{value}</p>
    </div>
  );
}
