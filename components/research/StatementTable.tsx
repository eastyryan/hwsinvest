"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowSquareOut } from "@phosphor-icons/react";
import type { Statement, PeriodCol, LineValues } from "@/lib/research/edgar";
import type { FilingLink, FilingsPayload } from "@/lib/research/filings";
import { mapFilingsToPeriods } from "@/lib/research/filings";
import { fmtValue, fmtPct } from "@/lib/research/format";
import { periodCagr } from "@/lib/research/cagr";
import { getLineMeta } from "@/lib/research/line-meta";
import { currencyPrefix } from "./currency";
import { btnCompact, btnSegmentedCompact, btnSegmentedCompactItem } from "./ui/buttonStyles";

const DEFAULT_COLS = 8;
const CAGR_SPANS = [3, 5, 10];
// Matches the windows the data layer uses when it computes yoy/qoq.
const YEAR_MS = 365 * 86400000;
const QUARTER_MS = 91 * 86400000;

const TOLERANCE_MS = 20 * 86400000;

/** Period keys that could be the comparison base for each period, nearest first. */
type ComparisonIndex = Record<string, string[]>;

/**
 * Which period each change was measured against.
 *
 * Mirrors what the data layer does when it builds `yoy`/`qoq`: take the period
 * closest to one year (or one quarter) earlier, within a 20-day tolerance so
 * 52/53-week calendars still line up. Reconstructing it here is what lets the
 * table tell a real growth rate apart from a sign flip.
 *
 * Built once per period axis rather than per cell — a quarterly statement with
 * every period shown is 70-odd columns across 17 rows, and rescanning the axis
 * inside each cell turned "show all periods" into a visible stall.
 */
function buildComparisonIndex(periods: PeriodCol[], backMs: number): ComparisonIndex {
  const times = periods.map((p) => new Date(p.end).getTime());
  const out: ComparisonIndex = {};
  for (let i = 0; i < periods.length; i++) {
    const target = times[i] - backMs;
    const near: number[] = [];
    for (let j = 0; j < periods.length; j++) {
      if (j !== i && Math.abs(times[j] - target) <= TOLERANCE_MS) near.push(j);
    }
    near.sort((a, b) => Math.abs(times[a] - target) - Math.abs(times[b] - target));
    out[periods[i].key] = near.map((j) => periods[j].key);
  }
  return out;
}

function comparisonValue(
  line: LineValues,
  index: ComparisonIndex,
  periodKey: string,
): number | null {
  for (const key of index[periodKey] ?? []) {
    const v = line.values[key];
    if (v != null) return v;
  }
  return null;
}

/**
 * A percent change across a sign change is arithmetic, not information.
 *
 * Investing cash flow going from +1,408 to (1,601) is reported by the data
 * layer as -214%; the next column is +203%, then -118%. Those numbers say
 * nothing about the business, and a row of them next to real growth rates is
 * the fastest way to lose a reader who reads statements for a living. The
 * convention in every filing-derived model is "n/m" — not meaningful.
 *
 * When the comparison period can't be located (a line whose series doesn't sit
 * on the shared period axis) the raw percentage is shown, which is no worse
 * than before.
 */
function notMeaningful(cur: number | null, prev: number | null): boolean {
  if (cur == null || prev == null) return false;
  return cur < 0 !== prev < 0;
}

const YOY_VINTAGE_TITLE = "YoY mixes restated and original vintages";

function ChangeCell({
  v,
  cur,
  prev,
  suffix = "",
  size = "text-[10px]",
  mixVintages = false,
}: {
  v: number | null;
  cur: number | null;
  prev: number | null;
  suffix?: string;
  size?: string;
  /** Current or prior period was restated — YoY mixes vintages. */
  mixVintages?: boolean;
}) {
  if (v == null) return null;
  const mark = mixVintages ? (
    <span
      className="ml-0.5 text-amber-700 dark:text-amber-400"
      title={YOY_VINTAGE_TITLE}
    >
      *
    </span>
  ) : null;
  if (notMeaningful(cur, prev)) {
    return (
      <span
        className={`block ${size} leading-tight text-zinc-500 dark:text-zinc-400`}
        title="Not meaningful: the comparison period had the opposite sign"
      >
        n/m{suffix}
        {mark}
      </span>
    );
  }
  const cls =
    v > 0
      ? "text-emerald-700 dark:text-emerald-400"
      : v < 0
        ? "text-red-700 dark:text-red-400"
        : "text-zinc-500 dark:text-zinc-400";
  return (
    <span
      className={`block ${size} leading-tight ${cls}`}
      title={mixVintages ? YOY_VINTAGE_TITLE : undefined}
    >
      {fmtPct(v)}
      {suffix}
      {mark}
    </span>
  );
}

