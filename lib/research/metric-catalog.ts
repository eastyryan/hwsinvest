// Shared statement + margin metric catalog for Compare, Charts, Excel export.
// Kept free of React so API routes and client components can both import it.

import { INCOME, BALANCE, CASHFLOW } from "./line-defs";

export type MetricFormat = "value" | "perShare" | "shares" | "pct" | "x";
export type MetricKind = "line" | "ratio";

export interface MetricDef {
  key: string;
  label: string;
  kind: MetricKind;
  format: MetricFormat;
}

export interface MetricGroup {
  id: string;
  label: string;
  metrics: MetricDef[];
}

function lineMetrics(
  defs: { key: string; label: string; perShare?: boolean; shares?: boolean }[]
): MetricDef[] {
  return defs.map((d) => ({
    key: d.key,
    label: d.label,
    kind: "line" as const,
    format: (d.perShare ? "perShare" : d.shares ? "shares" : "value") as MetricFormat,
  }));
}

/** Full statement lines + margins/returns — Compare, Charts, Excel compare, etc. */
export const STATEMENT_METRIC_GROUPS: MetricGroup[] = [
  { id: "income", label: "Income Statement", metrics: lineMetrics(INCOME) },
  { id: "balance", label: "Balance Sheet", metrics: lineMetrics(BALANCE) },
  { id: "cashflow", label: "Cash Flow Statement", metrics: lineMetrics(CASHFLOW) },
  {
    id: "margins",
    label: "Margins & Returns",
    metrics: [
      { key: "grossMargin", label: "Gross Margin", kind: "ratio", format: "pct" },
      { key: "opMargin", label: "Operating Margin", kind: "ratio", format: "pct" },
      { key: "netMargin", label: "Net Margin", kind: "ratio", format: "pct" },
      { key: "fcfMargin", label: "FCF Margin", kind: "ratio", format: "pct" },
      { key: "roe", label: "Return on Equity", kind: "ratio", format: "pct" },
      { key: "roa", label: "Return on Assets", kind: "ratio", format: "pct" },
      { key: "roic", label: "Return on Invested Capital", kind: "ratio", format: "pct" },
      { key: "rdPct", label: "R&D % of Revenue", kind: "ratio", format: "pct" },
      { key: "currentRatio", label: "Current Ratio", kind: "ratio", format: "x" },
      { key: "debtToEquity", label: "Debt / Equity", kind: "ratio", format: "x" },
    ],
  },
];

export const ALL_STATEMENT_METRICS = STATEMENT_METRIC_GROUPS.flatMap((g) => g.metrics);

const DEFAULT_BY_KEY = new Map(ALL_STATEMENT_METRICS.map((m) => [m.key, m]));

export function getStatementMetric(key: string): MetricDef | undefined {
  return DEFAULT_BY_KEY.get(key);
}

export function filterMetricGroups(
  groups: MetricGroup[],
  allowedKeys?: Set<string> | null
): MetricGroup[] {
  if (!allowedKeys) return groups;
  return groups
    .map((g) => ({
      ...g,
      metrics: g.metrics.filter((m) => allowedKeys.has(m.key)),
    }))
    .filter((g) => g.metrics.length > 0);
}
