"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from "recharts";
import type {
  SegmentsPayload,
  SegmentTable,
  SegmentRow,
  SegmentHistory,
} from "@/lib/research/segments";
import { fmtValue } from "@/lib/research/format";
import useIsDark from "./useIsDark";
import usePrefersReducedMotion from "./usePrefersReducedMotion";

const MIX_COLORS = [
  "#2563eb",
  "#7c3aed",
  "#db2777",
  "#ea580c",
  "#ca8a04",
  "#16a34a",
  "#0891b2",
  "#4f46e5",
  "#be123c",
  "#0d9488",
];
const MIX_COLORS_DARK = [
  "#60a5fa",
  "#a78bfa",
  "#f472b6",
  "#fb923c",
  "#fbbf24",
  "#4ade80",
  "#22d3ee",
  "#818cf8",
  "#fb7185",
  "#2dd4bf",
];

function fmtCell(v: number | null, unitNote: string | null): string {
  if (v == null) return "—";
  if (unitNote && /million|billion|thousand/i.test(unitNote)) {
    const abs = Math.abs(v);
    const s = abs.toLocaleString("en-US", {
      maximumFractionDigits: abs < 10 ? 1 : 0,
    });
    return v < 0 ? `(${s})` : s;
  }
  return fmtValue(v);
}

function kindLabel(kind: SegmentTable["kind"]): string {
  if (kind === "product") return "Product / service revenue";
  if (kind === "geographic") return "Geographic";
  if (kind === "reportable") return "Reportable segments";
  return "Other breakdown";
}

function isTotalRow(name: string): boolean {
  return /^(net sales|total|revenue|revenues|net revenue|net revenues|total net sales|total revenue|total revenues|total sales|consolidated net sales|consolidated revenue|consolidated revenues)$/i.test(
    name
  );
}

/** Chart source: prefer multi-year stitched history when kind matches and longer. */
function chartSource(
  table: SegmentTable,
  history: SegmentHistory | null
): { periods: string[]; rows: SegmentRow[]; unitNote: string | null; label: string } {
  if (
    history &&
    history.kind === table.kind &&
    history.periods.length > table.periods.length
  ) {
    return {
      periods: history.periods,
      rows: history.rows,
      unitNote: history.unitNote,
      label: `${history.periods.length}-year stitched history`,
    };
  }
  return {
    periods: table.periods,
    rows: table.rows,
    unitNote: table.unitNote,
    label: "From latest filing",
  };
}

/** Rows safe for a mix chart (exclude expense lines and totals). */
function chartableMembers(rows: SegmentRow[]): SegmentRow[] {
  return rows.filter((r) => {
    if (isTotalRow(r.name)) return false;
    if (/deferred|portion of total|previously deferred|contract liability/i.test(r.name)) {
      return false;
    }
    // Pure expense / P&L lines that appear in messy reportable-segment sheets
    if (
      /^(cost of sales|cost of revenue|research and development|selling and marketing|selling, general|general and administrative|operating income|operating loss|operating expenses?)$/i.test(
        r.name
      )
    ) {
      return false;
    }
    const latest = r.values[0];
    return latest != null && latest > 0;
  });
}

