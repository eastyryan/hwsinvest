// Tag-based one-time items and adjusted earnings.
//
// Impairments and restructuring are added back; gains on sale are stripped.
// Adjusted figures are null when no one-time tags exist for that period — they
// are never silently equal to reported. This is not Street / company-adjusted
// EBITDA: only the mapped impairment, restructuring, and gain-on-sale lines.

import type { LineValues, PeriodCol, StatementSet } from "./edgar";

/** US statutory fallback when the filing tax rate is not computable. */
export const STATUTORY_TAX_FALLBACK = 0.21;

export type OneTimeTag = "impairment" | "restructuring" | "gainOnSale";

export type TaxRateSource = "filings" | "statutory";

export interface AdjustedPeriodInputs {
  netIncome: number | null;
  operatingIncome: number | null;
  ebitda: number | null;
  da?: number | null;
  impairment: number | null;
  restructuring: number | null;
  gainOnSale: number | null;
  taxes: number | null;
  pretaxIncome: number | null;
}

export interface AdjustedPeriod {
  reportedNI: number | null;
  reportedOperatingIncome: number | null;
  reportedEbitda: number | null;
  impairment: number | null;
  restructuring: number | null;
  gainOnSale: number | null;
  /** (impairment ?? 0) + (restructuring ?? 0) − (gainOnSale ?? 0) when any tag exists. */
  oneTimePretax: number | null;
  taxRate: number | null;
  taxRateSource: TaxRateSource | null;
  oneTimeAfterTax: number | null;
  adjustedNI: number | null;
  adjustedEbitda: number | null;
  /** Which one-time line keys had a finite value this period. */
  tagsFired: OneTimeTag[];
  notes: string[];
}

export interface AdjustedEarningsSet {
  periods: PeriodCol[];
  rows: Array<AdjustedPeriod & { period: PeriodCol }>;
}

function findLine(set: StatementSet, key: string): LineValues | undefined {
  for (const st of set.statements) {
    const l = st.lines.find((line) => line.key === key);
    if (l) return l;
  }
  return undefined;
}

