"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import usePrefersReducedMotion from "./usePrefersReducedMotion";
import { fmtMillions, fmtMoney } from "./currency";

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

const MAX_OTHERS = SERIES.length - 1; // base company owns slot 0

// A second visual channel so series aren't distinguished by color alone.
const SERIES_DASH: (string | undefined)[] = [undefined, "6 4", "2 4"];
const DASH_DESCRIPTION = ["solid", "dashed", "dotted"];

/** The financials payload carries the filer's reporting currency. */
type ComparableCompany = CompanyFinancials & { currency?: string };

const currencyOf = (c: ComparableCompany) => c.currency || "USD";

function findLine(set: StatementSet, key: string) {
  for (const st of set.statements) {
    const l = st.lines.find((l) => l.key === key);
    if (l) return l;
  }
  return null;
}

export default function Compare({ base }: { base: ComparableCompany }) {
  const animate = !usePrefersReducedMotion();
  const [others, setOthers] = useState<ComparableCompany[]>([]);
  const [loading, setLoading] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [metric, setMetric] = useState("revenue");
  const [view, setView] = useState<ViewMode>("value");

  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  async function addCompany(r: { cik: string; ticker: string; name: string }) {
    if (others.length >= MAX_OTHERS) return;
    if (r.ticker === base.ticker || others.some((o) => o.ticker === r.ticker)) return;
    setLoading(r.ticker);
    setFailed(null);
    try {
      const res = await fetch(
        `/api/research/financials/${r.cik}?ticker=${encodeURIComponent(r.ticker)}`
      );
      if (!res.ok) throw new Error();
      const fin = (await res.json()) as ComparableCompany;
      if (!mounted.current) return;
      // Functional update: `others` captured above is pre-update, so two fast
      // selections would both append and overflow the series palette. Re-check
      // the cap and the duplicate guard against the latest state.
      setOthers((prev) => {
        if (prev.length >= MAX_OTHERS) return prev;
        if (prev.some((o) => o.ticker === fin.ticker)) return prev;
        return [...prev, fin];
      });
    } catch {
      if (mounted.current) setFailed(r.ticker);
    } finally {
      if (mounted.current) setLoading(null);
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

  // Values are compared as filed, with no FX conversion, so mixing reporting
  // currencies makes the absolute-value view misleading.
  const currencies = [...new Set(companies.map(currencyOf))];
  const mixedCurrency = currencies.length > 1;
  const valueUnitLabel = mixedCurrency
    ? "mixed currencies, millions"
    : isPerShare
      ? `${currencies[0]} per share`
      : `${currencies[0]} millions`;

  const compareChartLabel =
    data.length > 0
      ? `Line chart comparing ${metricLabel} ` +
        (view === "yoy" ? "year-over-year growth" : `in ${valueUnitLabel}`) +
        ` by fiscal year from ${data[0].year} to ${data[data.length - 1].year}, for ` +
        companies
          .map((c, i) => `${c.ticker} (${DASH_DESCRIPTION[i] ?? "solid"} line)`)
          .join(", ") +
        "."
      : "";

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
        {others.length < MAX_OTHERS ? (
          <div style={{ width: "100%", maxWidth: 320 }}>
            <SearchBox
              onSelect={addCompany}
              placeholder="Add a company to compare"
              disabled={loading !== null}
            />
          </div>
        ) : (
          // The picker disappearing with no explanation reads as a bug.
          <p className="rsch-note" style={{ margin: 0 }}>
            Comparing the maximum of three companies. Remove one to add another.
          </p>
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
            <svg width="18" height="10" viewBox="0 0 18 10" aria-hidden focusable="false">
              <line
                x1="0"
                y1="5"
                x2="18"
                y2="5"
                stroke={SERIES[i]}
                strokeWidth="2.5"
                strokeDasharray={SERIES_DASH[i]}
              />
            </svg>
            <span className="mono" style={{ fontSize: 12, fontWeight: 700 }}>
              {c.ticker}
            </span>
            <span className="sr-only">{DASH_DESCRIPTION[i] ?? "solid"} line</span>
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
                aria-label={`Remove ${c.ticker} from the comparison`}
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
        {/* Loading and failure are the result of an action the user just took,
            so they have to reach a screen reader without moving focus. */}
        <span
          role="status"
          aria-live="polite"
          style={{ fontSize: 12.5, color: "var(--muted)" }}
        >
          {loading ? `Loading ${loading}…` : ""}
        </span>
        {failed && (
          <span role="alert" style={{ fontSize: 12.5, color: "var(--down)" }}>
            Couldn&apos;t load {failed}
          </span>
        )}
      </div>

      {mixedCurrency && view === "value" && (
        <p
          style={{
            margin: 0,
            padding: "10px 13px",
            borderRadius: 10,
            border: "1px solid var(--yellow)",
            background: "#fdf6e7",
            color: "var(--orangeText)",
            fontSize: 12.5,
            lineHeight: 1.55,
          }}
        >
          These companies report in different currencies ({currencies.join(", ")}). Values
          are shown as filed with no exchange-rate conversion, so absolute figures
          aren&apos;t directly comparable &mdash; YoY growth % is.
        </p>
      )}

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
        <div className="rsch-seg" role="group" aria-label="Comparison basis">
          {(
            [
              ["value", valueUnitLabel],
              ["yoy", "YoY growth %"],
            ] as const
          ).map(([v, label]) => (
            <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div
        className="rsch-panel"
        style={{ height: 340, padding: 16 }}
        role={data.length > 0 ? "img" : undefined}
        aria-label={data.length > 0 ? compareChartLabel : undefined}
      >
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
                formatter={(v, name) => {
                  const ticker = String(name);
                  const ccy = currencyOf(
                    companies.find((c) => c.ticker === ticker) ?? base
                  );
                  return [
                    view === "yoy"
                      ? fmtPct(Number(v))
                      : isPerShare
                        ? fmtMoney(Number(v), ccy)
                        : fmtMillions(Number(v), ccy),
                    ticker,
                  ];
                }}
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
                  strokeDasharray={SERIES_DASH[i]}
                  dot={{ r: 3 }}
                  connectNulls
                  isAnimationActive={animate}
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
          <caption className="sr-only">
            Most recent reported fiscal year for each company, side by side. Fiscal
            year ends differ between companies, so each column is labelled with its
            own period. Values in millions of the currency each company reports in,
            except EPS, which is per share.
          </caption>
          <thead>
            <tr>
              <th scope="col" className="rsch-th-label">
                Latest fiscal year
              </th>
              {companies.map((c) => (
                <th key={c.ticker} scope="col" className="rsch-th-num">
                  {c.ticker}
                  {/* Fiscal years don't line up across companies — labelling
                      the whole column "latest" invited an apples-to-oranges
                      read of, say, a September filer next to a December one. */}
                  <span
                    style={{
                      display: "block",
                      fontFamily: "inherit",
                      fontSize: 10,
                      fontWeight: 400,
                      color: "var(--faint)",
                    }}
                  >
                    {c.annual.periods[0]?.label ?? "no data"} · {currencyOf(c)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {METRICS.map((m) => {
              const perShare = m.key === "epsDiluted";
              return (
                <tr key={m.key}>
                  <th scope="row" className="rsch-td-label">
                    {m.label}{" "}
                    <span style={{ fontSize: 10.5, color: "var(--faint)" }}>
                      {perShare ? "(per share)" : "(millions)"}
                    </span>
                  </th>
                  {companies.map((c) => {
                    const line = findLine(c.annual, m.key);
                    const p = c.annual.periods[0];
                    const v = line && p ? line.values[p.key] : null;
                    return (
                      <td key={c.ticker} className="rsch-td-num">
                        {fmtValue(v, { perShare })}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
