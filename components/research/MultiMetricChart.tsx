"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import type { CompanyFinancials, StatementSet } from "@/lib/research/edgar";
import { buildRatios } from "@/lib/research/ratios";
import { fmtValue } from "@/lib/research/format";
import { getStatementMetric, type MetricFormat } from "@/lib/research/metric-catalog";
import {
  planAxes,
  startIndexForYears,
  type AxisFormat,
  type AxisSide,
} from "@/lib/research/chart-compose";
import MetricPicker, { STATEMENT_METRIC_GROUPS } from "./MetricPicker";
import useIsDark from "./useIsDark";
import usePrefersReducedMotion from "./usePrefersReducedMotion";
import { fmtMillions, fmtMoney } from "./currency";
import { btnCompact, btnSegmentedCompact, btnSegmentedCompactItem } from "./ui/buttonStyles";

const GRID = { light: "#e4e4e7", dark: "#27272a" };
const INK_MUTED = { light: "#71717a", dark: "#a1a1aa" };

const MAX_SERIES = 5;

const PALETTE = [
  { id: "blue", name: "Blue", light: "#2563eb", dark: "#60a5fa" },
  { id: "orange", name: "Orange", light: "#ea580c", dark: "#fb923c" },
  { id: "teal", name: "Teal", light: "#0f766e", dark: "#2dd4bf" },
  { id: "violet", name: "Violet", light: "#7c3aed", dark: "#c4b5fd" },
  { id: "rose", name: "Rose", light: "#e11d48", dark: "#fb7185" },
  { id: "amber", name: "Amber", light: "#d97706", dark: "#fbbf24" },
  { id: "cyan", name: "Cyan", light: "#0891b2", dark: "#22d3ee" },
  { id: "lime", name: "Lime", light: "#65a30d", dark: "#a3e635" },
] as const;

type PaletteId = (typeof PALETTE)[number]["id"];
type SeriesStyle = "bar" | "line";

interface SeriesSpec {
  id: string;
  key: string;
  style: SeriesStyle;
  color: PaletteId;
}

const SUGGEST = [
  "opMargin",
  "grossMargin",
  "netMargin",
  "operatingIncome",
  "netIncome",
  "ebitda",
  "fcf",
  "epsDiluted",
  "grossProfit",
];

const RANGE_PRESETS = [
  { id: "3y", label: "3Y", years: 3 },
  { id: "5y", label: "5Y", years: 5 },
  { id: "10y", label: "10Y", years: 10 },
  { id: "max", label: "Max", years: null },
] as const;

function paletteOf(id: string) {
  return PALETTE.find((color) => color.id === id) ?? PALETTE[0];
}

function axisFormatFor(
  key: string,
  line: { perShare?: boolean; shares?: boolean } | null
): AxisFormat {
  const def = getStatementMetric(key);
  const format: MetricFormat | undefined = def?.format;
  if (format === "pct") return "pct";
  if (format === "x") return "x";
  if (format === "perShare" || line?.perShare) return "perShare";
  if (format === "shares" || line?.shares) return "shares";
  return "value";
}

function findLine(set: StatementSet, key: string) {
  for (const statement of set.statements) {
    const line = statement.lines.find((l) => l.key === key);
    if (line) return line;
  }
  return null;
}

function formatAxis(format: AxisFormat, value: number, currency: string): string {
  if (format === "pct") return (value * 100).toFixed(0) + "%";
  if (format === "x") return value.toFixed(1) + "×";
  if (format === "perShare") return fmtMoney(value, currency, Math.abs(value) >= 100 ? 0 : 2);
  if (format === "shares") return fmtValue(value, { shares: true });
  return fmtValue(value);
}

function formatPoint(format: AxisFormat, value: number, currency: string): string {
  if (format === "pct") return (value * 100).toFixed(1) + "%";
  if (format === "x") return value.toFixed(2) + "×";
  if (format === "perShare") return fmtMoney(value, currency);
  if (format === "shares") return fmtValue(value, { shares: true });
  return fmtMillions(value, currency);
}

function unitName(format: AxisFormat, currency: string): string {
  if (format === "pct") return "percent";
  if (format === "x") return "multiple";
  if (format === "perShare") return `${currency} per share`;
  if (format === "shares") return "shares";
  return `${currency} millions`;
}

