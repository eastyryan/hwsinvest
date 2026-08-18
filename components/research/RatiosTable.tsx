"use client";

import { useMemo, useState } from "react";
import type { CompanyFinancials } from "@/lib/research/edgar";
import { buildRatios } from "@/lib/research/ratios";
import type { SectorMode } from "@/lib/research/sector-mode";

function fmtRatio(v: number | null, format: "pct" | "x"): string {
  if (v == null) return "—";
  return format === "pct" ? (v * 100).toFixed(1) + "%" : v.toFixed(2) + "x";
}

export default function RatiosTable({
  fin,
  freq,
  maxCols,
  mode = "standard",
}: {
  fin: CompanyFinancials;
  freq: "annual" | "quarterly";
  maxCols: number;
  mode?: SectorMode;
}) {
  const ratios = useMemo(() => buildRatios(fin, freq, mode), [fin, freq, mode]);
  const [showAll, setShowAll] = useState(false);
  const cols = showAll ? ratios.periods : ratios.periods.slice(0, maxCols);
  const financial = mode === "bank" || mode === "insurer";

  if (ratios.lines.length === 0) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Not enough reported data to compute ratios for this company.
      </p>
    );
  }

  const basis =
    freq === "quarterly"
      ? "Trailing-twelve-month figures at each quarter end"
      : "Fiscal-year figures";

  return (
    <section>
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Ratios &amp; Returns</h2>
          {financial && (
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Gross margin omitted — not meaningful for {mode === "bank" ? "banks" : "insurers"}.
              ROE, ROA, and debt/equity are listed first.
            </p>
          )}
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">{basis}</p>
      </div>
      <div className="mt-3 overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">
            Ratios and returns. {basis}. Periods run newest first. Margins and returns
            are percentages; multiples are shown with a trailing x.
          </caption>
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/70">
              <th
                scope="col"
                className="sticky left-0 z-10 min-w-[180px] bg-zinc-50 px-4 py-2.5 text-left font-medium text-zinc-500 sm:min-w-[230px] dark:bg-zinc-900 dark:text-zinc-400"
              >
                Ratio
              </th>
              {cols.map((p) => (
                <th
                  key={p.key}
                  scope="col"
                  className="min-w-[96px] px-4 py-2.5 text-right font-mono text-xs font-medium text-zinc-500 dark:text-zinc-400"
                >
                  {p.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ratios.lines.map((line) => (
              <tr
                key={line.key}
                className={`border-b border-zinc-100 last:border-b-0 dark:border-zinc-800/60 ${
                  line.deemphasized ? "opacity-60" : ""
                }`}
              >
                <th
                  scope="row"
                  className="sticky left-0 z-10 bg-white px-4 py-2 text-left font-medium dark:bg-zinc-950"
                >
                  {line.label}
                  {line.note && (
                    <span className="block text-[10px] font-normal leading-tight text-zinc-500 dark:text-zinc-400">
                      {line.note}
                    </span>
                  )}
                </th>
                {cols.map((p) => (
                  <td
                    key={p.key}
                    className="px-4 py-2 text-right font-mono text-[15px] tabular-nums"
                  >
                    {fmtRatio(line.values[p.key], line.format)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {ratios.periods.length > maxCols && (
        <button
          type="button"
          onClick={() => setShowAll(!showAll)}
          aria-expanded={showAll}
          className="mt-3 rounded-lg border-[0.5px] border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:focus-visible:outline-zinc-100"
        >
          {showAll ? "Show fewer periods" : `Show all ${ratios.periods.length} periods`}
        </button>
      )}
    </section>
  );
}