function finiteNum(v: number | null | undefined): number | null {
  return v != null && typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** Value of `key` in a named period, or null when the line or cell is missing. */
export function periodValue(
  set: StatementSet,
  key: string,
  periodKey: string
): number | null {
  const line = findLine(set, key);
  if (!line) return null;
  return finiteNum(line.values[periodKey]);
}

/** Newest-period value of `key`, or null. */
export function lastValue(set: StatementSet, key: string): number | null {
  const p = set.periods[0];
  if (!p) return null;
  return periodValue(set, key, p.key);
}

/**
 * Reported EBITDA: the ebitda line when present, else operating income + D&A
 * when either leg exists. Missing legs are not invented as a standalone figure.
 */
export function reportedEbitda(
  ebitda: number | null,
  operatingIncome: number | null,
  da: number | null
): number | null {
  const tagged = finiteNum(ebitda);
  if (tagged != null) return tagged;
  const op = finiteNum(operatingIncome);
  const dep = finiteNum(da);
  if (op == null && dep == null) return null;
  return (op ?? 0) + (dep ?? 0);
}

function filingTaxRate(
  taxes: number | null,
  pretaxIncome: number | null
): { rate: number; source: TaxRateSource } {
  const t = finiteNum(taxes);
  const p = finiteNum(pretaxIncome);
  if (t != null && p != null && p !== 0) {
    const rate = t / p;
    if (Number.isFinite(rate)) return { rate, source: "filings" };
  }
  return { rate: STATUTORY_TAX_FALLBACK, source: "statutory" };
}

/**
 * Adjust one period. Adjusted* stay null when no one-time tags fired — never
 * a silent copy of reported NI / EBITDA.
 */
export function computeAdjustedPeriod(inputs: AdjustedPeriodInputs): AdjustedPeriod {
  const reportedNI = finiteNum(inputs.netIncome);
  const reportedOperatingIncome = finiteNum(inputs.operatingIncome);
  const impairment = finiteNum(inputs.impairment);
  const restructuring = finiteNum(inputs.restructuring);
  const gainOnSale = finiteNum(inputs.gainOnSale);
  const ebitda = reportedEbitda(
    inputs.ebitda,
    inputs.operatingIncome,
    inputs.da ?? null
  );

  const tagsFired: OneTimeTag[] = [];
  if (impairment != null) tagsFired.push("impairment");
  if (restructuring != null) tagsFired.push("restructuring");
  if (gainOnSale != null) tagsFired.push("gainOnSale");

  const notes: string[] = [];

  if (tagsFired.length === 0) {
    return {
      reportedNI,
      reportedOperatingIncome,
      reportedEbitda: ebitda,
      impairment,
      restructuring,
      gainOnSale,
      oneTimePretax: null,
      taxRate: null,
      taxRateSource: null,
      oneTimeAfterTax: null,
      adjustedNI: null,
      adjustedEbitda: null,
      tagsFired,
      notes: [
        "No impairment, restructuring, or gain-on-sale tags this period — adjusted figures left blank.",
      ],
    };
  }

  const oneTimePretax =
    (impairment ?? 0) + (restructuring ?? 0) - (gainOnSale ?? 0);

  if (impairment != null) notes.push("impairment added back");
  if (restructuring != null) notes.push("restructuring added back");
  if (gainOnSale != null) notes.push("gain on sale stripped");

  const { rate: taxRate, source: taxRateSource } = filingTaxRate(
    inputs.taxes,
    inputs.pretaxIncome
  );
  if (taxRateSource === "filings") {
    notes.push("Tax-affected at filing rate (taxes / pre-tax income).");
  } else {
    notes.push("Tax-affected at 21% statutory fallback.");
  }

  const oneTimeAfterTax = oneTimePretax * (1 - taxRate);
  const adjustedNI = reportedNI == null ? null : reportedNI + oneTimeAfterTax;
  const adjustedEbitda = ebitda == null ? null : ebitda + oneTimePretax;

  notes.push(
    "Tag-based only — not Street / company-adjusted earnings or EBITDA."
  );

  return {
    reportedNI,
    reportedOperatingIncome,
    reportedEbitda: ebitda,
    impairment,
    restructuring,
    gainOnSale,
    oneTimePretax,
    taxRate,
    taxRateSource,
    oneTimeAfterTax,
    adjustedNI,
    adjustedEbitda,
    tagsFired,
    notes,
  };
}

function flowAt(
  set: StatementSet,
  key: string,
  periodIdx: number,
  ttm: boolean
): number | null {
  const line = findLine(set, key);
  if (!line) return null;
  if (!ttm) return finiteNum(line.values[set.periods[periodIdx]?.key]);
  let sum = 0;
  for (let k = periodIdx; k < periodIdx + 4; k++) {
    const p = set.periods[k];
    if (!p) return null;
    const v = finiteNum(line.values[p.key]);
    if (v == null) return null;
    sum += v;
  }
  return sum;
}

/**
 * Period-by-period adjusted earnings over a statement set.
 * Quarterly callers may pass `{ ttm: true }` to sum four flow quarters.
 */
export function buildAdjustedEarnings(
  set: StatementSet,
  opts?: { ttm?: boolean }
): AdjustedEarningsSet {
  const ttm = opts?.ttm === true;
  const periods = ttm
    ? set.periods.slice(0, Math.max(0, set.periods.length - 3))
    : set.periods;

  const rows = periods.map((period, i) => {
    const adj = computeAdjustedPeriod({
      netIncome: flowAt(set, "netIncome", i, ttm),
      operatingIncome: flowAt(set, "operatingIncome", i, ttm),
      ebitda: flowAt(set, "ebitda", i, ttm),
      da: flowAt(set, "da", i, ttm),
      impairment: flowAt(set, "impairment", i, ttm),
      restructuring: flowAt(set, "restructuring", i, ttm),
      gainOnSale: flowAt(set, "gainOnSale", i, ttm),
      taxes: flowAt(set, "taxes", i, ttm),
      pretaxIncome: flowAt(set, "pretaxIncome", i, ttm),
    });
    return { ...adj, period };
  });

  return { periods, rows };
}
