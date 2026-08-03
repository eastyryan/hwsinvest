"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ReferenceLine,
} from "recharts";
import type { CompanyFinancials, StatementSet } from "@/lib/research/edgar";
import { fmtValue, fmtPct } from "@/lib/research/format";
import { CHART, AXIS_TICK, TOOLTIP_STYLE } from "./palette";
import usePrefersReducedMotion from "./usePrefersReducedMotion";
import { currencyPrefix, fmtMillions, fmtMoney } from "./currency";

interface PricePayload {
  points: { t: number; c: number }[];
  price: number | null;
  currency: string;
  source?: string;
}

const PRICE_RANGES = ["1y", "5y", "max"] as const;

const EMPTY_STATE: React.CSSProperties = {
  display: "flex",
  height: "100%",
  alignItems: "center",
  justifyContent: "center",
  padding: "0 16px",
  textAlign: "center",
  fontSize: 14,
  color: "var(--muted)",
};

function PriceChart({ ticker }: { ticker: string }) {
  const animate = !usePrefersReducedMotion();
  const [range, setRange] = useState<(typeof PRICE_RANGES)[number]>("5y");
  // Unlike CompanyView, this component is not remounted when `range` changes,
  // so a stale payload could otherwise render under a newly selected range.
  // Tagging each result with the request that produced it makes the current
  // data derivable, which avoids resetting state from inside the effect (a
  // synchronous setState there triggers a cascading render).
  const requestKey = `${ticker}:${range}`;
  const [entry, setEntry] = useState<{
    key: string;
    data: PricePayload | null;
    failed: boolean;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/research/prices/${encodeURIComponent(ticker)}?range=${range}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => !cancelled && setEntry({ key: requestKey, data: d, failed: false }))
      .catch(() => !cancelled && setEntry({ key: requestKey, data: null, failed: true }));
    return () => {
      cancelled = true;
    };
  }, [ticker, range, requestKey]);

  const current = entry?.key === requestKey ? entry : null;
  const data = current?.data ?? null;
  const failed = current?.failed ?? false;

  const hasPoints = !!data && data.points.length > 0;
  const first = data?.points[0]?.c;
  const last = data?.points[data.points.length - 1]?.c;
  const changePct = first && last ? (last - first) / first : null;

  const ccy = data?.currency || "USD";
  const money = (v: number, digits = 2) => fmtMoney(v, ccy, digits);

  const rangeLabel = range === "max" ? "all available history" : `the last ${range}`;
  const chartLabel = hasPoints
    ? `Line chart of ${ticker} closing share price over ${rangeLabel}, in ${ccy}. ` +
      `From ${first?.toFixed(2)} to ${last?.toFixed(2)}` +
      (changePct != null ? `, a change of ${fmtPct(changePct)}.` : ".")
    : "";

  return (
    <section className="rsch-panel">
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 16,
        }}
      >
        <div>
          <p className="rsch-panel-label">
            Stock price{data?.currency ? ` (${data.currency})` : ""}
          </p>
          {data?.price != null ? (
            <p
              className="mono nums"
              style={{ margin: "8px 0 0", fontSize: 30, fontWeight: 600 }}
            >
              {money(data.price)}
              {changePct != null && (
                <span
                  style={{
                    marginLeft: 12,
                    fontSize: 14,
                    fontWeight: 600,
                    color: changePct >= 0 ? "var(--up)" : "var(--down)",
                  }}
                >
                  {fmtPct(changePct)} over {range === "max" ? "all time" : range}
                </span>
              )}
            </p>
          ) : failed || data ? (
            <p style={{ margin: "8px 0 0", fontSize: 14, color: "var(--muted)" }}>
              Price data is temporarily unavailable.
            </p>
          ) : (
            <div className="rsch-skeleton" style={{ marginTop: 10, height: 32, width: 160 }} />
          )}
        </div>
        <div className="rsch-seg" role="group" aria-label="Price history range">
          {PRICE_RANGES.map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={range === r}
              aria-label={r === "max" ? "All available history" : `Last ${r}`}
              onClick={() => setRange(r)}
              style={{ textTransform: "uppercase" }}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div
        style={{ marginTop: 18, height: 260 }}
        role={hasPoints ? "img" : undefined}
        aria-label={hasPoints ? chartLabel : undefined}
      >
        {failed ? (
          <div style={EMPTY_STATE}>
            Price history couldn&apos;t be loaded for {ticker}.
          </div>
        ) : !data ? (
          <div className="rsch-skeleton" style={{ height: "100%" }} />
        ) : !hasPoints ? (
          <div style={EMPTY_STATE}>
            No price history available for {ticker} over this range.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.points} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid stroke={CHART.grid} vertical={false} />
              <XAxis
                dataKey="t"
                tickFormatter={(t) =>
                  new Date(t).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "short",
                  })
                }
                tick={AXIS_TICK}
                axisLine={{ stroke: CHART.grid }}
                tickLine={false}
                minTickGap={60}
              />
              <YAxis
                tick={AXIS_TICK}
                axisLine={false}
                tickLine={false}
                width={56}
                domain={["auto", "auto"]}
                tickFormatter={(v) => currencyPrefix(ccy) + Number(v).toLocaleString("en-US")}
              />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                labelFormatter={(t) =>
                  new Date(Number(t)).toLocaleDateString("en-US", { dateStyle: "medium" })
                }
                formatter={(v) => [money(Number(v)), "Close"]}
              />
              <Line
                type="monotone"
                dataKey="c"
                stroke={CHART.brand}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
                isAnimationActive={animate}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}

