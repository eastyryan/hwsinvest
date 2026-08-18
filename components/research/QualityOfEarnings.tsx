"use client";

import { useMemo, useState } from "react";
import type { CompanyFinancials } from "@/lib/research/edgar";
import {
  buildQualityOfEarnings,
  type QoeFormat,
} from "@/lib/research/quality-earnings";
import type { SectorMode } from "@/lib/research/sector-mode";
import { fmtBig } from "./currency";
import { btnCompact, btnSegmentedCompact, btnSegmentedCompactItem } from "./ui/buttonStyles";

function fmtQoe(
  v: number | null,
  format: QoeFormat,
  currency: string
): string {
  if (v == null || !Number.isFinite(v)) return "—";
  if (format === "pct") return (v * 100).toFixed(1) + "%";
  if (format === "x") {
    if (Math.abs(v) >= 100) return v.toFixed(0) + "×";
    return v.toFixed(2) + "×";
  }
  if (format === "days") {
    return Math.abs(v) >= 100 ? v.toFixed(0) + "d" : v.toFixed(1) + "d";
  }
  // money — absolute statement dollars, abbreviated
  return fmtBig(v, currency);
}

export default function QualityOfEarnings({
  fin,
  freq: freqProp,
  maxCols = 6,
  showFreqToggle = true,
  currency,
  mode = "standard",
  embedded = false,
}: {
  fin: CompanyFinancials;
  /** When provided with showFreqToggle=false, follows the parent control. */
  freq?: "annual" | "quarterly";
  maxCols?: number;
  showFreqToggle?: boolean;
  currency?: string;
  mode?: SectorMode;
  embedded?: boolean;
}) {
  const [localFreq, setLocalFreq] = useState<"annual" | "quarterly">("annual");
  const [showAll, setShowAll] = useState(false);
  const [view, setView] = useState<"reported" | "adjusted">("reported");

  const freq = showFreqToggle ? localFreq : (freqProp ?? "annual");
  const cur = currency ?? fin.currency ?? "USD";
  const financial = mode === "bank" || mode === "insurer";

  const qoe = useMemo(() => buildQualityOfEarnings(fin, freq), [fin, freq]);
  const hasAdjusted = qoe.lines.some((l) => l.adjusted);
  const visibleLines =
    view === "adjusted" ? qoe.lines : qoe.lines.filter((l) => !l.adjusted);
  const cols = showAll ? qoe.periods : qoe.periods.slice(0, maxCols);

  if (qoe.lines.length === 0) {
    return (
      <section className="space-y-2">
        {!embedded && (
          <h2 className="text-lg font-semibold tracking-tight">Quality of earnings</h2>
        )}
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Not enough reported cash-flow or balance-sheet tags to compute quality-of-earnings
          metrics for this company.
        </p>
      </section>
    );
  }

  const basis =
    freq === "quarterly"
      ? "Trailing-twelve-month flows at each quarter end; balances at period end"
      : "Fiscal-year figures";

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        {!embedded ? (
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Quality of earnings</h2>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              {financial
                ? "Accruals and cash conversion from the normalized statements. Working-capital days (DSO/DIO) can misread loan books or premiums receivable — treat them cautiously. Not a rating."
                : "Accruals, cash conversion, and working-capital signals from the normalized statements — no model. Cells show a dash when a ratio is not meaningful (for example negative net income) or a tag is missing."}
            </p>
          </div>
        ) : (
          <div />
        )}
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">{basis}</p>
          {hasAdjusted && (
            <div
              className={btnSegmentedCompact}
              role="group"
              aria-label="Quality of earnings basis"
            >
              {(["reported", "adjusted"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={view === v}
                  onClick={() => setView(v)}
                  className={btnSegmentedCompactItem(view === v)}
                >
                  {v === "reported" ? "As reported" : "Adjusted"}
                </button>
              ))}
            </div>
          )}
          {showFreqToggle && (
            <div
              className={btnSegmentedCompact}
              role="group"
              aria-label="Quality of earnings reporting period"
            >
              {(["annual", "quarterly"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  aria-pressed={freq === f}
                  onClick={() => {
                    setLocalFreq(f);
                    setShowAll(false);
                  }}
                  className={btnSegmentedCompactItem(freq === f)}
                >
                  {f}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">
            Quality of earnings metrics. {basis}. Periods run newest first.
          </caption>
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/70">
              <th
                scope="col"
                className="sticky left-0 z-10 min-w-[200px] bg-zinc-50 px-4 py-2.5 text-left font-medium text-zinc-500 sm:min-w-[260px] dark:bg-zinc-900 dark:text-zinc-400"
              >
                Metric
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
            {visibleLines.map((row) => (
              <tr
                key={row.key}
                className="border-b border-zinc-100 last:border-b-0 dark:border-zinc-800/60"
              >
                <th
                  scope="row"
                  className="sticky left-0 z-10 bg-white px-4 py-2 text-left font-medium dark:bg-zinc-950"
                >
                  {row.label}
                  {row.note && (
                    <span className="block text-[10px] font-normal leading-tight text-zinc-500 dark:text-zinc-400">
                      {row.note}
                    </span>
                  )}
                </th>
                {cols.map((p) => (
                  <td
                    key={p.key}
                    className="px-4 py-2 text-right font-mono text-[15px] tabular-nums"
                  >
                    {fmtQoe(row.values[p.key], row.format, cur)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {qoe.periods.length > maxCols && (
        <button
          type="button"
          onClick={() => setShowAll(!showAll)}
          className={btnCompact}
        >
          {showAll ? "Show fewer periods" : `Show all ${qoe.periods.length} periods`}
        </button>
      )}
    </section>
  );
}