function ColorSwatch({
  value,
  onChange,
}: {
  value: PaletteId;
  onChange: (id: PaletteId) => void;
}) {
  const dark = useIsDark();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const current = paletteOf(value);
  const swatch = dark ? current.dark : current.light;
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    function onDoc(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label={`Series color, ${current.name}`}
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-950"
      >
        <span className="h-3.5 w-3.5 rounded-full" style={{ background: swatch }} />
      </button>
      {open && (
        <div
          id={listId}
          role="listbox"
          aria-label="Series colors"
          className="absolute left-0 z-20 mt-1 flex gap-1 rounded-lg border border-zinc-200 bg-white p-1.5 shadow-sm dark:border-zinc-700 dark:bg-zinc-950"
        >
          {PALETTE.map((color) => {
            const active = color.id === value;
            return (
              <button
                key={color.id}
                type="button"
                role="option"
                aria-selected={active}
                aria-label={color.name}
                onClick={() => {
                  onChange(color.id);
                  setOpen(false);
                }}
                className={`inline-flex h-6 w-6 items-center justify-center rounded-md ${
                  active ? "ring-2 ring-zinc-900 dark:ring-zinc-100" : ""
                }`}
              >
                <span
                  className="h-3.5 w-3.5 rounded-full"
                  style={{ background: dark ? color.dark : color.light }}
                />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SeriesTooltip({
  active,
  payload,
  label,
  names,
  formats,
  currency,
}: {
  active?: boolean;
  payload?: { dataKey?: string | number; value?: number | string; color?: string }[];
  label?: string;
  names: Map<string, string>;
  formats: Map<string, AxisFormat>;
  currency: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
      <p className="mb-1 font-medium text-zinc-800 dark:text-zinc-100">{label}</p>
      <ul className="space-y-1">
        {payload.map((item) => {
          const key = String(item.dataKey ?? "");
          const value = typeof item.value === "number" ? item.value : Number(item.value);
          const format = formats.get(key) ?? "value";
          return (
            <li key={key} className="flex items-center gap-2 text-zinc-700 dark:text-zinc-200">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: item.color }}
              />
              <span className="text-zinc-500 dark:text-zinc-400">{names.get(key) ?? key}</span>
              <span className="ml-auto font-mono tabular-nums">
                {Number.isFinite(value) ? formatPoint(format, value, currency) : "—"}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function MultiMetricChart({
  fin,
  currency,
}: {
  fin: CompanyFinancials;
  currency: string;
}) {
  const dark = useIsDark();
  const mode = dark ? "dark" : "light";
  const animate = !usePrefersReducedMotion();
  const nextId = useRef(2);
  const [freq, setFreq] = useState<"annual" | "quarterly">("annual");
  const [series, setSeries] = useState<SeriesSpec[]>([
    { id: "s1", key: "revenue", style: "bar", color: "blue" },
  ]);
  /** Null means the 10-year preset, recomputed when the history changes. */
  const [start, setStart] = useState<number | null>(null);

  const set = freq === "annual" ? fin.annual : fin.quarterly;
  const ratios = useMemo(() => buildRatios(fin, freq), [fin, freq]);

  const allowedKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const statement of set.statements) {
      for (const line of statement.lines) keys.add(line.key);
    }
    for (const line of ratios.lines) {
      if (Object.values(line.values).some((v) => v != null)) keys.add(line.key);
    }
    return keys;
  }, [set, ratios]);

  const plotted = useMemo(
    () => series.filter((item) => allowedKeys.has(item.key)),
    [series, allowedKeys]
  );
  const missing = series.filter((item) => !allowedKeys.has(item.key));

  const rows = useMemo(() => {
    const byEnd = new Map<string, { label: string; end: string; [key: string]: string | number | null }>();
    for (const item of plotted) {
      const def = getStatementMetric(item.key);
      const ratioLine =
        def?.kind === "ratio" ? ratios.lines.find((l) => l.key === item.key) : null;
      const statementLine = def?.kind === "ratio" ? null : findLine(set, item.key);
      const periods = def?.kind === "ratio" ? ratios.periods : set.periods;
      for (const period of periods) {
        const raw = ratioLine
          ? ratioLine.values[period.key]
          : statementLine?.values[period.key];
        const value = typeof raw === "number" && Number.isFinite(raw) ? raw : null;
        let row = byEnd.get(period.end);
        if (!row) {
          row = { label: period.label, end: period.end };
          byEnd.set(period.end, row);
        }
        row[item.id] = value;
      }
    }
    return [...byEnd.values()]
      .sort((a, b) => a.end.localeCompare(b.end))
      .filter((row) => plotted.some((item) => typeof row[item.id] === "number"));
  }, [plotted, ratios, set]);

  const resolvedStart =
    rows.length === 0
      ? 0
      : Math.min(
          start == null ? startIndexForYears(rows.map((row) => row.end), 10) : start,
          rows.length - 1
        );
  const visible = rows.slice(resolvedStart);
  const matchingPresets = RANGE_PRESETS.filter(
    (preset) =>
      startIndexForYears(rows.map((row) => row.end), preset.years) === resolvedStart
  );
  // The widest preset that lands on this start is the honest label. A two-year
  // history makes 3Y, 5Y, 10Y, and Max identical, and Max is the one to show.
  const activePreset = matchingPresets[matchingPresets.length - 1]?.id ?? null;

  const formats = plotted.map((item) =>
    axisFormatFor(item.key, item.key ? findLine(set, item.key) : null)
  );
  const axes = planAxes(formats);
  const names = new Map(
    plotted.map((item) => [item.id, getStatementMetric(item.key)?.label ?? item.key])
  );
  const formatById = new Map(plotted.map((item, index) => [item.id, formats[index]]));

  function update(id: string, patch: Partial<SeriesSpec>) {
    setSeries((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item))
    );
  }

  function addSeries() {
    if (series.length >= MAX_SERIES) return;
    const taken = new Set(series.map((item) => item.key));
    const key =
      SUGGEST.find((candidate) => allowedKeys.has(candidate) && !taken.has(candidate)) ??
      [...allowedKeys].find((candidate) => !taken.has(candidate));
    if (!key) return;
    const usedColors = new Set(series.map((item) => item.color));
    const color =
      PALETTE.find((entry) => !usedColors.has(entry.id))?.id ?? PALETTE[series.length % PALETTE.length].id;
    const format = axisFormatFor(key, findLine(set, key));
    const firstFormat = series[0]
      ? axisFormatFor(series[0].key, findLine(set, series[0].key))
      : format;
    const id = `s${nextId.current++}`;
    setSeries((current) => [
      ...current,
      {
        id,
        key,
        style: format !== firstFormat ? "line" : "bar",
        color,
      },
    ]);
  }

  function removeSeries(id: string) {
    setSeries((current) => (current.length <= 1 ? current : current.filter((item) => item.id !== id)));
  }

  const fromLabel = visible[0]?.label;
  const toLabel = visible[visible.length - 1]?.label;
  const chartLabel =
    visible.length > 0
      ? `Chart of ${plotted
          .map((item) => names.get(item.id))
          .filter(Boolean)
          .join(", ")} from ${fromLabel} to ${toLabel}.`
      : "";

  const tooltip = (
    <SeriesTooltip names={names} formats={formatById} currency={currency} />
  );

  return (
    <section className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
            Statement chart
          </h2>
          <p className="mt-1 max-w-xl text-sm text-zinc-600 dark:text-zinc-300">
            Up to five series on one chart. Each series keeps its own bars or line
            and its own color. A second unit, such as a margin on top of revenue,
            uses the right axis.
          </p>
        </div>
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
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={freq === value}
              onClick={() => {
                setFreq(value);
                setStart(null);
              }}
              className={btnSegmentedCompactItem(freq === value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <ul className="mt-4 space-y-2">
        {series.map((item, index) => {
          const taken = new Set(
            series.filter((other) => other.id !== item.id).map((other) => other.key)
          );
          const pickerKeys = new Set(
            [...allowedKeys].filter((key) => key === item.key || !taken.has(key))
          );
          return (
            <li key={item.id} className="flex flex-wrap items-center gap-2">
              <ColorSwatch
                value={item.color}
                onChange={(color) => update(item.id, { color })}
              />
              <MetricPicker
                value={item.key}
                onChange={(key) => update(item.id, { key })}
                groups={STATEMENT_METRIC_GROUPS}
                allowedKeys={pickerKeys}
                ariaLabel={`Metric ${index + 1}`}
                className="min-w-[12rem] flex-1"
              />
              <div
                className={btnSegmentedCompact}
                role="group"
                aria-label={`Chart style for ${names.get(item.id) ?? "this series"}`}
              >
                {(
                  [
                    ["bar", "Bars"],
                    ["line", "Line"],
                  ] as const
                ).map(([style, label]) => (
                  <button
                    key={style}
                    type="button"
                    aria-pressed={item.style === style}
                    onClick={() => update(item.id, { style })}
                    className={btnSegmentedCompactItem(item.style === style)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => removeSeries(item.id)}
                disabled={series.length <= 1}
                className={`${btnCompact} disabled:cursor-not-allowed disabled:opacity-40`}
              >
                Remove
              </button>
            </li>
          );
        })}
      </ul>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={addSeries}
          disabled={
            series.length >= MAX_SERIES ||
            [...allowedKeys].every((key) => series.some((item) => item.key === key))
          }
          className={`${btnCompact} disabled:cursor-not-allowed disabled:opacity-40`}
        >
          Add series
        </button>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          {series.length} of {MAX_SERIES}
        </span>
      </div>

      {rows.length > 1 && (
        <div className="mt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              From{" "}
              <span className="font-medium text-zinc-700 dark:text-zinc-200">
                {fromLabel}
              </span>
              {" "}through{" "}
              <span className="font-medium text-zinc-700 dark:text-zinc-200">
                {toLabel}
              </span>
            </p>
            <div className={btnSegmentedCompact} role="group" aria-label="How far back">
              {RANGE_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  aria-pressed={activePreset === preset.id}
                  onClick={() =>
                    setStart(startIndexForYears(rows.map((row) => row.end), preset.years))
                  }
                  className={btnSegmentedCompactItem(activePreset === preset.id)}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
          <label className="mt-2 block">
            <span className="sr-only">Chart start period</span>
            <input
              type="range"
              min={0}
              max={rows.length - 1}
              step={1}
              value={resolvedStart}
              aria-valuetext={rows[resolvedStart]?.label ?? ""}
              onChange={(event) => setStart(Number(event.target.value))}
              className="w-full accent-zinc-900 dark:accent-zinc-100"
            />
          </label>
        </div>
      )}

      <div
        className="mt-3 h-80"
        role={visible.length > 0 ? "img" : undefined}
        aria-label={visible.length > 0 ? chartLabel : undefined}
      >
        {visible.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={visible} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid stroke={GRID[mode]} vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: INK_MUTED[mode], fontSize: 11 }}
                axisLine={{ stroke: GRID[mode] }}
                tickLine={false}
                minTickGap={20}
              />
              <YAxis
                yAxisId="left"
                tick={{ fill: INK_MUTED[mode], fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={64}
                tickFormatter={(value) => formatAxis(axes.left, Number(value), currency)}
              />
              {axes.right && (
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fill: INK_MUTED[mode], fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={56}
                  tickFormatter={(value) =>
                    formatAxis(axes.right as AxisFormat, Number(value), currency)
                  }
                />
              )}
              <Tooltip
                content={tooltip}
                cursor={{ fill: dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)" }}
              />
              <ReferenceLine yAxisId="left" y={0} stroke={INK_MUTED[mode]} strokeWidth={1} />
              {plotted.map((item, index) => {
                const side: AxisSide = axes.assign[index] ?? "dropped";
                if (side === "dropped") return null;
                const color = dark ? paletteOf(item.color).dark : paletteOf(item.color).light;
                if (item.style === "line") {
                  return (
                    <Line
                      key={item.id}
                      yAxisId={side}
                      type="monotone"
                      dataKey={item.id}
                      name={names.get(item.id)}
                      stroke={color}
                      strokeWidth={2}
                      dot={false}
                      connectNulls
                      isAnimationActive={animate}
                    />
                  );
                }
                return (
                  <Bar
                    key={item.id}
                    yAxisId={side}
                    dataKey={item.id}
                    name={names.get(item.id)}
                    fill={color}
                    radius={[3, 3, 0, 0]}
                    maxBarSize={32}
                    isAnimationActive={animate}
                  />
                );
              })}
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-zinc-500 dark:text-zinc-400">
            No data for the series on this chart.
          </div>
        )}
      </div>

      {plotted.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
          {plotted.map((item, index) => {
            const side = axes.assign[index] ?? "dropped";
            const color = dark ? paletteOf(item.color).dark : paletteOf(item.color).light;
            const format = formats[index] ?? "value";
            return (
              <li key={item.id} className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: color }} />
                <span className="text-zinc-700 dark:text-zinc-200">
                  {names.get(item.id)}
                </span>
                <span>
                  {item.style === "bar" ? "bars" : "line"}
                  {side === "dropped"
                    ? " · needs its own scale"
                    : ` · ${side} · ${unitName(format, currency)}`}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {axes.assign.includes("dropped") && (
        <p className="mt-2 text-xs text-amber-800 dark:text-amber-300">
          One series uses a third unit, so it is left off the chart. Remove a series
          or change that metric to share the left or right scale.
        </p>
      )}
      {missing.length > 0 && (
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
          {missing
            .map((item) => getStatementMetric(item.key)?.label ?? item.key)
            .join(", ")}{" "}
          {missing.length === 1 ? "has" : "have"} no {freq} values.
        </p>
      )}
      {visible.length > 0 && (
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
          {freq === "quarterly"
            ? "Quarterly ratios are trailing twelve months. "
            : ""}
          Values as filed with the SEC.
          {plotted.some((item) => getStatementMetric(item.key)?.kind === "ratio")
            ? " Ratio series are computed from those statements."
            : ""}
        </p>
      )}
    </section>
  );
}
