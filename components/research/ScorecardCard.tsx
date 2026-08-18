"use client";

import { useMemo } from "react";
import type { CompanyFinancials } from "@/lib/research/edgar";
import { buildScorecard } from "@/lib/research/excel-scorecard";
import type { SectorMode } from "@/lib/research/sector-mode";

function fmtFactor(value: number | null, fmt: string): string {
  if (value == null || !Number.isFinite(value)) return "—";
  if (fmt.includes("%") || fmt === "0.0%") {
    return (value * 100).toFixed(1) + "%";
  }
  if (!Number.isFinite(value)) return "—";
  if (Math.abs(value) >= 100) return value.toFixed(0) + "×";
  return value.toFixed(2) + "×";
}

function gradeTone(grade: string): string {
  if (grade === "A") return "bg-emerald-600 text-white dark:bg-emerald-500";
  if (grade === "B") return "bg-sky-600 text-white dark:bg-sky-500";
  if (grade === "C") return "bg-amber-500 text-white dark:bg-amber-500";
  if (grade === "D") return "bg-orange-600 text-white dark:bg-orange-500";
  if (grade === "F") return "bg-red-600 text-white dark:bg-red-500";
  return "bg-zinc-400 text-white";
}

function scoreBar(score: number | null): string {
  if (score == null) return "bg-zinc-200 dark:bg-zinc-800";
  if (score >= 70) return "bg-emerald-500";
  if (score >= 45) return "bg-amber-500";
  return "bg-red-500";
}

export default function ScorecardCard({
  fin,
  mode = "standard",
  embedded = false,
}: {
  fin: CompanyFinancials;
  mode?: SectorMode;
  embedded?: boolean;
}) {
  const sc = useMemo(() => buildScorecard(fin, mode), [fin, mode]);
  const financial = mode === "bank" || mode === "insurer";

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        {!embedded ? (
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Quality scorecard</h2>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              {financial
                ? mode === "bank"
                  ? "Bank-oriented heuristic: revenue growth, ROE, ROA, debt/equity, and cash conversion from the latest annual statements. Not a rating and not investment advice."
                  : "Insurer-oriented heuristic: top-line growth, ROE, ROA, debt/equity, and cash conversion from the latest annual statements. Not a rating and not investment advice."
                : "Rules-based heuristic from the latest annual statements — printed bands, no black box. Not a rating and not investment advice."}
            </p>
          </div>
        ) : (
          <div />
        )}
        <div className="flex items-center gap-3">
          <span
            className={`inline-flex h-10 w-10 items-center justify-center rounded-xl text-lg font-bold ${gradeTone(sc.grade)}`}
            title="Composite letter grade"
          >
            {sc.grade}
          </span>
          <div className="text-right">
            <p className="font-mono text-lg font-semibold tabular-nums">
              {sc.composite != null ? sc.composite.toFixed(0) : "—"}
            </p>
            <p className="text-[10px] uppercase tracking-wide text-zinc-500">
              / 100 composite
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {sc.factors.map((f) => (
          <div
            key={f.label}
            className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-4 dark:border-zinc-800 dark:bg-zinc-900/40"
            title={f.band}
          >
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              {f.label}
            </p>
            <p className="mt-1 font-mono text-base font-semibold tabular-nums">
              {fmtFactor(f.value, f.fmt)}
            </p>
            <p className="mt-0.5 text-[10px] leading-snug text-zinc-500 dark:text-zinc-400">
              {f.metric}
            </p>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
              <div
                className={`h-full rounded-full transition-all ${scoreBar(f.score)}`}
                style={{ width: `${f.score ?? 0}%` }}
              />
            </div>
            <p className="mt-1.5 font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
              Score {f.score != null ? f.score : "—"}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
