"use client";

import { useMemo, useState } from "react";
import type { Statement, PeriodCol, LineValues } from "@/lib/research/edgar";
import { fmtValue, fmtPct } from "@/lib/research/format";
import { currencyPrefix } from "./currency";

const DEFAULT_COLS = 8;
const CAGR_SPANS = [3, 5, 10];
// Matches the windows the data layer uses when it computes yoy/qoq.
const YEAR_MS = 365 * 86400000;
const QUARTER_MS = 91 * 86400000;
const CAGR_YEAR_MS = 365.25 * 86400000;

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
  periodKey: string
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

function ChangeCell({
  v,
  cur,
  prev,
  suffix = "",
  sub = false,
}: {
  v: number | null;
  cur: number | null;
  prev: number | null;
  suffix?: string;
  sub?: boolean;
}) {
  if (v == null) return null;
  const cls = sub ? "rsch-delta-sub" : "rsch-delta";
  if (notMeaningful(cur, prev)) {
    return (
      <span
        className={cls}
        style={{ color: "var(--faint)" }}
        title="Not meaningful: the comparison period had the opposite sign"
      >
        n/m{suffix}
      </span>
    );
  }
  const color = v > 0 ? "var(--up)" : v < 0 ? "var(--down)" : "var(--faint)";
  return (
    <span className={cls} style={{ color }}>
      {fmtPct(v)}
      {suffix}
    </span>
  );
}

/**
 * Compound annual growth between the latest period and the one ~`years` back.
 *
 * Indexing `periods[years]` assumes the annual axis is gapless, which is not
 * guaranteed — a filer that skipped a year, changed its fiscal calendar, or
 * simply has no anchor fact for one year leaves a hole, and the "10y CAGR"
 * then silently annualises an 11-year span. Match on the end *date* instead
 * and annualise over the span actually found, dropping the figure when nothing
 * lands close enough for the label to be honest.
 */
function cagr(line: LineValues, periods: PeriodCol[], years: number): number | null {
  const latest = periods[0];
  if (!latest) return null;
  const now = line.values[latest.key];
  if (now == null || now <= 0) return null;

  const latestMs = new Date(latest.end).getTime();
  const targetMs = latestMs - years * CAGR_YEAR_MS;
  let best: { key: string; end: string; span: number } | null = null;
  for (const p of periods) {
    const v = line.values[p.key];
    if (v == null || v <= 0) continue;
    const span = (latestMs - new Date(p.end).getTime()) / CAGR_YEAR_MS;
    if (span <= 0.5) continue;
    const diff = Math.abs(new Date(p.end).getTime() - targetMs);
    if (!best || diff < Math.abs(new Date(best.end).getTime() - targetMs)) {
      best = { key: p.key, end: p.end, span };
    }
  }
  // Half a year of slack absorbs 52/53-week calendars without letting a
  // missing year masquerade as the one the column header promises.
  if (!best || Math.abs(best.span - years) > 0.5) return null;
  const past = line.values[best.key];
  if (past == null || past <= 0) return null;
  return Math.pow(now / past, 1 / best.span) - 1;
}

export default function StatementTable({
  statement,
  periods,
  quarterly,
  denominator,
  denominatorLabel,
  currency = "USD",
}: {
  statement: Statement;
  periods: PeriodCol[];
  quarterly: boolean;
  denominator?: LineValues; // revenue (income/cash flow) or total assets (balance)
  denominatorLabel?: string;
  /** The filer's reporting currency — not always USD. */
  currency?: string;
}) {
  const [showAll, setShowAll] = useState(false);
  const [commonSize, setCommonSize] = useState(false);
  const cols = showAll ? periods : periods.slice(0, DEFAULT_COLS);
  const showCagr = !quarterly && !commonSize;
  const yoyIndex = useMemo(() => buildComparisonIndex(periods, YEAR_MS), [periods]);
  const qoqIndex = useMemo(
    () => (quarterly ? buildComparisonIndex(periods, QUARTER_MS) : {}),
    [periods, quarterly]
  );

  if (!statement || statement.lines.length === 0) {
    return (
      <p style={{ fontSize: 14.5, color: "var(--muted)" }}>
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

  return (
    <section>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          marginBottom: 14,
        }}
      >
        <h2 className="h-sub" style={{ fontSize: 22 }}>
          {statement.title}
        </h2>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
          <p style={{ margin: 0, fontSize: 12.5, color: "var(--faint)" }}>{unitsNote}</p>
          {canCommonSize && (
            <div className="rsch-seg" role="group" aria-label="Value basis">
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
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="rsch-table-wrap">
        <table className="rsch-table">
          <caption className="sr-only">
            {statement.title}. {unitsNote}. Periods run newest first
            {showCagr ? ", with compound annual growth rates" : ""}.
          </caption>
          <thead>
            <tr>
              <th scope="col" className="rsch-th-label rsch-sticky">
                Line item
              </th>
              {showCagr &&
                CAGR_SPANS.map((y) => (
                  <th key={y} scope="col" className="rsch-th-cagr">
                    {y}y CAGR
                  </th>
                ))}
              {cols.map((p) => (
                <th key={p.key} scope="col" className="rsch-th-num">
                  {p.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {statement.lines.map((line) => {
              const strong = line.style !== "normal";
              return (
                <tr key={line.key} className={strong ? "is-strong" : undefined}>
                  {/* A row header, not a data cell: it names every value in the
                      row, which is how a screen reader announces them. */}
                  <th
                    scope="row"
                    className={`rsch-td-label rsch-sticky${line.indent ? " rsch-indent" : ""}`}
                  >
                    {line.label}
                    {line.shares && (
                      <span style={{ marginLeft: 5, fontSize: 10.5, color: "var(--faint)" }}>
                        (avg)
                      </span>
                    )}
                  </th>
                  {showCagr &&
                    CAGR_SPANS.map((y) => {
                      const v = cagr(line, periods, y);
                      return (
                        <td key={y} className="rsch-td-cagr">
                          {v == null ? "—" : fmtPct(v)}
                        </td>
                      );
                    })}
                  {cols.map((p) => (
                    <td key={p.key} className="rsch-td-num">
                      {cellValue(line, p)}
                      {!commonSize && (
                        <ChangeCell
                          v={line.yoy[p.key]}
                          cur={line.values[p.key]}
                          prev={comparisonValue(line, yoyIndex, p.key)}
                        />
                      )}
                      {!commonSize && quarterly && (
                        <ChangeCell
                          v={line.qoq[p.key]}
                          cur={line.values[p.key]}
                          prev={comparisonValue(line, qoqIndex, p.key)}
                          suffix=" QoQ"
                          sub
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

      {periods.length > DEFAULT_COLS && (
        <button
          type="button"
          onClick={() => setShowAll(!showAll)}
          className="ctl"
          style={{ marginTop: 14 }}
        >
          {showAll ? "Show fewer periods" : `Show all ${periods.length} periods`}
        </button>
      )}
    </section>
  );
}
