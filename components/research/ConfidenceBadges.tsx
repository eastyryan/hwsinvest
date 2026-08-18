"use client";

import type { ConfidenceReport } from "@/lib/research/confidence";

function levelClass(level: "info" | "warn" | "good"): string {
  if (level === "good") {
    return "border-emerald-500/40 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200";
  }
  if (level === "warn") {
    return "border-amber-500/50 bg-amber-50 text-amber-950 dark:bg-amber-950/40 dark:text-amber-200";
  }
  return "border-zinc-300 bg-zinc-50 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-300";
}

function gradeClass(grade: ConfidenceReport["grade"]): string {
  if (grade === "high") return "text-emerald-700 dark:text-emerald-400";
  if (grade === "medium") return "text-amber-700 dark:text-amber-400";
  return "text-red-700 dark:text-red-400";
}

export default function ConfidenceBadges({
  confidence,
  embedded = false,
}: {
  confidence: ConfidenceReport;
  embedded?: boolean;
}) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        {!embedded ? (
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Data confidence</h2>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Coverage, history depth, and restatement scan of headline annual
              figures — not a credit rating.
            </p>
          </div>
        ) : (
          <div />
        )}
        <div className="text-right">
          <p className={`font-mono text-2xl font-semibold tabular-nums ${gradeClass(confidence.grade)}`}>
            {confidence.score}
          </p>
          <p className="text-[10px] uppercase tracking-wide text-zinc-500">
            {confidence.grade} confidence
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {confidence.badges.map((b) => (
          <span
            key={b.id}
            title={b.detail}
            className={`inline-flex max-w-full cursor-help items-center rounded-full border px-2.5 py-1 text-xs font-medium ${levelClass(b.level)}`}
          >
            {b.label}
          </span>
        ))}
      </div>
      {confidence.restatementCount > 0 && (
        <p className="text-xs text-amber-800/90 dark:text-amber-300/90">
          {confidence.badges.find((b) => b.id === "restated")?.detail}
        </p>
      )}
    </section>
  );
}
