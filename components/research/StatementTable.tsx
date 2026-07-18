"use client";

import { useState } from "react";
import type { Statement, PeriodCol, LineValues } from "@/lib/research/edgar";
import { fmtValue, fmtPct } from "@/lib/research/format";

const DEFAULT_COLS = 8;
const CAGR_SPANS = [3, 5, 10];

function ChangeCell({ v }: { v: number | null }) {
  if (v == null) return null;
  const color = v > 0 ? "var(--up)" : v < 0 ? "var(--down)" : "var(--faint)";
  return (
    <span className="rsch-delta" style={{ color }}>
      {fmtPct(v)}
    </span>
  );
}

function cagr(line: LineValues, periods: PeriodCol[], years: number): number | null {
  const now = line.values[periods[0]?.key];
  const past = line.values[periods[years]?.key];
  if (now == null || past == null || past <= 0 || now <= 0) return null;
  return Math.pow(now / past, 1 / years) - 1;
}

export default function StatementTable({
  statement,
  periods,
  quarterly,
  denominator,
  denominatorLabel,
}: {
  statement: Statement;
  periods: PeriodCol[];
  quarterly: boolean;
  denominator?: LineValues; // revenue (income/cash flow) or total assets (balance)
  denominatorLabel?: string;
}) {
  const [showAll, setShowAll] = useState(false);
  const [commonSize, setCommonSize] = useState(false);
  const cols = showAll ? periods : periods.slice(0, DEFAULT_COLS);
  const showCagr = !quarterly && !commonSize;

  if (!statement || statement.lines.length === 0) {
    return (
      <p style={{ fontSize: 14.5, color: "var(--muted)" }}>
        This company doesn&apos;t report data for this statement.
      </p>
    );
  }

  const canCommonSize = !!denominator;

  function cellValue(line: LineValues, p: PeriodCol): string {
    const v = line.values[p.key];
    if (!commonSize || line.perShare || line.shares) {
      return fmtValue(v, { perShare: line.perShare, shares: line.shares });
    }
    const d = denominator?.values[p.key];
    if (v == null || d == null || d === 0) return "—";
    return ((v / d) * 100).toFixed(1) + "%";
  }

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
          <p style={{ margin: 0, fontSize: 12.5, color: "var(--faint)" }}>
            {commonSize
              ? `Shown as % of ${denominatorLabel}`
              : `USD millions · ${quarterly ? "YoY and QoQ" : "YoY"} change below each value`}
          </p>
          {canCommonSize && (
            <div className="rsch-seg">
              {(
                [
                  ["values", "$"],
                  [
                    "common",
                    `% of ${denominatorLabel === "total assets" ? "assets" : "revenue"}`,
                  ],
                ] as const
              ).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={(mode === "common") === commonSize}
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
          <thead>
            <tr>
              <th className="rsch-th-label rsch-sticky">Line item</th>
              {showCagr &&
                CAGR_SPANS.map((y) => (
                  <th key={y} className="rsch-th-cagr">
                    {y}y CAGR
                  </th>
                ))}
              {cols.map((p) => (
                <th key={p.key} className="rsch-th-num">
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
                  <td
                    className={`rsch-td-label rsch-sticky${line.indent ? " rsch-indent" : ""}`}
                  >
                    {line.label}
                    {line.shares && (
                      <span style={{ marginLeft: 5, fontSize: 10.5, color: "var(--faint)" }}>
                        (avg)
                      </span>
                    )}
                  </td>
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
                      {!commonSize && <ChangeCell v={line.yoy[p.key]} />}
                      {!commonSize && quarterly && line.qoq[p.key] != null && (
                        <span className="rsch-delta-sub">
                          {fmtPct(line.qoq[p.key])} QoQ
                        </span>
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
