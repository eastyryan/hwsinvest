"use client";

import { useMemo, useState } from "react";
import type { CompanyFinancials } from "@/lib/research/edgar";
import { buildRatios } from "@/lib/research/ratios";

function fmtRatio(v: number | null, format: "pct" | "x"): string {
  if (v == null) return "—";
  return format === "pct" ? (v * 100).toFixed(1) + "%" : v.toFixed(2) + "x";
}

export default function RatiosTable({
  fin,
  freq,
  maxCols,
}: {
  fin: CompanyFinancials;
  freq: "annual" | "quarterly";
  maxCols: number;
}) {
  const ratios = useMemo(() => buildRatios(fin, freq), [fin, freq]);
  const [showAll, setShowAll] = useState(false);
  const cols = showAll ? ratios.periods : ratios.periods.slice(0, maxCols);

  if (ratios.lines.length === 0) {
    return (
      <p style={{ fontSize: 14.5, color: "var(--muted)" }}>
        Not enough reported data to compute ratios for this company.
      </p>
    );
  }

  return (
    <section>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 16,
          marginBottom: 14,
        }}
      >
        <h2 className="h-sub" style={{ fontSize: 22 }}>
          Ratios &amp; Returns
        </h2>
        <p style={{ margin: 0, fontSize: 12.5, color: "var(--faint)" }}>
          {freq === "quarterly"
            ? "Trailing-twelve-month figures at each quarter end"
            : "Fiscal-year figures"}
        </p>
      </div>

      <div className="rsch-table-wrap">
        <table className="rsch-table">
          <thead>
            <tr>
              <th className="rsch-th-label rsch-sticky" style={{ minWidth: 230 }}>
                Ratio
              </th>
              {cols.map((p) => (
                <th key={p.key} className="rsch-th-num" style={{ minWidth: 96 }}>
                  {p.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ratios.lines.map((line) => (
              <tr key={line.key}>
                <td className="rsch-td-label rsch-sticky">
                  <span style={{ fontWeight: 600, color: "var(--text)" }}>{line.label}</span>
                  {line.note && (
                    <span
                      style={{
                        display: "block",
                        fontSize: 10.5,
                        lineHeight: 1.35,
                        color: "var(--faint)",
                      }}
                    >
                      {line.note}
                    </span>
                  )}
                </td>
                {cols.map((p) => (
                  <td key={p.key} className="rsch-td-num">
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
          className="ctl"
          style={{ marginTop: 14 }}
        >
          {showAll ? "Show fewer periods" : `Show all ${ratios.periods.length} periods`}
        </button>
      )}
    </section>
  );
}