function metricOptions(set: StatementSet): { key: string; label: string; group: string }[] {
  const out: { key: string; label: string; group: string }[] = [];
  for (const st of set.statements) {
    for (const line of st.lines) {
      out.push({ key: line.key, label: line.label, group: st.title });
    }
  }
  return out;
}

function MetricChart({ fin, currency }: { fin: CompanyFinancials; currency: string }) {
  const animate = !usePrefersReducedMotion();
  const [freq, setFreq] = useState<"annual" | "quarterly">("annual");
  const [metric, setMetric] = useState("revenue");

  const set = freq === "annual" ? fin.annual : fin.quarterly;
  const options = useMemo(() => metricOptions(set), [set]);
  // Derived from the data, not a hard-coded list: a statement whose title ever
  // changes upstream would otherwise silently vanish from the picker.
  const groups = useMemo(() => [...new Set(options.map((o) => o.group))], [options]);

  // A metric present in the annual statements may be absent from the quarterly
  // ones (and vice versa). Fall back to the first available option so the
  // <select> and the chart never disagree about what is selected.
  const available = useMemo(() => new Set(options.map((o) => o.key)), [options]);
  const activeMetric = available.has(metric) ? metric : (options[0]?.key ?? metric);

  const line = useMemo(() => {
    for (const st of set.statements) {
      const l = st.lines.find((l) => l.key === activeMetric);
      if (l) return l;
    }
    return null;
  }, [set, activeMetric]);

  const data = useMemo(() => {
    if (!line) return [];
    return [...set.periods]
      .reverse() // oldest -> newest, left to right
      .map((p) => ({
        label: p.label,
        value: line.values[p.key],
        yoy: line.yoy[p.key],
      }))
      .filter((d) => d.value != null);
  }, [set, line]);

  const isPerShare = line?.perShare;
  const isShares = line?.shares;

  const unitLabel = isPerShare
    ? `${currency} per share`
    : isShares
      ? "average shares outstanding"
      : `${currency}, millions`;
  const metricChartLabel =
    data.length > 0
      ? `Bar chart of ${line?.label ?? "selected metric"} by ${freq} period, in ${unitLabel}, ` +
        `across ${data.length} periods from ${data[0].label} to ${data[data.length - 1].label}. ` +
        `Earliest value ${fmtValue(data[0].value ?? null, { perShare: isPerShare, shares: isShares })}, ` +
        `latest value ${fmtValue(data[data.length - 1].value ?? null, { perShare: isPerShare, shares: isShares })}.`
      : "";

  return (
    <section className="rsch-panel">
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
        }}
      >
        <div>
          <p className="rsch-panel-label">Chart the statements</p>
          <p className="h-sub" style={{ fontSize: 20, marginTop: 7 }}>
            {line?.label ?? "Pick a metric"}
          </p>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
          <select
            value={activeMetric}
            onChange={(e) => setMetric(e.target.value)}
            aria-label="Metric to chart"
            className="rsch-select"
          >
            {groups.map((group) => (
              <optgroup key={group} label={group}>
                {options
                  .filter((o) => o.group === group)
                  .map((o) => (
                    <option key={o.key} value={o.key}>
                      {o.label}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
          <div className="rsch-seg" role="group" aria-label="Reporting period for this chart">
            {(["annual", "quarterly"] as const).map((f) => (
              <button
                key={f}
                type="button"
                aria-pressed={freq === f}
                onClick={() => setFreq(f)}
                style={{ textTransform: "capitalize" }}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div
        style={{ marginTop: 18, height: 290 }}
        role={data.length > 0 ? "img" : undefined}
        aria-label={data.length > 0 ? metricChartLabel : undefined}
      >
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid stroke={CHART.grid} vertical={false} />
              <XAxis
                dataKey="label"
                tick={AXIS_TICK}
                axisLine={{ stroke: CHART.grid }}
                tickLine={false}
                minTickGap={20}
              />
              <YAxis
                tick={AXIS_TICK}
                axisLine={false}
                tickLine={false}
                width={64}
                tickFormatter={(v) =>
                  fmtValue(Number(v), { perShare: isPerShare, shares: isShares })
                }
              />
              <Tooltip
                cursor={{ fill: "rgba(75,46,131,0.06)" }}
                contentStyle={TOOLTIP_STYLE}
                formatter={(v, _name, item) => {
                  const yoy = (item?.payload as { yoy?: number | null })?.yoy;
                  // "(1,234)M" put the unit outside the accounting parentheses
                  // and hard-coded a dollar sign for per-share figures.
                  const base = isPerShare
                    ? fmtMoney(Number(v), currency)
                    : isShares
                      ? fmtValue(Number(v), { shares: true })
                      : fmtMillions(Number(v), currency);
                  return [yoy != null ? `${base}  (${fmtPct(yoy)} YoY)` : base, line?.label];
                }}
              />
              <ReferenceLine y={0} stroke={CHART.muted} strokeWidth={1} />
              <Bar
                dataKey="value"
                radius={[4, 4, 0, 0]}
                maxBarSize={40}
                isAnimationActive={animate}
              >
                {data.map((d, i) => (
                  <Cell key={i} fill={(d.value ?? 0) < 0 ? CHART.negative : CHART.brand} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div style={EMPTY_STATE}>No data for this metric.</div>
        )}
      </div>
      <p className="rsch-note">
        {isPerShare
          ? `${currency} per share`
          : isShares
            ? "Average shares outstanding"
            : `${currency} millions`}
        , {freq}. Values as filed with the SEC.
      </p>
    </section>
  );
}

// --- Price vs fundamentals ---------------------------------------------------

function findLine(set: CompanyFinancials["quarterly"], key: string) {
  for (const st of set.statements) {
    const l = st.lines.find((l) => l.key === key);
    if (l) return l;
  }
  return null;
}

/** Trailing-twelve-month value at each quarter end (oldest -> newest). */
function ttmSeries(fin: CompanyFinancials, key: string): { t: number; v: number }[] {
  const set = fin.quarterly;
  const line = findLine(set, key);
  if (!line) return [];
  const periods = [...set.periods].reverse(); // oldest first
  const out: { t: number; v: number }[] = [];
  for (let i = 3; i < periods.length; i++) {
    let sum = 0;
    let ok = true;
    for (let k = i - 3; k <= i; k++) {
      const v = line.values[periods[k].key];
      if (v == null) {
        ok = false;
        break;
      }
      sum += v;
    }
    if (ok) out.push({ t: new Date(periods[i].end).getTime(), v: sum });
  }
  return out;
}

const FUND_OPTIONS = [
  { key: "pe", label: "P/E ratio (price / TTM EPS)" },
  { key: "eps", label: "TTM EPS" },
  { key: "revenue", label: "TTM Revenue" },
  { key: "netIncome", label: "TTM Net Income" },
] as const;
type FundKey = (typeof FUND_OPTIONS)[number]["key"];

function PriceVsFundamentals({
  fin,
  currency,
}: {
  fin: CompanyFinancials;
  currency: string;
}) {
  const animate = !usePrefersReducedMotion();
  const [fund, setFund] = useState<FundKey>("pe");
  const [prices, setPrices] = useState<{ t: number; c: number }[] | null>(null);
  const [priceCurrency, setPriceCurrency] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/research/prices/${encodeURIComponent(fin.ticker)}?range=5y`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: PricePayload) => {
        if (cancelled) return;
        setPrices(d.points);
        setPriceCurrency(d.currency ?? null);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [fin.ticker]);

  const data = useMemo(() => {
    if (!prices || prices.length === 0) return [];
    const eps = ttmSeries(fin, "epsDiluted");
    const rev = ttmSeries(fin, "revenue");
    const ni = ttmSeries(fin, "netIncome");
    const pick = (series: { t: number; v: number }[], t: number): number | null => {
      let best: number | null = null;
      for (const s of series) {
        if (s.t <= t) best = s.v;
        else break;
      }
      return best;
    };
    return prices.map((p) => {
      const e = pick(eps, p.t);
      let f: number | null = null;
      if (fund === "pe") f = e != null && e > 0 ? p.c / e : null;
      else if (fund === "eps") f = e;
      else if (fund === "revenue") f = pick(rev, p.t);
      else f = pick(ni, p.t);
      return { t: p.t, price: p.c, fund: f };
    });
  }, [prices, fin, fund]);

  const fundLabel = FUND_OPTIONS.find((f) => f.key === fund)!.label;
  const fundIsDollarsM = fund === "revenue" || fund === "netIncome";
  // P/E and per-share figures are meaningless if price and filings use
  // different currencies — say so rather than quietly mixing them.
  const mixedCurrency = priceCurrency != null && priceCurrency !== currency;
  // The price axis is quoted in the exchange's currency; the fundamentals axis
  // in the filer's. They are not always the same, and neither is always USD.
  const priceCcy = priceCurrency ?? currency;

  const dateFmt = (t: unknown) =>
    new Date(Number(t)).toLocaleDateString("en-US", { year: "numeric", month: "short" });

  return (
    <section className="rsch-panel">
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
        }}
      >
        <div>
          <p className="rsch-panel-label">Price vs fundamentals</p>
          <p className="h-sub" style={{ fontSize: 20, marginTop: 7 }}>
            Stock price over {fundLabel}
          </p>
        </div>
        <select
          value={fund}
          onChange={(e) => setFund(e.target.value as FundKey)}
          aria-label="Fundamental to chart under the price"
          className="rsch-select"
        >
          {FUND_OPTIONS.map((f) => (
            <option key={f.key} value={f.key}>
              {f.label}
            </option>
          ))}
        </select>
      </div>

      {failed ? (
        <p className="rsch-note">
          Price data is temporarily unavailable, so this chart can&apos;t render.
        </p>
      ) : prices === null ? (
        // Still fetching — the skeleton only belongs in this branch.
        <div className="rsch-skeleton" style={{ marginTop: 18, height: 160 }} />
      ) : prices.length === 0 ? (
        <p className="rsch-note">
          No price history is available for {fin.ticker}, so this chart can&apos;t render.
        </p>
      ) : data.length === 0 ? (
        <p className="rsch-note">
          Not enough overlapping filing data to chart {fundLabel} against the price.
        </p>
      ) : (
        <>
          {/* Two aligned panels sharing the same time axis — never a dual-axis chart */}
          <div
            style={{ marginTop: 18, height: 176 }}
            role="img"
            aria-label={`Line chart of ${fin.ticker} share price over the last five years, shown above a matching chart of ${fundLabel}.`}
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={data}
                margin={{ top: 4, right: 8, bottom: 0, left: 0 }}
                syncId="pvf"
              >
                <CartesianGrid stroke={CHART.grid} vertical={false} />
                <XAxis dataKey="t" hide />
                <YAxis
                  tick={AXIS_TICK}
                  tickLine={false}
                  axisLine={false}
                  width={56}
                  domain={["auto", "auto"]}
                  tickFormatter={(v) =>
                    currencyPrefix(priceCcy) + Number(v).toLocaleString("en-US")
                  }
                />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  labelFormatter={dateFmt}
                  formatter={(v) => [fmtMoney(Number(v), priceCcy), "Price"]}
                />
                <Line
                  type="monotone"
                  dataKey="price"
                  stroke={CHART.brand}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={animate}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div
            style={{ height: 176 }}
            role="img"
            aria-label={`Line chart of ${fundLabel} for ${fin.ticker} over the last five years, stepping at each quarter end, aligned to the price chart above.`}
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={data}
                margin={{ top: 4, right: 8, bottom: 0, left: 0 }}
                syncId="pvf"
              >
                <CartesianGrid stroke={CHART.grid} vertical={false} />
                <XAxis
                  dataKey="t"
                  tick={AXIS_TICK}
                  tickLine={false}
                  axisLine={{ stroke: CHART.grid }}
                  tickFormatter={dateFmt}
                  minTickGap={60}
                />
                <YAxis
                  tick={AXIS_TICK}
                  tickLine={false}
                  axisLine={false}
                  width={56}
                  domain={["auto", "auto"]}
                  tickFormatter={(v) =>
                    fund === "pe"
                      ? Number(v).toFixed(0) + "x"
                      : fund === "eps"
                        ? fmtMoney(Number(v), currency, 1)
                        : fmtValue(Number(v))
                  }
                />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  labelFormatter={dateFmt}
                  formatter={(v) => [
                    fund === "pe"
                      ? Number(v).toFixed(1) + "x"
                      : fund === "eps"
                        ? fmtMoney(Number(v), currency)
                        : fmtMillions(Number(v), currency),
                    fundLabel,
                  ]}
                />
                <Line
                  type="stepAfter"
                  dataKey="fund"
                  stroke={CHART.orange}
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                  isAnimationActive={animate}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="rsch-note">
            {/* The units clause is conditional, so the sentence has to be able
                to start without it — it used to read "fundamentals step…". */}
            {fundIsDollarsM
              ? `Fundamental shown in ${currency} millions. Fundamentals step `
              : "Fundamentals step "}
            at each quarter end. When price rises faster than the line below it,
            you&apos;re paying more per unit of results.
            {mixedCurrency && (
              <>
                {" "}
                Note: the price is quoted in {priceCurrency} while the filings report in{" "}
                {currency}, so the ratio is not currency-adjusted.
              </>
            )}
          </p>
        </>
      )}
    </section>
  );
}

export default function ChartsPanel({
  fin,
  currency = "USD",
}: {
  fin: CompanyFinancials;
  /** The filer's reporting currency for statement values — not always USD. */
  currency?: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <PriceChart ticker={fin.ticker} />
      <PriceVsFundamentals fin={fin} currency={currency} />
      <MetricChart fin={fin} currency={currency} />
    </div>
  );
}