function SourceLink({
  filing,
  label,
  compact = false,
}: {
  filing: FilingLink;
  label?: string;
  compact?: boolean;
}) {
  const title = `${filing.form} filed ${filing.filingDate} · period ended ${filing.reportDate}`;
  return (
    <a
      href={filing.documentUrl}
      target="_blank"
      rel="noopener noreferrer"
      title={title}
      aria-label={`Open ${filing.form} source filing for period ended ${filing.reportDate}`}
      className={
        compact
          ? "inline-flex items-center gap-0.5 text-[10px] font-medium text-zinc-400 underline-offset-2 hover:text-zinc-700 hover:underline dark:text-zinc-500 dark:hover:text-zinc-300"
          : "inline-flex items-center gap-1 text-xs font-medium text-zinc-500 underline-offset-2 hover:text-zinc-800 hover:underline dark:text-zinc-400 dark:hover:text-zinc-200"
      }
    >
      {label ?? "Source"}
      <ArrowSquareOut
        weight="bold"
        className={compact ? "h-2.5 w-2.5" : "h-3 w-3"}
        aria-hidden
      />
    </a>
  );
}

export default function StatementTable({
  statement,
  periods,
  quarterly,
  denominator,
  denominatorLabel,
  currency = "USD",
  cik,
  restatedPeriodEnds,
}: {
  statement: Statement;
  periods: PeriodCol[];
  quarterly: boolean;
  denominator?: LineValues; // revenue (income/cash flow) or total assets (balance)
  denominatorLabel?: string;
  /** The filer's reporting currency — not always USD. */
  currency?: string;
  /** SEC CIK — when set, period headers link to the matching 10-K/10-Q. */
  cik?: string;
  /** Period keys / end dates whose latest-filed figure differs from an earlier vintage. */
  restatedPeriodEnds?: string[];
}) {
  const [showAll, setShowAll] = useState(false);
  const [commonSize, setCommonSize] = useState(false);
  const [copied, setCopied] = useState(false);
  const [filings, setFilings] = useState<FilingLink[] | null>(null);
  const cols = showAll ? periods : periods.slice(0, DEFAULT_COLS);
  const showCagr = !quarterly && !commonSize;
  const yoyIndex = useMemo(() => buildComparisonIndex(periods, YEAR_MS), [periods]);
  const qoqIndex = useMemo(
    () => (quarterly ? buildComparisonIndex(periods, QUARTER_MS) : {}),
    [periods, quarterly],
  );
  const restatedSet = useMemo(() => {
    const s = new Set<string>();
    for (const id of restatedPeriodEnds ?? []) {
      s.add(id);
      s.add(id.slice(0, 10));
    }
    return s;
  }, [restatedPeriodEnds]);

  function periodIsRestated(id: string): boolean {
    return restatedSet.has(id) || restatedSet.has(id.slice(0, 10));
  }

  function mixesRestatedVintages(
    period: PeriodCol,
    index: ComparisonIndex,
  ): boolean {
    if (restatedSet.size === 0) return false;
    if (periodIsRestated(period.key) || periodIsRestated(period.end)) return true;
    for (const prior of index[period.key] ?? []) {
      if (periodIsRestated(prior)) return true;
    }
    return false;
  }

  useEffect(() => {
    if (!cik) {
      setFilings(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/research/filings/${cik}`);
        if (!res.ok) return;
        const json = (await res.json()) as FilingsPayload;
        if (!cancelled) setFilings(json.filings ?? []);
      } catch {
        // Source links are progressive enhancement — silence network errors.
        if (!cancelled) setFilings([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cik]);

  const filingByEnd = useMemo(() => {
    if (!filings?.length) return {} as Record<string, FilingLink>;
    return mapFilingsToPeriods(
      filings,
      periods.map((p) => p.end),
      { quarterly }
    );
  }, [filings, periods, quarterly]);

  const latestSource = useMemo(() => {
    for (const p of periods) {
      const hit = filingByEnd[p.end.slice(0, 10)];
      if (hit) return hit;
    }
    return null;
  }, [periods, filingByEnd]);

  if (!statement || statement.lines.length === 0) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        This company doesn&apos;t report data for this statement.
      </p>
    );
  }

  const canCommonSize = !!denominator;
  const shortDenominator = denominatorLabel === "total assets" ? "assets" : "revenue";

  function cellValue(line: LineValues, p: PeriodCol): string {
    const v = line.values[p.key];
    if (!commonSize || line.perShare || line.shares) {
      return fmtValue(v, { perShare: line.perShare, shares: line.shares });
    }
    const d = denominator?.values[p.key];
    if (v == null || d == null || d === 0) return "—";
    return ((v / d) * 100).toFixed(1) + "%";
  }

  const unitsNote = commonSize
    ? `Shown as % of ${denominatorLabel}`
    : `${currency} millions · ${quarterly ? "YoY and QoQ" : "YoY"} change below each value`;

  function copyTsv() {
    const header = [
      "Line",
      ...(showCagr ? CAGR_SPANS.map((y) => `${y}y CAGR`) : []),
      ...cols.map((p) => p.label),
    ];
    const rows = statement.lines.map((line) => {
      const cells = [
        line.label,
        ...(showCagr
          ? CAGR_SPANS.map((y) => {
              const v = periodCagr(line.values, periods, y);
              return v == null ? "" : (v * 100).toFixed(2) + "%";
            })
          : []),
        ...cols.map((p) => {
          const raw = line.values[p.key];
          if (commonSize && denominator && !line.perShare && !line.shares) {
            const d = denominator.values[p.key];
            if (raw == null || d == null || d === 0) return "";
            return ((raw / d) * 100).toFixed(2) + "%";
          }
          return raw == null ? "" : String(raw);
        }),
      ];
      return cells.join("\t");
    });
    const tsv = [header.join("\t"), ...rows].join("\n");
    void navigator.clipboard.writeText(tsv).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-lg font-semibold tracking-tight">{statement.title}</h2>
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">{unitsNote}</p>
          <button
            type="button"
            onClick={copyTsv}
            aria-label={
              copied
                ? "Copied statement as tab-separated values"
                : "Copy statement as tab-separated values"
            }
            className={btnCompact}
          >
            {copied ? "Copied" : "Copy TSV"}
          </button>
          {canCommonSize && (
            <div
              className={btnSegmentedCompact}
              role="group"
              aria-label="Value basis"
            >
              {(
                [
                  // The symbol has to follow the filer's currency; a hard-coded
                  // "$" mislabels every non-US filer's own statements.
                  ["values", currencyPrefix(currency).trim(), `Show values in ${currency}`],
                  [
                    "common",
                    `% of ${shortDenominator}`,
                    `Show values as a percentage of ${denominatorLabel}`,
                  ],
                ] as const
              ).map(([mode, label, description]) => (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={(mode === "common") === commonSize}
                  aria-label={description}
                  onClick={() => setCommonSize(mode === "common")}
                  className={btnSegmentedCompactItem((mode === "common") === commonSize)}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="mt-3 overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">
            {statement.title}. {unitsNote}. Periods run newest first
            {showCagr ? ", with compound annual growth rates" : ""}.
          </caption>
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/70">
              <th
                scope="col"
                className="sticky left-0 z-10 min-w-[180px] bg-zinc-50 px-4 py-2.5 text-left font-medium text-zinc-500 sm:min-w-[220px] dark:bg-zinc-900 dark:text-zinc-400"
              >
                Line item
              </th>
              {showCagr &&
                CAGR_SPANS.map((y) => (
                  <th
                    key={y}
                    scope="col"
                    // Hidden on phones: three derived columns between the label
                    // and the latest year push the actual numbers off-screen on
                    // a 375px viewport.
                    className="hidden min-w-[70px] border-r border-zinc-200 px-3 py-2.5 text-right font-mono text-[11px] font-medium text-zinc-500 last-of-type:border-r-0 md:table-cell dark:border-zinc-800 dark:text-zinc-400"
                  >
                    {y}y CAGR
                  </th>
                ))}
              {cols.map((p) => {
                const source = filingByEnd[p.end.slice(0, 10)];
                return (
                  <th
                    key={p.key}
                    scope="col"
                    className="min-w-[112px] px-4 py-2.5 text-right font-mono text-xs font-medium text-zinc-500 dark:text-zinc-400"
                  >
                    <div className="flex flex-col items-end gap-0.5">
                      <span>{p.label}</span>
                      {source && (
                        <SourceLink filing={source} label={source.form} compact />
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {statement.lines.map((line) => {
              const strong = line.style !== "normal";
              return (
                <tr
                  key={line.key}
                  className={`border-b border-zinc-100 last:border-b-0 dark:border-zinc-800/60 ${
                    strong ? "bg-zinc-50/70 dark:bg-zinc-900/40" : ""
                  }`}
                >
                  {/* A row header, not a data cell: it names every value in the
                      row, which is how a screen reader announces them. */}
                  <th
                    scope="row"
                    className={`sticky left-0 z-10 px-4 py-2 text-left ${
                      // The sticky cell needs its own opaque background, so it
                      // must match the subtotal row tint instead of always
                      // painting plain white/near-black underneath it.
                      strong
                        ? "bg-[#fcfcfc] dark:bg-[#0f0f11]"
                        : "bg-white dark:bg-zinc-950"
                    } ${line.indent ? "pl-8" : ""} ${
                      strong ? "font-semibold" : "font-normal text-zinc-600 dark:text-zinc-300"
                    }`}
                  >
                    {(() => {
                      const meta = getLineMeta(line.key);
                      const tip = meta
                        ? [
                            meta.label,
                            meta.deriveFrom
                              ? `Can be derived: ${meta.deriveFrom}`
                              : null,
                            meta.tags.length
                              ? `XBRL tags: ${meta.tags.join(", ")}`
                              : null,
                            ...meta.notes,
                          ]
                            .filter(Boolean)
                            .join("\n")
                        : undefined;
                      return (
                        <>
                          <span
                            className={
                              meta
                                ? "cursor-help border-b border-dotted border-zinc-400/70 dark:border-zinc-600"
                                : undefined
                            }
                            title={tip}
                          >
                            {line.label}
                          </span>
                          {line.shares && (
                            <span className="ml-1 text-[10px] font-normal text-zinc-500 dark:text-zinc-400">
                              (avg)
                            </span>
                          )}
                          {meta?.derived && (
                            <span
                              className="ml-1 text-[10px] font-normal text-zinc-400 dark:text-zinc-500"
                              title="May be derived from related lines when primary tags are missing"
                            >
                              ≈
                            </span>
                          )}
                        </>
                      );
                    })()}
                  </th>
                  {showCagr &&
                    CAGR_SPANS.map((y) => {
                      const v = periodCagr(line.values, periods, y);
                      return (
                        <td
                          key={y}
                          className="hidden border-r border-zinc-100 px-3 py-2 text-right font-mono text-[11px] tabular-nums text-zinc-500 last-of-type:border-r-0 md:table-cell dark:border-zinc-800/60 dark:text-zinc-400"
                          title={
                            v == null
                              ? "Not available: missing history, irregular fiscal span, or a scale break in the series"
                              : undefined
                          }
                        >
                          {v == null ? "—" : fmtPct(v)}
                        </td>
                      );
                    })}
                  {cols.map((p) => (
                    <td key={p.key} className="px-4 py-2 text-right align-top">
                      <span
                        className={`font-mono text-[15px] tabular-nums ${
                          strong ? "font-semibold" : "text-zinc-700 dark:text-zinc-300"
                        }`}
                      >
                        {cellValue(line, p)}
                      </span>
                      {!commonSize && (
                        <ChangeCell
                          v={line.yoy[p.key]}
                          cur={line.values[p.key]}
                          prev={comparisonValue(line, yoyIndex, p.key)}
                          mixVintages={mixesRestatedVintages(p, yoyIndex)}
                        />
                      )}
                      {!commonSize && quarterly && (
                        <ChangeCell
                          v={line.qoq[p.key]}
                          cur={line.values[p.key]}
                          prev={comparisonValue(line, qoqIndex, p.key)}
                          suffix=" QoQ"
                          size="text-[9px]"
                          mixVintages={mixesRestatedVintages(p, qoqIndex)}
                        />
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        {periods.length > DEFAULT_COLS && (
          <button
            type="button"
            onClick={() => setShowAll(!showAll)}
            aria-expanded={showAll}
            className={btnCompact}
          >
            {showAll ? "Show fewer periods" : `Show all ${periods.length} periods`}
          </button>
        )}
        {latestSource && (
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
            Latest period source:{" "}
            <SourceLink
              filing={latestSource}
              label={`${latestSource.form} filed ${latestSource.filingDate}`}
            />
          </p>
        )}
      </div>
    </section>
  );
}
