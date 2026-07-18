"use client";

import { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import type { CompanyFinancials, StatementSet } from "@/lib/research/edgar";
import { fmtValue, fmtPct } from "@/lib/research/format";
import { CHART, SERIES, AXIS_TICK, TOOLTIP_STYLE } from "./palette";
import SearchBox from "./SearchBox";

const METRICS: { key: string; label: string }[] = [
  { key: "revenue", label: "Revenue" },
  { key: "grossProfit", label: "Gross Profit" },
  { key: "operatingIncome", label: "Operating Income" },
  { key: "netIncome", label: "Net Income" },
  { key: "fcf", label: "Free Cash Flow" },
  { key: "totalAssets", label: "Total Assets" },
  { key: "epsDiluted", label: "EPS (Diluted)" },
];

type ViewMode = "value" | "yoy";

function findLine(set: StatementSet, key: string) {
  for (const st of set.statements) {
    const l = st.lines.find((l) => l.key === key);
    if (l) return l;
  }
  return null;
}

export default function Compare({ base }: { base: CompanyFinancials }) {
  const [others, setOthers] = useState<CompanyFinancials[]>([]);
  const [loading, setLoading] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [metric, setMetric] = useState("revenue");
  const [view, setView] = useState<ViewMode>("value");

  async function addCompany(r: { cik: string; ticker: string; name: string }) {
    if (others.length >= 2) return;
    if (r.ticker === base.ticker || others.some((o) => o.ticker === r.ticker)) return;
    setLoading(r.ticker);
    setFailed(null);
    try {
      const res = await fetch(
        `/api/research/financials/${r.cik}?ticker=${encodeURIComponent(r.ticker)}`
      );
      if (!res.ok) throw new Error();
      const fin = (await res.json()) as CompanyFinancials;
      setOthers((prev) => [...prev, fin]);
    } catch {
      setFailed(r.ticker);
    } finally {
      setLoading(null);
    }
  }

  const companies = useMemo(() => [base, ...others], [base, others]);
  const isPerShare = metric === "epsDiluted";

  // Merge each company's annual series onto a shared fiscal-year axis.
  const data = useMemo(() => {
    const byYear = new Map<number, Record<string, number | null>>();
    for (const c of companies) {
      const line = findLine(c.annual, metric);
      if (!line) continue;
      for (const p of c.annual.periods) {
        const year = new Date(p.end).getUTCFullYear();
        const v = view === "value" ? line.values[p.key] : line.yoy[p.key];
        if (v == null) continue;
        const row = byYear.get(year) ?? {};
        row[c.ticker] = v;
        byYear.set(year, row);
      }
    }
    return [...byYear.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([year, vals]) => ({ year, ...vals }));
  }, [companies, metric, view]);

  const metricLabel = METRICS.find((m) => m.key === metric)?.label ?? metric;

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 16,
        }}
      >
        <div>
          <h2 className="h-sub" style={{ fontSize: 22 }}>
            Compare companies
          </h2>
          <p className="rsch-note" style={{ marginTop: 5 }}>
            {base.ticker} vs up to two others, by fiscal year
          </p>
        </div>
        {others.length < 2 && (
          <div style={{ width: "100%", maxWidth: 320 }}>
            <SearchBox onSelect={addCompany} placeholder="Add a company to compare" />
          </div>
        )}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
        {companies.map((c, i) => (
          <span
            key={c.ticker}
            className="card"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 9,
              padding: "7px 12px",
              borderRadius: 10,
              fontSize: 13.5,
            }}
          >
            <span
              aria-hidden
              style={{
                height: 10,
                width: 10,
                borderRadius: "50%",
                background: SERIES[i],
                flexShrink: 0,
              }}
            />
            <span className="mono" style={{ fontSize: 12, fontWeight: 700 }}>
              {c.ticker}
            </span>
            <span
              style={{
                color: "var(--muted)",
                maxWidth: 160,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {c.name}
            </span>
            {i > 0 && (
              <button
                type="button"
                onClick={() => setOthers((prev) => prev.filter((o) => o.ticker !== c.ticker))}
                aria-label={`Remove ${c.ticker}`}
                style={{
                  border: "none",
                  background: "none",
                  cursor: "pointer",
                  color: "var(--faint)",
                  fontSize: 16,
                  lineHeight: 1,
                  padding: 0,
                  marginLeft: 2,
                }}
              >
                &times;
              </button>
            )}
          </span>
        ))}
        {loading && (
          <span style={{ fontSize: 12.5, color: "var(--muted)" }}>Loading {loading}&hellip;</span>
        )}
        {failed && (
          <span style={{ fontSize: 12.5, color: "var(--down)" }}>
            Couldn&apos;t load {failed}
          </span>
        )}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
        <select
          value={metric}
          onChange={(e) => setMetric(e.target.value)}
          aria-label="Metric to compare"
          className="rsch-select"
        >
          {METRICS.map((m) => (
            <option key={m.key} value={m.key}>
              {m.label}
            </option>
          ))}
        </select>
        <div className="rsch-seg">
          {(
            [
              ["value", isPerShare ? "$ per share" : "$ millions"],
              ["yoy", "YoY growth %"],
            ] as const
          ).map(([v, label]) => (
            <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="rsch-panel" style={{ height: 340, padding: 16 }}>
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid stroke={CHART.grid} vertical={false} />
              <XAxis
                dataKey="year"
                tick={AXIS_TICK}
                axisLine={{ stroke: CHART.grid }}
                tickLine={false}
              />
              <YAxis
                tick={AXIS_TICK}
                axisLine={false}
                tickLine={false}
                width={64}
                tickFormatter={(v) =>
                  view === "yoy"
                    ? (Number(v) * 100).toFixed(0) + "%"
                    : fmtValue(Number(v), { perShare: isPerShare })
                }
              />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                formatter={(v, name) => [
                  view === "yoy"
                    ? fmtPct(Number(v))
                    : fmtValue(Number(v), { perShare: isPerShare }) + (isPerShare ? "" : "M"),
                  String(name),
                ]}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {companies.map((c, i) => (
                <Line
                  key={c.ticker}
                  type="monotone"
                  dataKey={c.ticker}
                  name={c.ticker}
                  stroke={SERIES[i]}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div
            style={{
              display: "flex",
              height: "100%",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 14,
              color: "var(--muted)",
            }}
          >
            No overlapping data for {metricLabel}.
          </div>
        )}
      </div>

      {/* Latest-year side-by-side stats */}
      <div className="rsch-table-wrap">
        <table className="rsch-table">
          <thead>
            <tr>
              <th className="rsch-th-label">Latest fiscal year</th>
              {companies.map((c) => (
                <th key={c.ticker} className="rsch-th-num">
                  {c.ticker}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {METRICS.map((m) => (
              <tr key={m.key}>
                <td className="rsch-td-label">{m.label}</td>
                {companies.map((c) => {
                  const line = findLine(c.annual, m.key);
                  const p = c.annual.periods[0];
                  const v = line && p ? line.values[p.key] : null;
                  return (
                    <td key={c.ticker} className="rsch-td-num">
                      {fmtValue(v, { perShare: m.key === "epsDiluted" })}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