function SegmentMixCharts({
  table,
  history,
}: {
  table: SegmentTable;
  history: SegmentHistory | null;
}) {
  const dark = useIsDark();
  const animate = !usePrefersReducedMotion();
  const colors = dark ? MIX_COLORS_DARK : MIX_COLORS;
  const source = useMemo(() => chartSource(table, history), [table, history]);
  const members = useMemo(() => chartableMembers(source.rows), [source.rows]);
  const period = source.periods[0] ?? "Latest";

  const donutData = useMemo(
    () =>
      members.map((r, i) => ({
        name: r.name,
        value: r.values[0] ?? 0,
        pct: r.pctOfTotal[0],
        fill: colors[i % colors.length],
      })),
    [members, colors]
  );

  const stackedData = useMemo(() => {
    // One row per period: { period, [segmentName]: pct, ... }
    return source.periods
      .map((p, col) => {
        const row: Record<string, string | number> = { period: p };
        let sum = 0;
        for (const m of members) {
          const v = m.values[col];
          if (v != null && v > 0) sum += v;
        }
        for (const m of members) {
          const v = m.values[col];
          row[m.name] =
            sum > 0 && v != null && v > 0 ? (v / sum) * 100 : 0;
        }
        return row;
      })
      .reverse(); // oldest → newest for left-to-right reading
  }, [source.periods, members]);

  const services = members.find((r) => /service/i.test(r.name));
  const servicesPct = services?.pctOfTotal[0] ?? null;
  const top = [...members].sort(
    (a, b) => (b.values[0] ?? 0) - (a.values[0] ?? 0)
  )[0];

  if (members.length < 2) return null;

  return (
    <div className="space-y-4 rounded-xl border border-zinc-200 bg-zinc-50/40 p-4 dark:border-zinc-800 dark:bg-zinc-900/30">
      <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{source.label}</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Largest cut ({period})
          </p>
          <p className="mt-1 text-sm font-semibold">{top?.name ?? "—"}</p>
          <p className="font-mono text-lg tabular-nums">
            {top?.pctOfTotal[0] != null
              ? top.pctOfTotal[0].toFixed(1) + "%"
              : "—"}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Services share
          </p>
          <p className="mt-1 font-mono text-lg font-semibold tabular-nums">
            {servicesPct != null ? servicesPct.toFixed(1) + "%" : "—"}
          </p>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
            {services
              ? `${services.name} of total`
              : table.kind === "geographic"
                ? "Geographic cut"
                : "No Services line tagged"}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Lines in mix
          </p>
          <p className="mt-1 font-mono text-lg font-semibold tabular-nums">
            {members.length}
          </p>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
            {table.kind === "geographic"
              ? "Regions / countries with positive sales"
              : table.kind === "reportable"
                ? "Reportable segments with positive sales"
                : "Product / service lines with positive sales"}
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div
          className="h-64 rounded-lg border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-950"
          role="img"
          aria-label={`Donut chart of revenue mix for ${period}`}
        >
          <p className="px-2 pt-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Mix · {period}
          </p>
          <ResponsiveContainer width="100%" height="90%">
            <PieChart>
              <Pie
                data={donutData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={52}
                outerRadius={80}
                paddingAngle={1}
                isAnimationActive={animate}
              >
                {donutData.map((d) => (
                  <Cell key={d.name} fill={d.fill} stroke="transparent" />
                ))}
              </Pie>
              <Tooltip
                formatter={(value, name) => {
                  const v = typeof value === "number" ? value : Number(value);
                  const row = donutData.find((d) => d.name === name);
                  const pct =
                    row?.pct != null
                      ? row.pct.toFixed(1) + "%"
                      : "";
                  return [
                    `${fmtCell(Number.isFinite(v) ? v : null, source.unitNote)}${
                      pct ? ` (${pct})` : ""
                    }`,
                    String(name),
                  ];
                }}
                contentStyle={{
                  background: dark ? "#18181b" : "#fff",
                  border: `1px solid ${dark ? "#27272a" : "#e4e4e7"}`,
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: 11 }}
                formatter={(value) => (
                  <span className="text-zinc-600 dark:text-zinc-300">{value}</span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div
          className="h-64 rounded-lg border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-950"
          role="img"
          aria-label="Stacked bar chart of revenue mix over periods"
        >
          <p className="px-2 pt-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Mix over time (% of total)
            {source.periods.length > 3
              ? ` · ${source.periods.length} periods`
              : ""}
          </p>
          <ResponsiveContainer width="100%" height="90%">
            <BarChart data={stackedData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid
                stroke={dark ? "#27272a" : "#e4e4e7"}
                vertical={false}
              />
              <XAxis
                dataKey="period"
                tick={{ fill: dark ? "#a1a1aa" : "#71717a", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fill: dark ? "#a1a1aa" : "#71717a", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                width={32}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip
                formatter={(value, name) => {
                  const v = typeof value === "number" ? value : Number(value);
                  return [
                    `${Number.isFinite(v) ? v.toFixed(1) : "—"}%`,
                    String(name),
                  ];
                }}
                contentStyle={{
                  background: dark ? "#18181b" : "#fff",
                  border: `1px solid ${dark ? "#27272a" : "#e4e4e7"}`,
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              {members.map((m, i) => (
                <Bar
                  key={m.name}
                  dataKey={m.name}
                  stackId="mix"
                  fill={colors[i % colors.length]}
                  isAnimationActive={animate}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function SegmentTableView({
  table,
  history,
}: {
  table: SegmentTable;
  history: SegmentHistory | null;
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            {kindLabel(table.kind)}
          </p>
          <h3 className="text-sm font-semibold tracking-tight">{table.title}</h3>
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {table.form} · {table.filingDate}
          {table.unitNote ? ` · ${table.unitNote}` : ""}
        </p>
      </div>
      {(table.kind === "product" ||
        table.kind === "geographic" ||
        table.kind === "reportable") && (
        <SegmentMixCharts table={table} history={history} />
      )}
      <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/70">
              <th className="px-4 py-2.5 text-left font-medium text-zinc-500 dark:text-zinc-400">
                Line
              </th>
              {table.periods.map((p) => (
                <th
                  key={p}
                  className="min-w-[96px] px-4 py-2.5 text-right font-mono text-xs font-medium text-zinc-500 dark:text-zinc-400"
                >
                  {p}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row) => {
              const isTotal = isTotalRow(row.name);
              return (
                <tr
                  key={row.name}
                  className={`border-b border-zinc-100 last:border-b-0 dark:border-zinc-800/60 ${
                    isTotal ? "bg-zinc-50/70 dark:bg-zinc-900/40" : ""
                  }`}
                >
                  <th
                    scope="row"
                    className={`px-4 py-2 text-left ${
                      isTotal ? "font-semibold" : "font-medium"
                    }`}
                  >
                    {row.name}
                  </th>
                  {row.values.map((v, i) => (
                    <td key={i} className="px-4 py-2 text-right align-top">
                      <span
                        className={`font-mono text-[15px] tabular-nums ${
                          isTotal
                            ? "font-semibold"
                            : "text-zinc-700 dark:text-zinc-300"
                        }`}
                      >
                        {fmtCell(v, table.unitNote)}
                      </span>
                      {row.pctOfTotal[i] != null && !isTotal && (
                        <span className="block font-mono text-[10px] text-zinc-500 dark:text-zinc-400">
                          {row.pctOfTotal[i]!.toFixed(1)}%
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
      <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
        <a
          href={table.filingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="underline-offset-2 hover:underline"
        >
          Open source table in EDGAR
        </a>
      </p>
    </div>
  );
}

export default function SegmentsPanel({
  cik,
  initialData = null,
}: {
  cik: string;
  initialData?: SegmentsPayload | null;
}) {
  const [fetched, setFetched] = useState<SegmentsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const data = initialData ?? fetched;
  const loading = !data && !error;

  useEffect(() => {
    if (initialData) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/research/segments/${cik}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Failed to load segments");
        if (!cancelled) setFetched(json);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Something went wrong");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cik, initialData]);

  if (loading) {
    return (
      <div className="space-y-3" role="status" aria-live="polite">
        <div className="h-4 w-56 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-40 animate-pulse rounded-xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/40" />
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Loading segment tables from the latest 10-K/10-Q…
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50/60 p-5 dark:border-red-900/50 dark:bg-red-950/20">
        <p className="text-sm font-medium text-red-800 dark:text-red-300">
          Couldn&apos;t load segments
        </p>
        <p className="mt-1 text-sm text-red-700/80 dark:text-red-400/80">{error}</p>
      </div>
    );
  }

  if (!data) return null;

  const product = data.tables.filter((t) => t.kind === "product");
  const geo = data.tables.filter((t) => t.kind === "geographic");
  const reportable = data.tables.filter((t) => t.kind === "reportable");
  const other = data.tables.filter((t) => t.kind === "other");

  return (
    <div className="space-y-10">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Segments &amp; KPIs</h2>
        <p className="mt-1 max-w-[75ch] text-xs text-zinc-500 dark:text-zinc-400">
          Product, service, and geographic revenue as tagged in the company&apos;s
          latest SEC filing detail tables. Charts show mix when a product
          breakdown is available. Not every filer discloses this way.
        </p>
        {data.form && (
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            Source:{" "}
            {data.filingUrl ? (
              <a
                href={data.filingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline-offset-2 hover:underline"
              >
                {data.form} filed {data.filingDate}
              </a>
            ) : (
              `${data.form} filed ${data.filingDate}`
            )}
          </p>
        )}
      </div>

      {data.tables.length === 0 && (
        <div className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-5 dark:border-zinc-800 dark:bg-zinc-900/40">
          <p className="text-sm font-medium">No segment tables found</p>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            This company&apos;s latest 10-K/10-Q doesn&apos;t expose product or
            geographic revenue in XBRL detail tables we can parse. Many businesses
            only report a single consolidated revenue line.
          </p>
        </div>
      )}

      {product.length > 0 && (
        <section className="space-y-6">
          <h3 className="text-base font-semibold tracking-tight">
            Revenue by product / service
          </h3>
          {product.map((t) => (
            <SegmentTableView
              key={t.reportFile + t.title}
              table={t}
              history={data.history}
            />
          ))}
        </section>
      )}

      {geo.length > 0 && (
        <section className="space-y-6">
          <h3 className="text-base font-semibold tracking-tight">Geographic</h3>
          {geo.map((t) => (
            <SegmentTableView
              key={t.reportFile + t.title}
              table={t}
              history={data.history?.kind === "geographic" ? data.history : null}
            />
          ))}
        </section>
      )}

      {reportable.length > 0 && (
        <section className="space-y-6">
          <h3 className="text-base font-semibold tracking-tight">
            Reportable segments
          </h3>
          {reportable.map((t) => (
            <SegmentTableView
              key={t.reportFile + t.title}
              table={t}
              history={null}
            />
          ))}
        </section>
      )}

      {other.length > 0 && (
        <section className="space-y-6">
          <h3 className="text-base font-semibold tracking-tight">Other breakdowns</h3>
          {other.map((t) => (
            <SegmentTableView
              key={t.reportFile + t.title}
              table={t}
              history={null}
            />
          ))}
        </section>
      )}

      <div className="rounded-xl border border-zinc-200 bg-zinc-50/40 p-4 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/30 dark:text-zinc-400">
        <p className="font-medium text-zinc-600 dark:text-zinc-300">About KPIs</p>
        <ul className="mt-2 list-disc space-y-1 pl-4">
          <li>
            Figures like &ldquo;iPhone installed user base&rdquo; almost never appear
            in structured XBRL — they live in narrative text or earnings decks,
            which we don&apos;t scrape.
          </li>
          {data.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
