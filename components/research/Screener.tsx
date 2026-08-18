"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { btnCompact } from "./ui/buttonStyles";

type ScreenerRow = {
  ticker: string;
  name: string;
  cik: string;
  sector: string | null;
  metrics: Record<string, number | null | undefined>;
  periodLabel: string | null;
};

type ScreenerResult = {
  rows: ScreenerRow[];
  universeSize: number;
  scored: number;
  failed: number;
  asOf: string;
  notes: string[];
};

const SECTORS = [
  "Technology",
  "Healthcare",
  "Financial",
  "Consumer Cyclical",
  "Consumer Defensive",
  "Industrials",
  "Energy",
  "Utilities",
  "Basic Materials",
  "Communication Services",
  "Real Estate",
];

function fmtPct(v: number | null | undefined) {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${(v * 100).toFixed(1)}%`;
}

function fmtX(v: number | null | undefined) {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${v.toFixed(2)}×`;
}

/**
 * Free EDGAR-based screener UI. Hits /api/screener.
 */
export default function Screener({ embedded = false }: { embedded?: boolean }) {
  const [sector, setSector] = useState<string>("Technology");
  const [minGm, setMinGm] = useState("");
  const [maxDe, setMaxDe] = useState("");
  const [minFcf, setMinFcf] = useState("");
  const [sortBy, setSortBy] = useState("fcfMargin");
  const [q, setQ] = useState("");
  const [data, setData] = useState<ScreenerResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (sector) params.set("sectors", sector);
      if (minGm) params.set("minGrossMargin", String(Number(minGm) / 100));
      if (maxDe) params.set("maxDebtToEquity", maxDe);
      if (minFcf) params.set("minFcfMargin", String(Number(minFcf) / 100));
      if (q.trim()) params.set("q", q.trim());
      params.set("sortBy", sortBy);
      params.set("sortDir", "desc");
      params.set("limit", "40");
      const res = await fetch(`/api/research/screener?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Screener failed");
      setData(json as ScreenerResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Screener failed");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [sector, minGm, maxDe, minFcf, sortBy, q]);

  useEffect(() => {
    void run();
  }, []); // initial load only

  return (
    <section
      className={
        embedded
          ? "space-y-4"
          : "mx-auto w-full max-w-5xl space-y-4 px-4 py-8 sm:px-6"
      }
    >
      {!embedded && (
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Screener</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Free liquid-US universe scored from SEC filings (not vendor consensus).
            Results cache ~1h. Slow on cold start — be patient.
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-zinc-200 bg-zinc-50/50 p-3 dark:border-zinc-800 dark:bg-zinc-900/30">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-zinc-500">Sector</span>
          <select
            value={sector}
            onChange={(e) => setSector(e.target.value)}
            className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          >
            {SECTORS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-zinc-500">Min gross margin %</span>
          <input
            value={minGm}
            onChange={(e) => setMinGm(e.target.value)}
            placeholder="e.g. 30"
            className="w-24 rounded-lg border border-zinc-300 bg-white px-2 py-1.5 font-mono text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-zinc-500">Min FCF margin %</span>
          <input
            value={minFcf}
            onChange={(e) => setMinFcf(e.target.value)}
            placeholder="e.g. 5"
            className="w-24 rounded-lg border border-zinc-300 bg-white px-2 py-1.5 font-mono text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-zinc-500">Max D/E</span>
          <input
            value={maxDe}
            onChange={(e) => setMaxDe(e.target.value)}
            placeholder="e.g. 2"
            className="w-24 rounded-lg border border-zinc-300 bg-white px-2 py-1.5 font-mono text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-zinc-500">Sort</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          >
            <option value="fcfMargin">FCF margin</option>
            <option value="grossMargin">Gross margin</option>
            <option value="opMargin">Op. margin</option>
            <option value="revYoy">Revenue YoY</option>
            <option value="roe">ROE</option>
            <option value="debtToEquity">Debt/Equity</option>
            <option value="ticker">Ticker</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-zinc-500">Search</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Ticker / name"
            className="w-32 rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>
        <button type="button" onClick={() => void run()} className={btnCompact} disabled={loading}>
          {loading ? "Scoring…" : "Run screen"}
        </button>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {error}
        </p>
      )}

      {data && (
        <>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Showing {data.rows.length} · universe {data.universeSize} · scored{" "}
            {data.scored} · failed {data.failed} · as of{" "}
            {new Date(data.asOf).toLocaleString()}
          </p>
          <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/70">
                  <th className="px-3 py-2 text-left">Ticker</th>
                  <th className="px-3 py-2 text-left">Name</th>
                  <th className="px-3 py-2 text-right">Rev YoY</th>
                  <th className="px-3 py-2 text-right">Gross</th>
                  <th className="px-3 py-2 text-right">Op</th>
                  <th className="px-3 py-2 text-right">FCF</th>
                  <th className="px-3 py-2 text-right">ROE</th>
                  <th className="px-3 py-2 text-right">D/E</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr
                    key={r.ticker}
                    className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/60"
                  >
                    <td className="px-3 py-2">
                      <Link
                        href={`/members/research/${encodeURIComponent(r.ticker)}`}
                        className="font-mono text-xs font-bold text-sky-800 hover:underline dark:text-sky-300"
                      >
                        {r.ticker}
                      </Link>
                    </td>
                    <td className="max-w-[12rem] truncate px-3 py-2 text-xs text-zinc-600 dark:text-zinc-400">
                      {r.name}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs tabular-nums">
                      {fmtPct(r.metrics.revYoy)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs tabular-nums">
                      {fmtPct(r.metrics.grossMargin)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs tabular-nums">
                      {fmtPct(r.metrics.opMargin)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs tabular-nums">
                      {fmtPct(r.metrics.fcfMargin)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs tabular-nums">
                      {fmtPct(r.metrics.roe)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs tabular-nums">
                      {fmtX(r.metrics.debtToEquity)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.notes?.length > 0 && (
            <ul className="list-inside list-disc text-[11px] text-zinc-500">
              {data.notes.slice(0, 5).map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
