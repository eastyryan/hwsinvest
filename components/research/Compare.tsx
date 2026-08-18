"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
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
import { CaretDown, CaretRight } from "@phosphor-icons/react";
import type { CompanyFinancials, StatementSet, PeriodCol } from "@/lib/research/edgar";
import { buildRatios, type RatioSet } from "@/lib/research/ratios";
import { fmtValue, fmtPct } from "@/lib/research/format";
import SearchBox from "./SearchBox";
import MetricPicker, {
  STATEMENT_METRIC_GROUPS,
  ALL_STATEMENT_METRICS,
  type MetricDef,
  type MetricGroup,
} from "./MetricPicker";
import {
  btnCompact,
  btnSegmentedCompact,
  btnSegmentedCompactItem,
} from "./ui/buttonStyles";
import useIsDark from "./useIsDark";
import usePrefersReducedMotion from "./usePrefersReducedMotion";
import { fmtMillions, fmtMoney } from "./currency";
import {
  getServerWatchlistSnapshot,
  getWatchlistSnapshot,
  subscribeWatchlist,
} from "@/lib/research/watchlist";
import { isValidTicker } from "@/lib/research/validate";

// Fixed categorical order — color follows the company slot, never re-cycled.
const SERIES_COLORS = {
  light: ["#2563eb", "#d97706", "#7c3aed", "#db2777", "#0d9488"],
  dark: ["#60a5fa", "#fbbf24", "#a78bfa", "#f472b6", "#2dd4bf"],
};
const GRID = { light: "#e4e4e7", dark: "#27272a" };
const INK_MUTED = { light: "#71717a", dark: "#a1a1aa" };

type ViewMode = "value" | "yoy";
type Freq = "annual" | "quarterly";

const METRIC_GROUPS = STATEMENT_METRIC_GROUPS;
const ALL_METRICS = ALL_STATEMENT_METRICS;
const METRIC_BY_KEY = new Map(ALL_METRICS.map((m) => [m.key, m]));

const MAX_OTHERS = SERIES_COLORS.light.length - 1; // base company owns slot 0

// A second visual channel so series aren't distinguished by color alone.
const SERIES_DASH: (string | undefined)[] = [undefined, "6 4", "2 4", "8 3 2 3", "1 3"];
const DASH_DESCRIPTION = ["solid", "dashed", "dotted", "dash-dot", "sparse"];

/** The financials payload carries the filer's reporting currency. */
type ComparableCompany = CompanyFinancials & { currency?: string };

/**
 * Peer tickers live in the hash so a comparison is bookmarkable/shareable:
 *   #compare
 *   #compare?vs=msft,googl
 * CompanyView treats the segment before `?`/`&` as the tab key.
 */
function readVsFromHash(): string[] {
  if (typeof window === "undefined") return [];
  const raw = window.location.hash.slice(1);
  if (raw !== "compare" && !raw.startsWith("compare?") && !raw.startsWith("compare&")) {
    return [];
  }
  const qIdx = raw.indexOf("?");
  const aIdx = raw.indexOf("&");
  let query = "";
  if (qIdx >= 0) query = raw.slice(qIdx + 1);
  else if (aIdx >= 0) query = raw.slice(aIdx + 1);
  if (!query) return [];

  const vs = new URLSearchParams(query).get("vs");
  if (!vs) return [];

  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of vs.split(",")) {
    const t = part.trim().toUpperCase();
    if (!t || !isValidTicker(t) || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= MAX_OTHERS) break;
  }
  return out;
}

/** Keep the hash in sync with the current peer list (replaceState — no history spam). */
function writeCompareHash(peerTickers: string[]) {
  if (typeof window === "undefined") return;
  const vs = peerTickers
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, MAX_OTHERS)
    .join(",");
  const next = vs ? `#compare?vs=${vs}` : "#compare";
  if (window.location.hash.toLowerCase() === next) return;
  window.history.replaceState(null, "", next);
}

