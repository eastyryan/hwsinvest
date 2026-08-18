// Quality-of-earnings metrics from already-normalized SEC statement lines.
// Annual mode uses fiscal-year values; quarterly mode uses trailing-twelve-month
// sums for flow items so ratios stay comparable quarter to quarter.
//
// Deterministic only: every number is NI − OCF, OCF / NI, etc. Missing tags or
// non-meaningful denominators (negative NI, zero revenue) yield null, never a
// invented figure.

import type { CompanyFinancials, StatementSet, LineValues, PeriodCol } from "./edgar";
import { computeAdjustedPeriod } from "./adjusted-earnings";

export type QoeFormat = "pct" | "x" | "days" | "money";

export interface QoeLine {
  key: string;
  label: string;
  format: QoeFormat;
  values: Record<string, number | null>;
  /** Short plain-English note under the label when the metric has caveats. */
  note?: string;
  /** Tag-based one-time add-back rows — hidden unless the Adjusted view is on. */
  adjusted?: boolean;
}

export interface QualityOfEarningsSet {
  periods: PeriodCol[];
  lines: QoeLine[];
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

const div = (a: number | null, b: number | null): number | null =>
  a != null && b != null && b !== 0 ? a / b : null;

/** Ratio only when the denominator is strictly positive (profit years, etc.). */
const divPositive = (a: number | null, b: number | null): number | null =>
  a != null && b != null && b > 0 ? a / b : null;

/** Capex is stored negative (outflow); intensity uses magnitude. */
function absOrNull(v: number | null): number | null {
  return v == null ? null : Math.abs(v);
}

/**
 * Build multi-period quality-of-earnings metrics from normalized statements.
 *
 * Lines with no computable value in any period are omitted (same pattern as
 * buildRatios). Conversion ratios require NI > 0; otherwise the cell is null.
 */
export function buildQualityOfEarnings(
  fin: CompanyFinancials,
  freq: "annual" | "quarterly"
): QualityOfEarningsSet {
  const set = freq === "annual" ? fin.annual : fin.quarterly;
  const ttm = freq === "quarterly";
  const yearDays = 365;

  const revenue = flowGetter(set, "revenue", ttm);
  const netIncome = flowGetter(set, "netIncome", ttm);
  const ocf = flowGetter(set, "ocf", ttm);
  const fcf = flowGetter(set, "fcf", ttm);
  const sbc = flowGetter(set, "sbc", ttm);
  const capex = flowGetter(set, "capex", ttm);
  const opex = flowGetter(set, "opex", ttm);
  const cogs = flowGetter(set, "cogs", ttm);

  const receivables = instantGetter(set, "receivables");
  const inventory = instantGetter(set, "inventory");
  const payables = instantGetter(set, "payables");
  const totalAssets = instantGetter(set, "totalAssets");

  const operatingIncome = flowGetter(set, "operatingIncome", ttm);
  const ebitdaLine = flowGetter(set, "ebitda", ttm);
  const da = flowGetter(set, "da", ttm);
  const impairment = flowGetter(set, "impairment", ttm);
  const restructuring = flowGetter(set, "restructuring", ttm);
  const gainOnSale = flowGetter(set, "gainOnSale", ttm);
  const taxes = flowGetter(set, "taxes", ttm);
  const pretaxIncome = flowGetter(set, "pretaxIncome", ttm);

  const accruals: Getter = (i) => {
    const ni = netIncome(i);
    const cfo = ocf(i);
    if (ni == null || cfo == null) return null;
    return ni - cfo;
  };

  // Prefer COGS for inventory/payables days; fall back to revenue so service
  // companies without COGS still get a DSO-style signal for payables.
  const costBase: Getter = (i) => {
    const c = cogs(i);
    if (c != null && c > 0) return c;
    return revenue(i);
  };

  const defs: {
    key: string;
    label: string;
    format: QoeFormat;
    calc: Getter;
    note?: string;
  }[] = [
    {
      key: "accruals",
      label: "Accruals (NI − OCF)",
      format: "money",
      calc: accruals,
      note: "Positive means earnings exceed cash from operations.",
    },
    {
      key: "accrualsToRevenue",
      label: "Accruals / Revenue",
      format: "pct",
      calc: (i) => div(accruals(i), revenue(i)),
      note: "Lower (or more negative) is generally higher cash quality.",
    },
    {
      key: "accrualsToAssets",
      label: "Accruals / Assets",
      format: "pct",
      calc: (i) => div(accruals(i), totalAssets(i)),
    },
    {
      key: "cashConversion",
      label: "Cash conversion (OCF / NI)",
      format: "x",
      calc: (i) => divPositive(ocf(i), netIncome(i)),
      note: "Not meaningful when net income is zero or negative.",
    },
    {
      key: "fcfConversion",
      label: "FCF conversion (FCF / NI)",
      format: "x",
      calc: (i) => divPositive(fcf(i), netIncome(i)),
      note: "Not meaningful when net income is zero or negative.",
    },
    {
      key: "sbcToRevenue",
      label: "SBC / Revenue",
      format: "pct",
      calc: (i) => div(absOrNull(sbc(i)), revenue(i)),
      note: "Stock-based compensation intensity vs. sales.",
    },
    {
      key: "sbcToOpex",
      label: "SBC / Operating expenses",
      format: "pct",
      // Only surface when revenue-based intensity is unavailable for the whole
      // series — otherwise it duplicates the revenue line. Handled after map.
      calc: (i) => div(absOrNull(sbc(i)), opex(i)),
      note: "Shown when revenue is missing; SBC as a share of opex.",
    },
    {
      key: "capexIntensity",
      label: "Capex / Revenue",
      format: "pct",
      calc: (i) => div(absOrNull(capex(i)), revenue(i)),
      note: "Capital expenditure intensity (magnitude of capex).",
    },
    {
      key: "dso",
      label: "Days sales outstanding",
      format: "days",
      calc: (i) => {
        const r = divPositive(receivables(i), revenue(i));
        return r == null ? null : r * yearDays;
      },
      note: "Receivables / revenue × 365.",
    },
    {
      key: "dio",
      label: "Days inventory outstanding",
      format: "days",
      calc: (i) => {
        const r = divPositive(inventory(i), costBase(i));
        return r == null ? null : r * yearDays;
      },
      note: "Inventory / COGS (or revenue) × 365.",
    },
    {
      key: "dpo",
      label: "Days payables outstanding",
      format: "days",
      calc: (i) => {
        const r = divPositive(payables(i), costBase(i));
        return r == null ? null : r * yearDays;
      },
      note: "Payables / COGS (or revenue) × 365.",
    },
    {
      key: "ccc",
      label: "Cash conversion cycle",
      format: "days",
      calc: (i) => {
        const dsoR = divPositive(receivables(i), revenue(i));
        const dioR = divPositive(inventory(i), costBase(i));
        const dpoR = divPositive(payables(i), costBase(i));
        // Need at least one working-capital component; missing pieces count as 0
        // only when another component is present so a pure-services DSO still works.
        if (dsoR == null && dioR == null && dpoR == null) return null;
        const dso = (dsoR ?? 0) * yearDays;
        const dio = (dioR ?? 0) * yearDays;
        const dpo = (dpoR ?? 0) * yearDays;
        // If only DPO exists (no AR/inventory), CCC = −DPO is still informative.
        if (dsoR == null && dioR == null && dpoR != null) return -dpo;
        return dso + dio - dpo;
      },
      note: "DSO + DIO − DPO. Missing components treated as zero when others exist.",
    },
  ];

  const periods = ttm
    ? set.periods.slice(0, Math.max(0, set.periods.length - 3))
    : set.periods;

  const rawLines: QoeLine[] = defs
    .map((d) => {
      const values: Record<string, number | null> = {};
      let any = false;
      periods.forEach((p, i) => {
        const v = d.calc(i);
        values[p.key] = v;
        if (v != null) any = true;
      });
      if (!any) return null;
      const line: QoeLine = {
        key: d.key,
        label: d.label,
        format: d.format,
        values,
      };
      if (d.note) line.note = d.note;
      return line;
    })
    .filter((l): l is QoeLine => l !== null);

  // Prefer SBC / revenue; only keep SBC / opex when the revenue line is absent.
  const hasSbcRev = rawLines.some((l) => l.key === "sbcToRevenue");
  const lines = hasSbcRev
    ? rawLines.filter((l) => l.key !== "sbcToOpex")
    : rawLines;

  const adjRows = periods.map((_, i) =>
    computeAdjustedPeriod({
      netIncome: netIncome(i),
      operatingIncome: operatingIncome(i),
      ebitda: ebitdaLine(i),
      da: da(i),
      impairment: impairment(i),
      restructuring: restructuring(i),
      gainOnSale: gainOnSale(i),
      taxes: taxes(i),
      pretaxIncome: pretaxIncome(i),
    })
  );

  const extraDefs: {
    key: string;
    label: string;
    format: QoeFormat;
    pick: (i: number) => number | null;
    note: string;
  }[] = [
    {
      key: "adjustedNI",
      label: "Adjusted NI (ex one-time)",
      format: "money",
      pick: (i) => adjRows[i]?.adjustedNI ?? null,
      note: "Tag-based add-back of impairment/restructuring; tagged gains removed. Not Street adjusted earnings.",
    },
    {
      key: "adjustedEbitda",
      label: "Adjusted EBITDA (ex one-time)",
      format: "money",
      pick: (i) => adjRows[i]?.adjustedEbitda ?? null,
      note: "Tag-based, not a full Street adjusted EBITDA. Adds back impairment and restructuring; strips gains on sale.",
    },
    {
      key: "oneTimePretax",
      label: "One-time items (pretax)",
      format: "money",
      pick: (i) => adjRows[i]?.oneTimePretax ?? null,
      note: "Impairment + restructuring − gain on sale when those tags exist. Missing tags are omitted, not zeroed.",
    },
  ];

  for (const d of extraDefs) {
    const values: Record<string, number | null> = {};
    let any = false;
    periods.forEach((p, i) => {
      const v = d.pick(i);
      values[p.key] = v;
      if (v != null) any = true;
    });
    if (!any) continue;
    lines.push({
      key: d.key,
      label: d.label,
      format: d.format,
      values,
      note: d.note,
      adjusted: true,
    });
  }

  return { periods, lines };
}
