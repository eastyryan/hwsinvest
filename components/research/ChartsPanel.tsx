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
  ComposedChart,
  Legend,
} from "recharts";
import type { CompanyFinancials } from "@/lib/research/edgar";
import { buildRatios } from "@/lib/research/ratios";
import { fmtValue, fmtPct } from "@/lib/research/format";
import MetricPicker, {
  STATEMENT_METRIC_GROUPS,
  getStatementMetric,
  type MetricGroup,
} from "./MetricPicker";
import useIsDark from "./useIsDark";
import usePrefersReducedMotion from "./usePrefersReducedMotion";
import { currencyPrefix, fmtMillions, fmtMoney } from "./currency";
import { btnSegmentedCompact, btnSegmentedCompactItem } from "./ui/buttonStyles";

// Chart palette: one accent hue for lines/bars, semantic red for negatives.
const ACCENT = { light: "#2563eb", dark: "#60a5fa" };
const NEGATIVE = { light: "#dc2626", dark: "#f87171" };
const GRID = { light: "#e4e4e7", dark: "#27272a" };
const INK_MUTED = { light: "#71717a", dark: "#a1a1aa" };

interface PricePayload {
  points: { t: number; c: number }[];
  price: number | null;
  currency: string;
  source?: string;
}

const PRICE_RANGES = ["1y", "5y", "max"] as const;

