"use client";

import {
  provenanceLabel,
  type FootballFieldResult,
  type FootballProvenance,
} from "@/lib/research/valuation/football-field";
import { fmtPerShare, fmtPct } from "./fmt";

function provenanceChipClass(p: FootballProvenance): string {
  switch (p) {
    case "market":
      return "border-emerald-500/40 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300";
    case "model":
      return "border-sky-500/40 bg-sky-50 text-sky-800 dark:bg-sky-950/40 dark:text-sky-300";
    case "illustrative":
      return "border-amber-500/50 bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200";
    case "filing":
      return "border-violet-500/40 bg-violet-50 text-violet-800 dark:bg-violet-950/40 dark:text-violet-300";
  }
}

/**
 * Horizontal football-field valuation chart (per-share low–high bars).
 * Pure CSS; no chart library dependency beyond existing recharts elsewhere.
 */
export default function FootballFieldChart({
  field,
}: {
  field: FootballFieldResult;
}) {
  const axis = field.axis;
  if (!axis || field.bars.length === 0) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Expand the other models below (or wait for peer/price data) to populate
        the football field.
      </p>
    );
  }

  const span = axis.max - axis.min || 1;
  const x = (v: number) => ((v - axis.min) / span) * 100;
  const priceX =
    field.currentPrice != null && Number.isFinite(field.currentPrice)
      ? x(field.currentPrice)
      : null;

  const hasIllustrative = field.bars.some(
    (b) => b.provenance === "illustrative"
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4 text-xs text-zinc-500 dark:text-zinc-400">
        <span>
          Central estimate:{" "}
          <span className="font-mono font-medium text-zinc-800 dark:text-zinc-200">
            {fmtPerShare(field.centralEstimate)}
          </span>
        </span>
        {field.currentPrice != null && (
          <span>
            Market:{" "}
            <span className="font-mono font-medium text-zinc-800 dark:text-zinc-200">
              {fmtPerShare(field.currentPrice)}
            </span>
          </span>
        )}
        {field.impliedUpside != null && (
          <span>
            Implied vs market:{" "}
            <span
              className={`font-mono font-medium ${
                field.impliedUpside >= 0
                  ? "text-emerald-700 dark:text-emerald-400"
                  : "text-red-700 dark:text-red-400"
              }`}
            >
              {fmtPct(field.impliedUpside)}
            </span>
          </span>
        )}
      </div>

      <div className="space-y-3">
        {field.bars.map((bar) => {
          const lo = bar.low ?? bar.mid ?? bar.high;
          const hi = bar.high ?? bar.mid ?? bar.low;
          const mid = bar.mid ?? (lo != null && hi != null ? (lo + hi) / 2 : lo);
          if (lo == null || hi == null) return null;
          const left = x(lo);
          const width = Math.max(x(hi) - left, 0.8);
          const midPos = mid != null ? x(mid) : null;

          return (
            <div
              key={bar.id}
              className="grid grid-cols-[7.5rem_1fr_auto] items-center gap-2 sm:grid-cols-[9rem_1fr_auto] sm:gap-3"
            >
              <div className="text-right text-xs font-medium leading-tight text-zinc-700 dark:text-zinc-300">
                {bar.label}
              </div>
              <div className="relative h-7 rounded-md bg-zinc-100 dark:bg-zinc-900">
                {priceX != null && (
                  <div
                    className="pointer-events-none absolute inset-y-0 z-10 w-px bg-red-500/80"
                    style={{ left: `${priceX}%` }}
                    title={`Market ${fmtPerShare(field.currentPrice)}`}
                  />
                )}
                <div
                  className="absolute top-1/2 h-3.5 -translate-y-1/2 rounded-full bg-sky-600/85 dark:bg-sky-500/80"
                  style={{ left: `${left}%`, width: `${width}%` }}
                  title={`${bar.label}: ${fmtPerShare(lo)} – ${fmtPerShare(hi)}`}
                />
                {midPos != null && (
                  <div
                    className="absolute top-1/2 z-[1] h-4 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded bg-zinc-900 dark:bg-zinc-100"
                    style={{ left: `${midPos}%` }}
                  />
                )}
              </div>
              {bar.provenance ? (
                <span
                  className={`inline-flex shrink-0 items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium capitalize leading-none ${provenanceChipClass(bar.provenance)}`}
                  title={
                    bar.provenance === "illustrative"
                      ? "Illustrative — not a real deal set"
                      : bar.note ?? provenanceLabel(bar.provenance)
                  }
                >
                  {provenanceLabel(bar.provenance)}
                </span>
              ) : (
                <span className="w-[4.5rem]" aria-hidden />
              )}
            </div>
          );
        })}
      </div>

      <div className="flex justify-between pr-[4.75rem] pl-[7.5rem] font-mono text-[10px] text-zinc-400 sm:pr-[4.75rem] sm:pl-[9rem] dark:text-zinc-500">
        <span>{fmtPerShare(axis.min)}</span>
        <span>{fmtPerShare(axis.max)}</span>
      </div>

      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-zinc-500 dark:text-zinc-400">
        <span className="font-medium text-zinc-600 dark:text-zinc-300">
          Provenance:
        </span>
        <span>
          <span className="font-medium">market</span> — live prices / peer multiples
        </span>
        <span>
          <span className="font-medium">model</span> — assumption-driven (DCF, LBO)
        </span>
        <span>
          <span className="font-medium">filing</span> — reported financials
        </span>
        <span>
          <span className="font-medium">illustrative</span> — synthetic / sector
          templates, not real deals
        </span>
      </div>

      {hasIllustrative && (
        <p className="rounded-md border border-amber-500/30 bg-amber-50/80 px-2.5 py-1.5 text-[11px] leading-snug text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">
          <span className="font-medium">Illustrative ≠ real deals.</span>{" "}
          Precedent bars tagged illustrative use sector templates or synthetic
          multiples, not a curated M&amp;A transaction set for this issuer.
        </p>
      )}

      <p className="text-[11px] leading-snug text-zinc-500 dark:text-zinc-400">
        Bars show low–high per method; tick is the mid. Red line is the current
        market price when available. Not a recommendation — triangulation of
        assumption-driven models.
      </p>
      {field.notes.length > 0 && (
        <ul className="list-inside list-disc text-[11px] text-zinc-500 dark:text-zinc-400">
          {field.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