async function fetchComparable(r: {
  cik: string;
  ticker: string;
}): Promise<ComparableCompany | null> {
  try {
    let cik = r.cik;
    if (!cik) {
      const s = await fetch(`/api/research/search?q=${encodeURIComponent(r.ticker)}`);
      if (s.ok) {
        const body = (await s.json()) as {
          results?: { cik: string; ticker: string; name: string }[];
        };
        const hit = (body.results ?? []).find(
          (h) => h.ticker.toUpperCase() === r.ticker.toUpperCase()
        );
        if (hit) cik = hit.cik;
      }
    }
    if (!cik) return null;
    const res = await fetch(
      `/api/research/financials/${cik}?ticker=${encodeURIComponent(r.ticker)}`
    );
    if (!res.ok) return null;
    return (await res.json()) as ComparableCompany;
  } catch {
    return null;
  }
}

const currencyOf = (c: ComparableCompany) => c.currency || "USD";

function findLine(set: StatementSet, key: string) {
  for (const st of set.statements) {
    const l = st.lines.find((l) => l.key === key);
    if (l) return l;
  }
  return null;
}

function statementSet(c: ComparableCompany, freq: Freq): StatementSet {
  return freq === "annual" ? c.annual : c.quarterly;
}

/** Shared chart/table axis key for a period (annual → year; quarterly → YYYY-Qn). */
function axisKey(p: PeriodCol, freq: Freq): string {
  const d = new Date(p.end);
  const y = d.getUTCFullYear();
  if (freq === "annual") return String(y);
  const q = Math.floor(d.getUTCMonth() / 3) + 1;
  return `${y}-Q${q}`;
}

function axisSort(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true });
}

function findRatioLine(set: RatioSet, key: string) {
  return set.lines.find((l) => l.key === key) ?? null;
}

/** Nearest prior period ~1 year earlier for ratio YoY. */
function priorYearValue(
  periods: PeriodCol[],
  values: Record<string, number | null>,
  periodKey: string
): number | null {
  const t = new Date(periodKey).getTime();
  if (!Number.isFinite(t)) return null;
  const target = t - 365 * 86400000;
  let best: { d: number; v: number } | null = null;
  for (const p of periods) {
    if (p.key === periodKey) continue;
    const v = values[p.key];
    if (v == null) continue;
    const d = Math.abs(new Date(p.end).getTime() - target);
    if (d > 40 * 86400000) continue;
    if (!best || d < best.d) best = { d, v };
  }
  return best?.v ?? null;
}

function pctChange(cur: number | null, prev: number | null): number | null {
  if (cur == null || prev == null || prev === 0) return null;
  return (cur - prev) / Math.abs(prev);
}

