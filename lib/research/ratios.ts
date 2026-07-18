// Ratio & return series computed from the normalized statements.
// Annual mode uses fiscal-year values; quarterly mode uses trailing-twelve-month
// sums for flow items so the ratios stay comparable quarter to quarter.

import type { CompanyFinancials, StatementSet, LineValues, PeriodCol } from "./edgar";

export type RatioFormat = "pct" | "x";

export interface RatioLine {
  key: string;
  label: string;
  format: RatioFormat;
  values: Record<string, number | null>;
  note?: string;
}

export interface RatioSet {
  periods: PeriodCol[];
  lines: RatioLine[];
}

function findLine(set: StatementSet, key: string): LineValues | undefined {
  for (const st of set.statements) {
    const l = st.lines.find((l) => l.key === key);
    if (l) return l;
  }
  return undefined;
}

type Getter = (periodIdx: number) => number | null;

/** Value at a period index; TTM sum in quarterly mode for flow items. */
function flowGetter(set: StatementSet, key: string, ttm: boolean): Getter {
  const line = findLine(set, key);
  if (!line) return () => null;
  return (i) => {
    if (!ttm) return line.values[set.periods[i]?.key] ?? null;
    let sum = 0;
    for (let k = i; k < i + 4; k++) {
      const p = set.periods[k];
      if (!p) return null;
      const v = line.values[p.key];
      if (v == null) return null;
      sum += v;
    }
    return sum;
  };
}

function instantGetter(set: StatementSet, key: string): Getter {
  const line = findLine(set, key);
  if (!line) return () => null;
  return (i) => line.values[set.periods[i]?.key] ?? null;
}

/** Average of a balance item between now and one year earlier. */
function avgGetter(set: StatementSet, key: string, periodsPerYear: number): Getter {
  const g = instantGetter(set, key);
  return (i) => {
    const now = g(i);
    const yearAgo = g(i + periodsPerYear);
    if (now == null) return null;
    return yearAgo == null ? now : (now + yearAgo) / 2;
  };
}

const div = (a: number | null, b: number | null): number | null =>
  a != null && b != null && b !== 0 ? a / b : null;

export function buildRatios(
  fin: CompanyFinancials,
  freq: "annual" | "quarterly"
): RatioSet {
  const set = freq === "annual" ? fin.annual : fin.quarterly;
  const ttm = freq === "quarterly";
  const ppy = ttm ? 4 : 1;

  const revenue = flowGetter(set, "revenue", ttm);
  const grossProfit = flowGetter(set, "grossProfit", ttm);
  const opIncome = flowGetter(set, "operatingIncome", ttm);
  const netIncome = flowGetter(set, "netIncome", ttm);
  const pretax = flowGetter(set, "pretaxIncome", ttm);
  const taxes = flowGetter(set, "taxes", ttm);
  const fcf = flowGetter(set, "fcf", ttm);
  const rd = flowGetter(set, "rd", ttm);

  const avgEquity = avgGetter(set, "equity", ppy);
  const avgAssets = avgGetter(set, "totalAssets", ppy);
  const equity = instantGetter(set, "equity");
  const stDebt = instantGetter(set, "stDebt");
  const ltDebt = instantGetter(set, "ltDebt");
  const currentAssets = instantGetter(set, "currentAssets");
  const currentLiabilities = instantGetter(set, "currentLiabilities");

  const totalDebt: Getter = (i) => {
    const lt = ltDebt(i);
    if (lt == null) return stDebt(i);
    return lt + (stDebt(i) ?? 0);
  };

  const nopat: Getter = (i) => {
    const op = opIncome(i);
    const pt = pretax(i);
    const tx = taxes(i);
    if (op != null && pt != null && tx != null && pt !== 0) {
      return op * (1 - tx / pt);
    }
    return netIncome(i);
  };

  const investedCapital: Getter = (i) => {
    const eq = equity(i);
    const debt = totalDebt(i);
    if (eq == null) return null;
    return eq + (debt ?? 0);
  };

  const defs: { key: string; label: string; format: RatioFormat; calc: Getter; note?: string }[] = [
    { key: "grossMargin", label: "Gross Margin", format: "pct", calc: (i) => div(grossProfit(i), revenue(i)) },
    { key: "opMargin", label: "Operating Margin", format: "pct", calc: (i) => div(opIncome(i), revenue(i)) },
    { key: "netMargin", label: "Net Margin", format: "pct", calc: (i) => div(netIncome(i), revenue(i)) },
    { key: "fcfMargin", label: "FCF Margin", format: "pct", calc: (i) => div(fcf(i), revenue(i)) },
    {
      key: "roe",
      label: "Return on Equity",
      format: "pct",
      calc: (i) => div(netIncome(i), avgEquity(i)),
      note: "Net income / average shareholders' equity",
    },
    {
      key: "roa",
      label: "Return on Assets",
      format: "pct",
      calc: (i) => div(netIncome(i), avgAssets(i)),
    },
    {
      key: "roic",
      label: "Return on Invested Capital",
      format: "pct",
      calc: (i) => div(nopat(i), investedCapital(i)),
      note: "After-tax operating profit / (equity + total debt)",
    },
    {
      key: "rdPct",
      label: "R&D % of Revenue",
      format: "pct",
      calc: (i) => div(rd(i), revenue(i)),
    },
    {
      key: "currentRatio",
      label: "Current Ratio",
      format: "x",
      calc: (i) => div(currentAssets(i), currentLiabilities(i)),
    },
    {
      key: "debtToEquity",
      label: "Debt / Equity",
      format: "x",
      calc: (i) => div(totalDebt(i), equity(i)),
    },
  ];

  // In quarterly (TTM) mode the oldest 3 quarters can't form a TTM window.
  const periods = ttm ? set.periods.slice(0, Math.max(0, set.periods.length - 3)) : set.periods;

  const lines: RatioLine[] = defs
    .map((d) => {
      const values: Record<string, number | null> = {};
      let any = false;
      periods.forEach((p, i) => {
        const v = d.calc(i);
        values[p.key] = v;
        if (v != null) any = true;
      });
      if (!any) return null;
      const line: RatioLine = { key: d.key, label: d.label, format: d.format, values };
      if (d.note) line.note = d.note;
      return line;
    })
    .filter((l): l is RatioLine => l !== null);

  return { periods, lines };
}
