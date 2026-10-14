// Shared compare-chart axis and year-over-year math.
//
// Annual columns use the filer's FY label when it is FY####, so two years
// that end in the same calendar year (a January year-end next to a December
// year-end) do not overwrite each other. Margin and multiple "growth" is the
// difference in the level (percentage points, turns), not a percent change
// of the ratio.

import type { PeriodCol } from "./edgar";

export type CompareFormat = "value" | "perShare" | "shares" | "pct" | "x";

/** Chart/table bucket for one period. Annual prefers the fiscal-year label. */
export function compareAxisKey(
  p: Pick<PeriodCol, "end" | "label">,
  freq: "annual" | "quarterly"
): string {
  if (freq === "annual" && /^FY\d{4}$/.test(p.label)) return p.label;
  const end = /^\d{4}-\d{2}-\d{2}$/.test(p.end) ? `${p.end}T00:00:00Z` : p.end;
  const d = new Date(end);
  const y = d.getUTCFullYear();
  if (freq === "annual") return String(y);
  const q = Math.floor(d.getUTCMonth() / 3) + 1;
  return `${y}-Q${q}`;
}

/**
 * Year-over-year change for a compare cell.
 * Percent and multiple formats return the level difference. Everything else
 * is (current − prior) / |prior|.
 */
export function compareYoY(
  cur: number | null,
  prev: number | null,
  format: CompareFormat
): number | null {
  if (cur == null || prev == null) return null;
  if (format === "pct" || format === "x") return cur - prev;
  if (prev === 0) return null;
  return (cur - prev) / Math.abs(prev);
}

/**
 * Newest-first series: the first value written for a ticker on a bucket wins.
 * A later period that shares the bucket (two filings ending in one calendar
 * year) must not replace it.
 */
export function putAxisValue(
  row: Record<string, number | null>,
  ticker: string,
  value: number
): void {
  if (row[ticker] == null) row[ticker] = value;
}