function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  label: string;
}) {
  return (
    <div className={btnSegmentedCompact} role="group" aria-label={label}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          aria-pressed={value === opt.value}
          onClick={() => onChange(opt.value)}
          className={btnSegmentedCompactItem(value === opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export default function Compare({ base }: { base: ComparableCompany }) {
  const dark = useIsDark();
  const mode = dark ? "dark" : "light";
  const animate = !usePrefersReducedMotion();
  const [others, setOthers] = useState<ComparableCompany[]>([]);
  const [loading, setLoading] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  // Don't rewrite the hash until we've applied any `?vs=` peers from the URL;
  // otherwise a first paint with empty `others` would wipe a shared link.
  const [hashReady, setHashReady] = useState(false);
  const [metric, setMetric] = useState("revenue");
  const [view, setView] = useState<ViewMode>("value");
  const [freq, setFreq] = useState<Freq>("annual");
  const [tableOpen, setTableOpen] = useState<Record<string, boolean>>({
    income: true,
    balance: false,
    cashflow: false,
    margins: true,
  });
  const watchlist = useSyncExternalStore(
    subscribeWatchlist,
    getWatchlistSnapshot,
    getServerWatchlistSnapshot
  );

  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Auto-load peers from `#compare?vs=…` once on mount (and if the base company changes).
  useEffect(() => {
    let cancelled = false;
    setHashReady(false);

    (async () => {
      const baseTicker = base.ticker.toUpperCase();
      const wanted = readVsFromHash()
        .filter((t) => t !== baseTicker)
        .slice(0, MAX_OTHERS);

      if (wanted.length === 0) {
        if (!cancelled && mounted.current) setHashReady(true);
        return;
      }

      if (mounted.current) {
        setLoading(wanted[0]);
        setFailed(null);
      }

      const results = await Promise.all(
        wanted.map((ticker) => fetchComparable({ cik: "", ticker }))
      );
      if (cancelled || !mounted.current) return;

      const loaded: ComparableCompany[] = [];
      let firstFail: string | null = null;
      for (let i = 0; i < wanted.length; i++) {
        const fin = results[i];
        if (!fin) {
          if (!firstFail) firstFail = wanted[i];
          continue;
        }
        const t = fin.ticker.toUpperCase();
        if (t === baseTicker) continue;
        if (loaded.some((o) => o.ticker.toUpperCase() === t)) continue;
        if (loaded.length >= MAX_OTHERS) break;
        loaded.push(fin);
      }

      setOthers(loaded);
      if (firstFail) setFailed(firstFail);
      setLoading(null);
      setHashReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [base.ticker]);

  // Keep the URL shareable as peers are added or removed.
  useEffect(() => {
    if (!hashReady) return;
    writeCompareHash(others.map((o) => o.ticker));
  }, [others, hashReady]);

  async function addCompany(r: { cik: string; ticker: string; name: string }) {
    if (others.length >= MAX_OTHERS) return;
    if (
      r.ticker.toUpperCase() === base.ticker.toUpperCase() ||
      others.some((o) => o.ticker.toUpperCase() === r.ticker.toUpperCase())
    ) {
      return;
    }
    setLoading(r.ticker);
    setFailed(null);
    try {
      const fin = await fetchComparable({ cik: r.cik, ticker: r.ticker });
      if (!mounted.current) return;
      if (!fin) throw new Error();
      // Functional update: `others` captured above is pre-update, so two fast
      // selections would both append and overflow SERIES_COLORS. Re-check the
      // cap and the duplicate guard against the latest state.
      setOthers((prev) => {
        if (prev.length >= MAX_OTHERS) return prev;
        if (prev.some((o) => o.ticker.toUpperCase() === fin.ticker.toUpperCase())) {
          return prev;
        }
        return [...prev, fin];
      });
    } catch {
      if (mounted.current) setFailed(r.ticker);
    } finally {
      if (mounted.current) setLoading(null);
    }
  }

  const watchCandidates = watchlist.filter(
    (w) =>
      w.ticker.toUpperCase() !== base.ticker.toUpperCase() &&
      !others.some((o) => o.ticker.toUpperCase() === w.ticker.toUpperCase())
  );

  const companies = useMemo(() => [base, ...others], [base, others]);
  const metricDef = METRIC_BY_KEY.get(metric) ?? ALL_METRICS[0];
  const isPerShare = metricDef.format === "perShare";
  const isShares = metricDef.format === "shares";
  const isPct = metricDef.format === "pct";
  const isMultiple = metricDef.format === "x";

  const ratiosByTicker = useMemo(() => {
    const map = new Map<string, RatioSet>();
    for (const c of companies) {
      map.set(c.ticker, buildRatios(c, freq));
    }
    return map;
  }, [companies, freq]);

  // Merge each company's series onto a shared period axis.
  const data = useMemo(() => {
    const byAxis = new Map<string, Record<string, number | null>>();
    for (const c of companies) {
      if (metricDef.kind === "line") {
        const set = statementSet(c, freq);
        const line = findLine(set, metricDef.key);
        if (!line) continue;
        for (const p of set.periods) {
          const v = view === "value" ? line.values[p.key] : line.yoy[p.key];
          if (v == null) continue;
          const ax = axisKey(p, freq);
          const row = byAxis.get(ax) ?? {};
          row[c.ticker] = v;
          byAxis.set(ax, row);
        }
      } else {
        const ratios = ratiosByTicker.get(c.ticker);
        if (!ratios) continue;
        const line = findRatioLine(ratios, metricDef.key);
        if (!line) continue;
        for (const p of ratios.periods) {
          const cur = line.values[p.key] ?? null;
          const v =
            view === "value" ? cur : pctChange(cur, priorYearValue(ratios.periods, line.values, p.key));
          if (v == null) continue;
          const ax = axisKey(p, freq);
          const row = byAxis.get(ax) ?? {};
          row[c.ticker] = v;
          byAxis.set(ax, row);
        }
      }
    }
    return [...byAxis.entries()]
      .sort((a, b) => axisSort(a[0], b[0]))
      .map(([period, vals]) => ({ period, ...vals }));
  }, [companies, metricDef, view, freq, ratiosByTicker]);

  // Values are compared as filed, with no FX conversion, so mixing reporting
  // currencies makes the absolute-value view misleading (except pure ratios).
  const currencies = [...new Set(companies.map(currencyOf))];
  const mixedCurrency = currencies.length > 1;
  const absoluteComparable = isPct || isMultiple || view === "yoy";
  const valueUnitLabel = isPct
    ? "percent"
    : isMultiple
      ? "multiple"
      : isPerShare
        ? mixedCurrency
          ? "mixed currencies, per share"
          : `${currencies[0]} per share`
        : isShares
          ? "shares"
          : mixedCurrency
            ? "mixed currencies, millions"
            : `${currencies[0]} millions`;

  const periodBasisLabel = freq === "annual" ? "fiscal year" : "fiscal quarter";
  const growthLabel = "YoY growth %";

  const compareChartLabel =
    data.length > 0
      ? `Line chart comparing ${metricDef.label} ` +
        (view === "yoy" ? "year-over-year growth" : `as ${valueUnitLabel}`) +
        ` by ${periodBasisLabel} from ${data[0].period} to ${data[data.length - 1].period}, for ` +
        companies
          .map((c, i) => `${c.ticker} (${DASH_DESCRIPTION[i] ?? "solid"} line)`)
          .join(", ") +
        "."
      : "";

  function formatDisplay(
    v: number | null,
    m: MetricDef,
    asYoy: boolean,
    ccy: string
  ): string {
    if (v == null) return "—";
    if (asYoy) return fmtPct(v);
    // Absolute margin/return levels — no leading "+" (reserved for growth %).
    if (m.format === "pct") return (v * 100).toFixed(1) + "%";
    if (m.format === "x") return `${v.toFixed(2)}×`;
    if (m.format === "perShare") return fmtMoney(v, ccy);
    if (m.format === "shares") return fmtValue(v, { shares: true });
    return fmtMillions(v, ccy);
  }

  function unitHint(m: MetricDef): string {
    if (m.format === "pct") return "%";
    if (m.format === "x") return "×";
    if (m.format === "perShare") return "per share";
    if (m.format === "shares") return "shares";
    return "millions";
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Compare companies</h2>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            {base.ticker} vs up to {MAX_OTHERS} others · full statements, margins,{" "}
            {freq === "annual" ? "annual" : "quarterly"}
            {" · "}
            shareable{" "}
            <span className="font-mono">#compare?vs=msft,googl</span>
          </p>
        </div>
        <div className="w-full max-w-md sm:max-w-lg">
          {others.length < MAX_OTHERS ? (
            <SearchBox
              onSelect={addCompany}
              placeholder="Add a company to compare"
              disabled={loading !== null}
            />
          ) : (
            // The picker disappearing with no explanation reads as a bug.
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Comparing the maximum of {MAX_OTHERS + 1} companies. Remove one to add another.
            </p>
          )}
        </div>
      </div>

      {watchCandidates.length > 0 && others.length < MAX_OTHERS && (
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            From your watchlist
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {watchCandidates.slice(0, 8).map((w) => (
              <button
                key={w.ticker}
                type="button"
                disabled={loading !== null}
                onClick={() =>
                  addCompany({
                    ticker: w.ticker,
                    name: w.name,
                    cik: w.cik ?? "",
                  })
                }
                className={`${btnCompact} disabled:opacity-50`}
              >
                <span className="font-mono font-bold">{w.ticker}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {companies.map((c, i) => (
          <span
            key={c.ticker}
            className={`${btnCompact} gap-2`}
          >
            <svg width="18" height="10" viewBox="0 0 18 10" aria-hidden focusable="false">
              <line
                x1="0"
                y1="5"
                x2="18"
                y2="5"
                stroke={SERIES_COLORS[mode][i]}
                strokeWidth="2.5"
                strokeDasharray={SERIES_DASH[i]}
              />
            </svg>
            <span className="font-mono font-bold">{c.ticker}</span>
            <span className="sr-only">{DASH_DESCRIPTION[i] ?? "solid"} line</span>
            <span className="max-w-[160px] truncate text-zinc-500 dark:text-zinc-400">
              {c.name}
            </span>
            {i > 0 && (
              <button
                type="button"
                onClick={() => setOthers((prev) => prev.filter((o) => o.ticker !== c.ticker))}
                aria-label={`Remove ${c.ticker} from the comparison`}
                className="ml-1 text-zinc-500 hover:text-red-600 dark:text-zinc-400 dark:hover:text-red-400"
              >
                &times;
              </button>
            )}
          </span>
        ))}
        {/* Loading and failure are the result of an action the user just took,
            so they have to reach a screen reader without moving focus. */}
        <span role="status" aria-live="polite" className="text-xs text-zinc-500 dark:text-zinc-400">
          {loading ? `Loading ${loading}…` : ""}
        </span>
        {failed && (
          <span role="alert" className="text-xs text-red-700 dark:text-red-400">
            Couldn&apos;t load {failed}
          </span>
        )}
      </div>

      {mixedCurrency && view === "value" && !absoluteComparable && (
        <p className="rounded-lg border border-amber-500/60 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          These companies report in different currencies ({currencies.join(", ")}). Values
          are shown as filed with no exchange-rate conversion, so absolute figures
          aren&apos;t directly comparable &mdash; YoY growth % and margin ratios are.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <MetricPicker
          value={metric}
          onChange={setMetric}
          ariaLabel="Metric to compare"
        />
        <SegmentedControl
          label="Reporting frequency"
          value={freq}
          onChange={setFreq}
          options={[
            { value: "annual", label: "Annual" },
            { value: "quarterly", label: "Quarterly" },
          ]}
        />
        <SegmentedControl
          label="Comparison basis"
          value={view}
          onChange={setView}
          options={[
            { value: "value", label: valueUnitLabel },
            { value: "yoy", label: growthLabel },
          ]}
        />
      </div>

      <div
        className="h-80 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
        role={data.length > 0 ? "img" : undefined}
        aria-label={data.length > 0 ? compareChartLabel : undefined}
      >
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid stroke={GRID[mode]} vertical={false} />
              <XAxis
                dataKey="period"
                tick={{ fill: INK_MUTED[mode], fontSize: 11 }}
                axisLine={{ stroke: GRID[mode] }}
                tickLine={false}
                interval={freq === "quarterly" ? "preserveStartEnd" : 0}
                minTickGap={freq === "quarterly" ? 28 : 8}
              />
              <YAxis
                tick={{ fill: INK_MUTED[mode], fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={64}
                tickFormatter={(v) => {
                  if (view === "yoy") return (Number(v) * 100).toFixed(0) + "%";
                  if (isPct) return (Number(v) * 100).toFixed(0) + "%";
                  if (isMultiple) return Number(v).toFixed(1) + "×";
                  return fmtValue(Number(v), { perShare: isPerShare, shares: isShares });
                }}
              />
              <Tooltip
                contentStyle={{
                  background: dark ? "#18181b" : "#ffffff",
                  border: `1px solid ${GRID[mode]}`,
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelFormatter={(label) => String(label)}
                formatter={(v, name) => {
                  const ticker = String(name);
                  const ccy = currencyOf(
                    companies.find((c) => c.ticker === ticker) ?? base
                  );
                  return [
                    formatDisplay(Number(v), metricDef, view === "yoy", ccy),
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
                  stroke={SERIES_COLORS[mode][i]}
                  strokeWidth={2}
                  strokeDasharray={SERIES_DASH[i]}
                  dot={{ r: freq === "quarterly" ? 2 : 3 }}
                  connectNulls
                  isAnimationActive={animate}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-zinc-500 dark:text-zinc-400">
            No overlapping data for {metricDef.label} ({freq}).
          </div>
        )}
      </div>

      {/* Latest-period side-by-side stats — every statement line, grouped & expandable */}
      <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm">
          <caption className="sr-only">
            Most recent reported {periodBasisLabel} for each company, side by side.
            Period ends differ between companies, so each column is labelled with its
            own period. Statement values in millions of the currency each company
            reports in, except per-share and share-count lines; margins as percents.
          </caption>
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/70">
              <th
                scope="col"
                className="px-4 py-2.5 text-left font-medium text-zinc-500 dark:text-zinc-400"
              >
                Latest {freq === "annual" ? "fiscal year" : "quarter"}
              </th>
              {companies.map((c) => {
                const set = statementSet(c, freq);
                return (
                  <th
                    key={c.ticker}
                    scope="col"
                    className="px-4 py-2.5 text-right font-mono text-xs font-medium"
                  >
                    {c.ticker}
                    {/* Periods don't line up across companies — labelling the whole
                        column "latest" invited an apples-to-oranges read. */}
                    <span className="block font-sans text-[10px] font-normal text-zinc-500 dark:text-zinc-400">
                      {set.periods[0]?.label ?? "no data"} · {currencyOf(c)}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {METRIC_GROUPS.map((g) => {
              const open = tableOpen[g.id] ?? false;
              return (
                <TableGroup
                  key={g.id}
                  group={g}
                  open={open}
                  onToggle={() =>
                    setTableOpen((prev) => ({ ...prev, [g.id]: !prev[g.id] }))
                  }
                  companies={companies}
                  freq={freq}
                  ratiosByTicker={ratiosByTicker}
                  colSpan={companies.length + 1}
                  unitHint={unitHint}
                />
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function TableGroup({
  group,
  open,
  onToggle,
  companies,
  freq,
  ratiosByTicker,
  colSpan,
  unitHint,
}: {
  group: MetricGroup;
  open: boolean;
  onToggle: () => void;
  companies: ComparableCompany[];
  freq: Freq;
  ratiosByTicker: Map<string, RatioSet>;
  colSpan: number;
  unitHint: (m: MetricDef) => string;
}) {
  return (
    <>
      <tr className="border-b border-zinc-200 bg-zinc-50/80 dark:border-zinc-800 dark:bg-zinc-900/40">
        <th colSpan={colSpan} scope="colgroup" className="p-0">
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            className="flex w-full items-center gap-2 px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800/50"
          >
            {open ? (
              <CaretDown size={12} weight="bold" aria-hidden />
            ) : (
              <CaretRight size={12} weight="bold" aria-hidden />
            )}
            {group.label}
            <span className="ml-1 font-mono text-[10px] font-normal normal-case tracking-normal text-zinc-400">
              {group.metrics.length} lines
            </span>
          </button>
        </th>
      </tr>
      {open &&
        group.metrics.map((m) => (
          <tr
            key={m.key}
            className="border-b border-zinc-100 last:border-b-0 dark:border-zinc-800/60"
          >
            <th
              scope="row"
              className="px-4 py-2 text-left font-normal text-zinc-600 dark:text-zinc-300"
            >
              {m.label}{" "}
              <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
                ({unitHint(m)})
              </span>
            </th>
            {companies.map((c) => {
              const p =
                m.kind === "line"
                  ? statementSet(c, freq).periods[0]
                  : ratiosByTicker.get(c.ticker)?.periods[0];
              let v: number | null = null;
              if (p) {
                if (m.kind === "line") {
                  const line = findLine(statementSet(c, freq), m.key);
                  v = line?.values[p.key] ?? null;
                } else {
                  const line = findRatioLine(ratiosByTicker.get(c.ticker)!, m.key);
                  v = line?.values[p.key] ?? null;
                }
              }
              const perShare = m.format === "perShare";
              const shares = m.format === "shares";
              return (
                <td key={c.ticker} className="px-4 py-2 text-right font-mono tabular-nums">
                  {m.format === "pct"
                    ? v == null
                      ? "—"
                      : (v * 100).toFixed(1) + "%"
                    : m.format === "x"
                      ? v == null
                        ? "—"
                        : `${v.toFixed(2)}×`
                      : fmtValue(v, { perShare, shares })}
                </td>
              );
            })}
          </tr>
        ))}
    </>
  );
}