function PriceChart({ ticker }: { ticker: string }) {
  const dark = useIsDark();
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

  const mode = dark ? "dark" : "light";
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
    <section className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
            Share price{data?.currency ? ` (${data.currency})` : ""}
          </h2>
          {data?.price != null ? (
            <p className="mt-1 font-mono text-3xl font-semibold tabular-nums">
              {money(data.price)}
              {changePct != null && (
                <span
                  className={`ml-3 text-sm font-medium ${
                    changePct >= 0
                      ? "text-emerald-700 dark:text-emerald-400"
                      : "text-red-700 dark:text-red-400"
                  }`}
                >
                  {fmtPct(changePct)} over {range === "max" ? "all time" : range}
                </span>
              )}
            </p>
          ) : failed || data ? (
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Price data is temporarily unavailable.
            </p>
          ) : (
            <div className="mt-2 h-8 w-40 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
          )}
        </div>
        <div
          className={btnSegmentedCompact}
          role="group"
          aria-label="Price history range"
        >
          {PRICE_RANGES.map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={range === r}
              aria-label={r === "max" ? "All available history" : `Last ${r}`}
              onClick={() => setRange(r)}
              className={`${btnSegmentedCompactItem(range === r)} uppercase`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>
      <div
        className="mt-4 h-64"
        role={hasPoints ? "img" : undefined}
        aria-label={hasPoints ? chartLabel : undefined}
      >
        {failed ? (
          <div className="flex h-full items-center justify-center px-4 text-center text-sm text-zinc-500 dark:text-zinc-400">
            Price history couldn&apos;t be loaded for {ticker}.
          </div>
        ) : !data ? (
          <div className="h-full animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
        ) : !hasPoints ? (
          <div className="flex h-full items-center justify-center px-4 text-center text-sm text-zinc-500 dark:text-zinc-400">
            No price history available for {ticker} over this range.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.points} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid stroke={GRID[mode]} vertical={false} />
              <XAxis
                dataKey="t"
                tickFormatter={(t) =>
                  new Date(t).toLocaleDateString("en-US", { year: "numeric", month: "short" })
                }
                tick={{ fill: INK_MUTED[mode], fontSize: 11 }}
                axisLine={{ stroke: GRID[mode] }}
                tickLine={false}
                minTickGap={60}
              />
              <YAxis
                tick={{ fill: INK_MUTED[mode], fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={56}
                domain={["auto", "auto"]}
                tickFormatter={(v) => currencyPrefix(ccy) + Number(v).toLocaleString("en-US")}
              />
              <Tooltip
                contentStyle={{
                  background: dark ? "#18181b" : "#ffffff",
                  border: `1px solid ${GRID[mode]}`,
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelFormatter={(t) => new Date(Number(t)).toLocaleDateString("en-US", { dateStyle: "medium" })}
                formatter={(v) => [money(Number(v)), "Close"]}
              />
              <Line
                type="monotone"
                dataKey="c"
                stroke={ACCENT[mode]}
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

function MetricChart({ fin, currency }: { fin: CompanyFinancials; currency: string }) {
  const dark = useIsDark();
  const mode = dark ? "dark" : "light";
  const animate = !usePrefersReducedMotion();
  const [freq, setFreq] = useState<"annual" | "quarterly">("annual");
  const [metric, setMetric] = useState("revenue");

  const set = freq === "annual" ? fin.annual : fin.quarterly;
  const ratios = useMemo(() => buildRatios(fin, freq), [fin, freq]);
  const metricDef = getStatementMetric(metric);

  // Keys present in this frequency (statement lines + ratio lines with data).
  const allowedKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const st of set.statements) {
      for (const line of st.lines) keys.add(line.key);
    }
    for (const line of ratios.lines) {
      if (Object.values(line.values).some((v) => v != null)) keys.add(line.key);
    }
    return keys;
  }, [set, ratios]);

  // Fall back when switching annual ↔ quarterly loses the current metric.
  const activeMetric = allowedKeys.has(metric)
    ? metric
    : ([...allowedKeys][0] ?? metric);
  const activeDef = getStatementMetric(activeMetric) ?? metricDef;
  const isRatio = activeDef?.kind === "ratio";

  const line = useMemo(() => {
    if (isRatio) return null;
    for (const st of set.statements) {
      const l = st.lines.find((l) => l.key === activeMetric);
      if (l) return l;
    }
    return null;
  }, [set, activeMetric, isRatio]);

  const ratioLine = useMemo(() => {
    if (!isRatio) return null;
    return ratios.lines.find((l) => l.key === activeMetric) ?? null;
  }, [ratios, activeMetric, isRatio]);

  const data = useMemo(() => {
    if (isRatio && ratioLine) {
      return [...ratios.periods]
        .reverse()
        .map((p) => ({
          label: p.label,
          value: ratioLine.values[p.key],
          yoy: null as number | null,
        }))
        .filter((d) => d.value != null);
    }
    if (!line) return [];
    return [...set.periods]
      .reverse()
      .map((p) => ({
        label: p.label,
        value: line.values[p.key],
        yoy: line.yoy[p.key],
      }))
      .filter((d) => d.value != null);
  }, [set, line, isRatio, ratioLine, ratios.periods]);

  const isPerShare = !isRatio && !!line?.perShare;
  const isShares = !isRatio && !!line?.shares;
  const isPct = activeDef?.format === "pct";
  const isMultiple = activeDef?.format === "x";
  const label = activeDef?.label ?? line?.label ?? "Pick a metric";

  const unitLabel = isPct
    ? "percent"
    : isMultiple
      ? "multiple"
      : isPerShare
        ? `${currency} per share`
        : isShares
          ? "average shares outstanding"
          : `${currency}, millions`;
  const metricChartLabel =
    data.length > 0
      ? `Bar chart of ${label} by ${freq} period, in ${unitLabel}, ` +
        `across ${data.length} periods from ${data[0].label} to ${data[data.length - 1].label}.`
      : "";

  return (
    <section className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
            Chart the statements
          </h2>
          <p className="mt-1 text-lg font-semibold tracking-tight">{label}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <MetricPicker
            value={activeMetric}
            onChange={setMetric}
            groups={STATEMENT_METRIC_GROUPS}
            allowedKeys={allowedKeys}
            ariaLabel="Metric to chart"
          />
          <div
            className={btnSegmentedCompact}
            role="group"
            aria-label="Reporting period for this chart"
          >
            {(
              [
                ["annual", "Annual"],
                ["quarterly", "Quarterly"],
              ] as const
            ).map(([f, label]) => (
              <button
                key={f}
                type="button"
                aria-pressed={freq === f}
                onClick={() => setFreq(f)}
                className={btnSegmentedCompactItem(freq === f)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div
        className="mt-4 h-72"
        role={data.length > 0 ? "img" : undefined}
        aria-label={data.length > 0 ? metricChartLabel : undefined}
      >
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid stroke={GRID[mode]} vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: INK_MUTED[mode], fontSize: 11 }}
                axisLine={{ stroke: GRID[mode] }}
                tickLine={false}
                minTickGap={20}
              />
              <YAxis
                tick={{ fill: INK_MUTED[mode], fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={64}
                tickFormatter={(v) => {
                  if (isPct) return (Number(v) * 100).toFixed(0) + "%";
                  if (isMultiple) return Number(v).toFixed(1) + "×";
                  return fmtValue(Number(v), { perShare: isPerShare, shares: isShares });
                }}
              />
              <Tooltip
                cursor={{ fill: dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)" }}
                contentStyle={{
                  background: dark ? "#18181b" : "#ffffff",
                  border: `1px solid ${GRID[mode]}`,
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(v, _name, item) => {
                  const yoy = (item?.payload as { yoy?: number | null })?.yoy;
                  let base: string;
                  if (isPct) base = (Number(v) * 100).toFixed(1) + "%";
                  else if (isMultiple) base = Number(v).toFixed(2) + "×";
                  else if (isPerShare) base = fmtMoney(Number(v), currency);
                  else if (isShares) base = fmtValue(Number(v), { shares: true });
                  else base = fmtMillions(Number(v), currency);
                  return [yoy != null ? `${base}  (${fmtPct(yoy)} YoY)` : base, label];
                }}
              />
              <ReferenceLine y={0} stroke={INK_MUTED[mode]} strokeWidth={1} />
              <Bar
                dataKey="value"
                radius={[4, 4, 0, 0]}
                maxBarSize={40}
                isAnimationActive={animate}
              >
                {data.map((d, i) => (
                  <Cell
                    key={i}
                    fill={(d.value ?? 0) < 0 ? NEGATIVE[mode] : ACCENT[mode]}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-zinc-500 dark:text-zinc-400">
            No data for this metric.
          </div>
        )}
      </div>
      <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
        {isPct
          ? "Percent"
          : isMultiple
            ? "Multiple"
            : isPerShare
              ? `${currency} per share`
              : isShares
                ? "Average shares outstanding"
                : `${currency} millions`}
        , {freq}. Values as filed with the SEC
        {isRatio ? " (ratios from the same statements)" : ""}.
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

type FundUnit = "x" | "perShare" | "millions" | "pct";
type FundKey =
  | "pe"
  | "eps"
  | "revenue"
  | "netIncome"
  | "fcf"
  | "ocf"
  | "grossMargin"
  | "opMargin"
  | "netMargin"
  | "fcfMargin";

const FUND_META: Record<FundKey, { label: string; unit: FundUnit }> = {
  pe: { label: "P/E (price / TTM EPS)", unit: "x" },
  eps: { label: "TTM EPS", unit: "perShare" },
  revenue: { label: "TTM Revenue", unit: "millions" },
  netIncome: { label: "TTM Net Income", unit: "millions" },
  fcf: { label: "TTM Free Cash Flow", unit: "millions" },
  ocf: { label: "TTM Operating Cash Flow", unit: "millions" },
  grossMargin: { label: "TTM Gross Margin", unit: "pct" },
  opMargin: { label: "TTM Operating Margin", unit: "pct" },
  netMargin: { label: "TTM Net Margin", unit: "pct" },
  fcfMargin: { label: "TTM FCF Margin", unit: "pct" },
};

/** Expandable groups for the price-overlay fundamental picker. */
const PRICE_FUND_GROUPS: MetricGroup[] = [
  {
    id: "valuation",
    label: "Valuation",
    metrics: [
      { key: "pe", label: "P/E (price / TTM EPS)", kind: "ratio", format: "x" },
      { key: "eps", label: "TTM EPS", kind: "line", format: "perShare" },
    ],
  },
  {
    id: "income",
    label: "Income Statement (TTM)",
    metrics: [
      { key: "revenue", label: "TTM Revenue", kind: "line", format: "value" },
      { key: "netIncome", label: "TTM Net Income", kind: "line", format: "value" },
    ],
  },
  {
    id: "cashflow",
    label: "Cash Flow (TTM)",
    metrics: [
      { key: "fcf", label: "TTM Free Cash Flow", kind: "line", format: "value" },
      { key: "ocf", label: "TTM Operating Cash Flow", kind: "line", format: "value" },
    ],
  },
  {
    id: "margins",
    label: "Margins (TTM)",
    metrics: [
      { key: "grossMargin", label: "TTM Gross Margin", kind: "ratio", format: "pct" },
      { key: "opMargin", label: "TTM Operating Margin", kind: "ratio", format: "pct" },
      { key: "netMargin", label: "TTM Net Margin", kind: "ratio", format: "pct" },
      { key: "fcfMargin", label: "TTM FCF Margin", kind: "ratio", format: "pct" },
    ],
  },
];

type LayoutMode = "overlay" | "stacked";

/** Align two TTM series (same timestamps preferred) into a ratio series. */
function ttmRatio(
  fin: CompanyFinancials,
  numKey: string,
  denKey: string
): { t: number; v: number }[] {
  const num = ttmSeries(fin, numKey);
  const den = ttmSeries(fin, denKey);
  if (num.length === 0 || den.length === 0) return [];
  const denMap = new Map(den.map((d) => [d.t, d.v]));
  const out: { t: number; v: number }[] = [];
  for (const n of num) {
    const d = denMap.get(n.t);
    if (d == null || d === 0) continue;
    out.push({ t: n.t, v: n.v / d });
  }
  return out;
}

function PriceVsFundamentals({
  fin,
  currency,
}: {
  fin: CompanyFinancials;
  currency: string;
}) {
  const dark = useIsDark();
  const mode = dark ? "dark" : "light";
  const animate = !usePrefersReducedMotion();
  const [fund, setFund] = useState<FundKey>("revenue");
  const [layout, setLayout] = useState<LayoutMode>("overlay");
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

  const fundMeta = FUND_META[fund];

  const data = useMemo(() => {
    if (!prices || prices.length === 0) return [];
    const eps = ttmSeries(fin, "epsDiluted");
    const rev = ttmSeries(fin, "revenue");
    const ni = ttmSeries(fin, "netIncome");
    const fcf = ttmSeries(fin, "fcf");
    const ocf = ttmSeries(fin, "ocf");
    const gm = ttmRatio(fin, "grossProfit", "revenue");
    const om = ttmRatio(fin, "operatingIncome", "revenue");
    const nm = ttmRatio(fin, "netIncome", "revenue");
    const fm = ttmRatio(fin, "fcf", "revenue");

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
      switch (fund) {
        case "pe":
          f = e != null && e > 0 ? p.c / e : null;
          break;
        case "eps":
          f = e;
          break;
        case "revenue":
          f = pick(rev, p.t);
          break;
        case "netIncome":
          f = pick(ni, p.t);
          break;
        case "fcf":
          f = pick(fcf, p.t);
          break;
        case "ocf":
          f = pick(ocf, p.t);
          break;
        case "grossMargin":
          f = pick(gm, p.t);
          break;
        case "opMargin":
          f = pick(om, p.t);
          break;
        case "netMargin":
          f = pick(nm, p.t);
          break;
        case "fcfMargin":
          f = pick(fm, p.t);
          break;
      }
      return { t: p.t, price: p.c, fund: f };
    });
  }, [prices, fin, fund]);

  const fundLabel = fundMeta.label;
  const fundIsDollarsM = fundMeta.unit === "millions";
  const fundIsPct = fundMeta.unit === "pct";
  // P/E and per-share figures are meaningless if price and filings use
  // different currencies — say so rather than quietly mixing them.
  const mixedCurrency = priceCurrency != null && priceCurrency !== currency;
  const priceCcy = priceCurrency ?? currency;
  const fundColor = dark ? "#fbbf24" : "#d97706";

  const axisProps = {
    tick: { fill: INK_MUTED[mode], fontSize: 11 },
    tickLine: false,
  } as const;
  const tooltipStyle = {
    background: dark ? "#18181b" : "#ffffff",
    border: `1px solid ${GRID[mode]}`,
    borderRadius: 8,
    fontSize: 12,
  };
  const dateFmt = (t: unknown) =>
    new Date(Number(t)).toLocaleDateString("en-US", { year: "numeric", month: "short" });

  function formatFund(v: number): string {
    if (fundMeta.unit === "x") return Number(v).toFixed(1) + "×";
    if (fundMeta.unit === "perShare") return fmtMoney(Number(v), currency);
    if (fundMeta.unit === "pct") return (Number(v) * 100).toFixed(1) + "%";
    return fmtMillions(Number(v), currency);
  }

  function fundTick(v: number): string {
    if (fundMeta.unit === "x") return Number(v).toFixed(0) + "×";
    if (fundMeta.unit === "perShare") return fmtMoney(Number(v), currency, 1);
    if (fundMeta.unit === "pct") return (Number(v) * 100).toFixed(0) + "%";
    return fmtValue(Number(v));
  }

  const hasData = data.length > 0 && data.some((d) => d.fund != null);

  return (
    <section className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
            Price vs fundamentals
          </h2>
          <p className="mt-1 text-lg font-semibold tracking-tight">
            {layout === "overlay" ? "Overlay · " : ""}
            {fundLabel}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <MetricPicker
            value={fund}
            onChange={(k) => setFund(k as FundKey)}
            groups={PRICE_FUND_GROUPS}
            ariaLabel="Fundamental to chart against the price"
          />
          <div
            className={btnSegmentedCompact}
            role="group"
            aria-label="Chart layout"
          >
            {(
              [
                ["overlay", "Overlay"],
                ["stacked", "Stacked"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                aria-pressed={layout === k}
                onClick={() => setLayout(k)}
                className={btnSegmentedCompactItem(layout === k)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {failed ? (
        <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
          Price data is temporarily unavailable, so this chart can&apos;t render.
        </p>
      ) : prices === null ? (
        <div className="mt-4 h-40 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
      ) : prices.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
          No price history is available for {fin.ticker}, so this chart can&apos;t render.
        </p>
      ) : !hasData ? (
        <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
          Not enough overlapping filing data to chart {fundLabel} against the price.
        </p>
      ) : layout === "overlay" ? (
        <>
          <div
            className="mt-4 h-80"
            role="img"
            aria-label={`Dual-axis chart of ${fin.ticker} share price overlaid with ${fundLabel} over five years.`}
          >
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                <CartesianGrid stroke={GRID[mode]} vertical={false} />
                <XAxis
                  dataKey="t"
                  {...axisProps}
                  axisLine={{ stroke: GRID[mode] }}
                  tickFormatter={dateFmt}
                  minTickGap={60}
                />
                <YAxis
                  yAxisId="price"
                  {...axisProps}
                  axisLine={false}
                  width={56}
                  domain={["auto", "auto"]}
                  tickFormatter={(v) =>
                    currencyPrefix(priceCcy) + Number(v).toLocaleString("en-US")
                  }
                />
                <YAxis
                  yAxisId="fund"
                  orientation="right"
                  {...axisProps}
                  axisLine={false}
                  width={56}
                  domain={["auto", "auto"]}
                  tickFormatter={fundTick}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelFormatter={dateFmt}
                  formatter={(v, name) => {
                    if (name === "Price") return [fmtMoney(Number(v), priceCcy), "Price"];
                    return [formatFund(Number(v)), fundLabel];
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line
                  yAxisId="price"
                  type="monotone"
                  dataKey="price"
                  name="Price"
                  stroke={ACCENT[mode]}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={animate}
                />
                <Line
                  yAxisId="fund"
                  type="stepAfter"
                  dataKey="fund"
                  name={fundLabel}
                  stroke={fundColor}
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                  isAnimationActive={animate}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            Left axis: share price ({priceCcy}). Right axis: {fundLabel}
            {fundIsDollarsM ? ` (${currency} millions, TTM)` : fundIsPct ? " (TTM)" : ""}.
            Fundamentals step at each quarter end.
            {mixedCurrency && (
              <>
                {" "}
                Price is quoted in {priceCurrency} while filings report in {currency}.
              </>
            )}
          </p>
        </>
      ) : (
        <>
          <div
            className="mt-4 h-44"
            role="img"
            aria-label={`Line chart of ${fin.ticker} share price over the last five years, shown above a matching chart of ${fundLabel}.`}
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }} syncId="pvf">
                <CartesianGrid stroke={GRID[mode]} vertical={false} />
                <XAxis dataKey="t" hide />
                <YAxis
                  {...axisProps}
                  axisLine={false}
                  width={56}
                  domain={["auto", "auto"]}
                  tickFormatter={(v) =>
                    currencyPrefix(priceCcy) + Number(v).toLocaleString("en-US")
                  }
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelFormatter={dateFmt}
                  formatter={(v) => [fmtMoney(Number(v), priceCcy), "Price"]}
                />
                <Line
                  type="monotone"
                  dataKey="price"
                  stroke={ACCENT[mode]}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={animate}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div
            className="h-44"
            role="img"
            aria-label={`Line chart of ${fundLabel} for ${fin.ticker} over the last five years, stepping at each quarter end, aligned to the price chart above.`}
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }} syncId="pvf">
                <CartesianGrid stroke={GRID[mode]} vertical={false} />
                <XAxis
                  dataKey="t"
                  {...axisProps}
                  axisLine={{ stroke: GRID[mode] }}
                  tickFormatter={dateFmt}
                  minTickGap={60}
                />
                <YAxis
                  {...axisProps}
                  axisLine={false}
                  width={56}
                  domain={["auto", "auto"]}
                  tickFormatter={fundTick}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelFormatter={dateFmt}
                  formatter={(v) => [formatFund(Number(v)), fundLabel]}
                />
                <Line
                  type="stepAfter"
                  dataKey="fund"
                  stroke={fundColor}
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                  isAnimationActive={animate}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            {fundIsDollarsM
              ? `Fundamental shown in ${currency} millions. Fundamentals step `
              : "Fundamentals step "}
            at each quarter end.
            {mixedCurrency && (
              <>
                {" "}
                Note: the price is quoted in {priceCurrency} while the filings report in{" "}
                {currency}.
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
    <div className="space-y-8">
      <PriceChart ticker={fin.ticker} />
      <PriceVsFundamentals fin={fin} currency={currency} />
      <MetricChart fin={fin} currency={currency} />
    </div>
  );
}
