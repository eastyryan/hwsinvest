"use client";

import { useEffect, useMemo, useState } from "react";
import type { CompanyFinancials } from "@/lib/research/edgar";
import { fmtValue, fmtPct } from "@/lib/research/format";
import {
  buildVisitSnapshot,
  clearVisitSnapshot,
  diffSnapshots,
  loadVisitSnapshot,
  saveVisitSnapshot,
  type MetricDelta,
  type VisitSnapshot,
} from "@/lib/research/visit-snapshot";
import type { SectorMode } from "@/lib/research/sector-mode";

function tone(d: MetricDelta["direction"]): string {
  if (d === "up") return "text-emerald-700 dark:text-emerald-400";
  if (d === "down") return "text-red-700 dark:text-red-400";
  return "text-zinc-500 dark:text-zinc-400";
}

function describe(d: MetricDelta): string {
  const bits: string[] = [];
  if (d.format === "pct") {
    if (d.levelDelta != null) {
      const pp = (d.levelDelta * 100).toFixed(1);
      bits.push(
        `${d.levelDelta > 0 ? "+" : ""}${pp} pp` +
          (d.prev != null && d.next != null
            ? ` (${(d.prev * 100).toFixed(1)}% → ${(d.next * 100).toFixed(1)}%)`
            : "")
      );
    }
  } else {
    if (d.yoyDeltaPp != null) {
      const pp = (d.yoyDeltaPp * 100).toFixed(1);
      bits.push(
        `YoY growth ${d.yoyDeltaPp > 0 ? "up" : "down"} ${Math.abs(Number(pp))} pp` +
          (d.prevYoy != null && d.nextYoy != null
            ? ` (${fmtPct(d.prevYoy)} → ${fmtPct(d.nextYoy)})`
            : "")
      );
    }
    if (d.levelDelta != null && d.levelDelta !== 0) {
      bits.push(
        `level ${d.levelDelta > 0 ? "+" : ""}${fmtValue(d.levelDelta)}` +
          (d.prev != null && d.next != null
            ? ` (${fmtValue(d.prev)} → ${fmtValue(d.next)})`
            : "")
      );
    }
  }
  return bits.join(" · ") || "Changed";
}

export default function WhatChanged({
  fin,
  mode = "standard",
  embedded = false,
}: {
  fin: CompanyFinancials;
  mode?: SectorMode;
  embedded?: boolean;
}) {
  // Read the prior baseline once on mount (before we overwrite it).
  const [prev] = useState<VisitSnapshot | null>(() => loadVisitSnapshot(fin.ticker));
  const current = useMemo(() => buildVisitSnapshot(fin, mode), [fin, mode]);
  const [resetNote, setResetNote] = useState<string | null>(null);

  useEffect(() => {
    // Persist after paint so this visit is the baseline next time.
    saveVisitSnapshot(current);
  }, [current]);

  function resetBaseline() {
    clearVisitSnapshot(fin.ticker);
    saveVisitSnapshot(current);
    setResetNote("Baseline reset to this visit.");
  }

  if (!prev || prev.ticker !== fin.ticker.toUpperCase()) {
    return (
      <section
        className={
          embedded
            ? "space-y-1"
            : "rounded-xl border border-zinc-200 bg-zinc-50/60 p-4 dark:border-zinc-800 dark:bg-zinc-900/40"
        }
      >
        {!embedded && (
          <h2 className="text-sm font-semibold tracking-tight">Since last visit</h2>
        )}
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          First time viewing {fin.ticker} here — a baseline was saved for next time
          (revenue, margins, FCF, and more). Come back after new filings land to see
          what moved.
        </p>
      </section>
    );
  }

  const diff = diffSnapshots(prev, current);
  const deltas = diff.deltas.slice(0, 8);
  const savedLabel = prev.savedAt.slice(0, 10);

  if (deltas.length === 0 && !diff.periodChanged) {
    return (
      <section
        className={
          embedded
            ? "space-y-1"
            : "rounded-xl border border-zinc-200 bg-zinc-50/60 p-4 dark:border-zinc-800 dark:bg-zinc-900/40"
        }
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            {!embedded && (
              <h2 className="text-sm font-semibold tracking-tight">Since last visit</h2>
            )}
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {diff.headline}. Baseline from {savedLabel}
              {prev.periodLabel ? ` · ${prev.periodLabel}` : ""}.
              {resetNote ? ` ${resetNote}` : " Baseline updated."}
            </p>
          </div>
          <button
            type="button"
            onClick={resetBaseline}
            className="text-[11px] text-zinc-500 underline-offset-2 hover:text-zinc-800 hover:underline dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            Reset baseline
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          {!embedded && (
            <h2 className="text-lg font-semibold tracking-tight">Since last visit</h2>
          )}
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {diff.headline}. Compared to {savedLabel}
            {prev.periodLabel ? ` · then ${prev.periodLabel}` : ""}
            {current.periodLabel ? ` · now ${current.periodLabel}` : ""}. Saved
            locally in this browser.
          </p>
          {diff.periodChanged && (
            <p className="mt-1 text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Filing period rolled
              {prev.periodLabel && current.periodLabel
                ? ` from ${prev.periodLabel} → ${current.periodLabel}`
                : ""}
              .
            </p>
          )}
          {resetNote && (
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{resetNote}</p>
          )}
        </div>
        <button
          type="button"
          onClick={resetBaseline}
          className="text-[11px] text-zinc-500 underline-offset-2 hover:text-zinc-800 hover:underline dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          Reset baseline
        </button>
      </div>
      {deltas.length > 0 ? (
        <ul className="grid gap-2 sm:grid-cols-2">
          {deltas.map((d) => (
            <li
              key={d.key}
              className="rounded-xl border border-zinc-200 bg-zinc-50/60 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/40"
            >
              <p className="text-sm font-medium">{d.label}</p>
              <p className={`mt-0.5 text-xs leading-snug ${tone(d.direction)}`}>
                {describe(d)}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Period changed but watched metric levels are still within noise of your last
          baseline.
        </p>
      )}
    </section>
  );
}
