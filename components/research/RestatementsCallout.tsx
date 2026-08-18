"use client";

import { useState } from "react";
import type { RestatementHit } from "@/lib/research/restatements";
import { fmtBig } from "./currency";
import { btnSegmentedCompact, btnSegmentedCompactItem } from "./ui/buttonStyles";

function fmtRel(rel: number): string {
  const pct = rel * 100;
  if (pct >= 10) return `${pct.toFixed(0)}%`;
  if (pct >= 1) return `${pct.toFixed(1)}%`;
  return `${pct.toFixed(2)}%`;
}

function direction(first: number, last: number): "up" | "down" | "flat" {
  if (last > first) return "up";
  if (last < first) return "down";
  return "flat";
}

/** SEC company 10-K list — best free deep link without accession on the hit. */
function filingsBrowseUrl(cik: string): string {
  const n = String(Number(cik));
  return `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${n}&type=10-K&dateb=&owner=include&count=40`;
}

export default function RestatementsCallout({
  hits,
  cik,
  currency = "USD",
}: {
  hits: RestatementHit[];
  cik: string;
  currency?: string;
}) {
  const [showOriginal, setShowOriginal] = useState(false);

  if (!hits.length) return null;

  const top = hits.slice(0, 5);
  const more = hits.length - top.length;

  return (
    <section
      className="rounded-xl border border-amber-400/70 bg-amber-50/90 px-4 py-4 dark:border-amber-700/60 dark:bg-amber-950/35"
      role="status"
      aria-label="Material restatements detected"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-amber-950 dark:text-amber-100">
            Restatements / revisions
          </h2>
          <p className="mt-1 max-w-[70ch] text-xs leading-relaxed text-amber-900/85 dark:text-amber-200/85">
            Later 10-K filings changed previously reported annual figures for the
            same period end (beyond a 1% noise floor). Statements and growth
            rates use the latest filed figure. YoY across a restated year mixes
            vintages — those cells are marked.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div
            className={btnSegmentedCompact}
            role="group"
            aria-label="Show originally filed vs latest"
          >
            <button
              type="button"
              aria-pressed={!showOriginal}
              onClick={() => setShowOriginal(false)}
              className={btnSegmentedCompactItem(!showOriginal)}
            >
              Latest filed
            </button>
            <button
              type="button"
              aria-pressed={showOriginal}
              onClick={() => setShowOriginal(true)}
              className={btnSegmentedCompactItem(showOriginal)}
            >
              Originally filed
            </button>
          </div>
          <a
            href={filingsBrowseUrl(cik)}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 rounded-lg border border-amber-700/40 bg-white/70 px-2.5 py-1 text-xs font-medium text-amber-950 transition-colors hover:bg-white dark:border-amber-600/50 dark:bg-amber-950/60 dark:text-amber-100 dark:hover:bg-amber-900/80"
          >
            Open SEC 10-K filings ↗
          </a>
        </div>
      </div>

      <ul className="mt-3 space-y-2">
        {top.map((h) => {
          const dir = direction(h.firstVal, h.lastVal);
          const delta = h.lastVal - h.firstVal;
          const emphasized = showOriginal ? h.firstVal : h.lastVal;
          const other = showOriginal ? h.lastVal : h.firstVal;
          return (
            <li
              key={`${h.concept}-${h.periodEnd}-${h.lastFiled}`}
              className="rounded-lg border border-amber-300/50 bg-white/60 px-3 py-2.5 dark:border-amber-800/50 dark:bg-amber-950/40"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <p className="text-sm font-medium text-amber-950 dark:text-amber-50">
                  {h.concept}
                  <span className="ml-2 font-mono text-xs font-normal text-amber-800/80 dark:text-amber-300/80">
                    period ended {h.periodEnd}
                  </span>
                </p>
                <p
                  className={`font-mono text-xs font-semibold tabular-nums ${
                    dir === "up"
                      ? "text-amber-900 dark:text-amber-200"
                      : dir === "down"
                        ? "text-amber-900 dark:text-amber-200"
                        : "text-zinc-600"
                  }`}
                >
                  {dir === "up" ? "↑" : dir === "down" ? "↓" : "·"}{" "}
                  {fmtRel(h.relChange)}
                </p>
              </div>
              <p className="mt-1 font-mono text-xs tabular-nums text-amber-900/90 dark:text-amber-100/90">
                <span
                  className={
                    showOriginal
                      ? "font-semibold"
                      : "text-amber-800/70 dark:text-amber-300/70"
                  }
                  title="Originally filed"
                >
                  {fmtBig(h.firstVal, currency)}
                </span>
                <span className="mx-1.5 text-amber-700/60 dark:text-amber-400/50">
                  →
                </span>
                <span
                  className={
                    showOriginal
                      ? "text-amber-800/70 dark:text-amber-300/70"
                      : "font-semibold"
                  }
                  title="Latest filed (statement of record)"
                >
                  {fmtBig(h.lastVal, currency)}
                </span>
                <span className="ml-2 text-[10px] text-amber-800/70 dark:text-amber-300/70">
                  (Δ {fmtBig(delta, currency)})
                </span>
              </p>
              <p className="mt-0.5 text-[10px] text-amber-800/75 dark:text-amber-300/70">
                {showOriginal ? "Originally filed" : "Latest filed"}{" "}
                {fmtBig(emphasized, currency)}
                <span className="mx-1 text-amber-700/50">·</span>
                {showOriginal ? "latest" : "originally"} {fmtBig(other, currency)}
                <span className="mx-1 text-amber-700/50">·</span>
                First filed {h.firstFiled} · last filed {h.lastFiled}
              </p>
            </li>
          );
        })}
      </ul>

      {more > 0 && (
        <p className="mt-2 text-[11px] text-amber-800/80 dark:text-amber-300/75">
          +{more} more material change{more === 1 ? "" : "s"} not shown (see
          Overview → Data confidence for the full scan).
        </p>
      )}
    </section>
  );
}
