/**
 * TTM / fiscal-year period helpers for trading comps.
 *
 * Pure functions over StatementSet. Flow items (revenue, EBITDA, EBIT, NI)
 * prefer a four-quarter TTM when it exists; balance-sheet items stay point-in-time.
 * There is no FactSet calendarization engine here — just as-filed periods.
 */

import type { CompanyFinancials, StatementSet } from "@/lib/research/edgar";

export type OperatingBasis = "ttm" | "fy";

export type OperatingPeriodChoice = {
  basis: OperatingBasis;
  periodEnd: string | null;
  periodLabel: string;
};

export type CompOperatingSlice = {
  revenue: number | null;
  ebitda: number | null;
  ebit: number | null;
  netIncome: number | null;
  shares: number | null;
  cash: number | null;
  debt: number | null;
  netDebt: number | null;
  basis: OperatingBasis;
  periodEnd: string | null;
  periodLabel: string;
};

function isFiniteNumber(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

function findLineValue(set: StatementSet, key: string, periodKey: string): number | null {
  for (const st of set.statements) {
    const line = st.lines.find((x) => x.key === key);
    if (!line) continue;
    const v = line.values[periodKey];
    return isFiniteNumber(v) ? v : null;
  }
  return null;
}

/** Last (newest) period value for a statement line key, or null. */
export function lastLine(set: StatementSet, key: string): number | null {
  const p = set.periods[0];
  if (!p) return null;
  return findLineValue(set, key, p.key);
}

/**
 * Sum of the newest 4 quarterly periods for a flow line.
 * Returns null unless all four period columns exist and every value is finite.
 */
export function ttmSum(set: StatementSet, key: string): number | null {
  if (set.periods.length < 4) return null;
  let sum = 0;
  for (let i = 0; i < 4; i++) {
    const p = set.periods[i];
    if (!p) return null;
    const v = findLineValue(set, key, p.key);
    if (v == null) return null;
    sum += v;
  }
  return sum;
}

/** Newest period end date (ISO), or null when the set is empty. */
export function fiscalEnd(set: StatementSet): string | null {
  const end = set.periods[0]?.end;
  return typeof end === "string" && end.length > 0 ? end : null;
}

/**
 * Prefer TTM for flow items when four quarterly periods exist; else last annual FY.
 */
export function chooseOperatingBasis(
  annual: StatementSet,
  quarterly: StatementSet
): OperatingPeriodChoice {
  const qEnd = fiscalEnd(quarterly);
  if (quarterly.periods.length >= 4 && qEnd) {
    return {
      basis: "ttm",
      periodEnd: qEnd,
      periodLabel: `TTM ended ${qEnd}`,
    };
  }
  const aEnd = fiscalEnd(annual);
  const fyLabel = annual.periods[0]?.label;
  return {
    basis: "fy",
    periodEnd: aEnd,
    periodLabel:
      fyLabel && fyLabel.length > 0
        ? fyLabel
        : aEnd
          ? `FY ended ${aEnd}`
          : "FY",
  };
}

/** Calendar month 1–12 from an ISO date (YYYY-MM-DD…), or null. */
export function periodEndMonth(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})/.exec(iso);
  if (!m) return null;
  const month = Number(m[2]);
  return Number.isInteger(month) && month >= 1 && month <= 12 ? month : null;
}

/**
 * Circular month distance between two ISO period ends (0–6), or null if either
 * date is missing / unparseable.
 */
export function fiscalMonthGap(
  a: string | null | undefined,
  b: string | null | undefined
): number | null {
  const ma = periodEndMonth(a);
  const mb = periodEndMonth(b);
  if (ma == null || mb == null) return null;
  const d = Math.abs(ma - mb);
  return Math.min(d, 12 - d);
}

/**
 * True when FY-end months differ by more than 2 months and at least one side
 * is still on a fiscal-year (not TTM) basis.
 */
export function needsCalendarizationWarning(
  subject: { basis?: OperatingBasis; periodEnd?: string | null },
  peer: { basis?: OperatingBasis; periodEnd?: string | null }
): boolean {
  if (subject.basis !== "fy" && peer.basis !== "fy") return false;
  const gap = fiscalMonthGap(subject.periodEnd, peer.periodEnd);
  return gap != null && gap > 2;
}

function flowPreferTtm(
  annual: StatementSet,
  quarterly: StatementSet,
  key: string
): number | null {
  const ttm = ttmSum(quarterly, key);
  if (ttm != null) return ttm;
  return lastLine(annual, key);
}

function ebitdaPreferTtm(
  annual: StatementSet,
  quarterly: StatementSet
): number | null {
  const ttmDirect = ttmSum(quarterly, "ebitda");
  if (ttmDirect != null) return ttmDirect;
  const ttmEbit = ttmSum(quarterly, "operatingIncome");
  const ttmDa = ttmSum(quarterly, "da");
  if (ttmEbit != null || ttmDa != null) {
    return (ttmEbit ?? 0) + (ttmDa ?? 0);
  }
  const fyDirect = lastLine(annual, "ebitda");
  if (fyDirect != null) return fyDirect;
  const fyEbit = lastLine(annual, "operatingIncome");
  const fyDa = lastLine(annual, "da");
  if (fyEbit != null || fyDa != null) {
    return (fyEbit ?? 0) + (fyDa ?? 0);
  }
  return null;
}

function lastLinePrefer(
  primary: StatementSet,
  fallback: StatementSet,
  key: string
): number | null {
  return lastLine(primary, key) ?? lastLine(fallback, key);
}

/**
 * Subject/peer operating snapshot: TTM flows when four quarters exist,
 * latest balance-sheet cash / debt / shares (quarterly preferred under TTM).
 */
export function compOperatingFromFinancials(
  fin: CompanyFinancials
): CompOperatingSlice {
  const annual = fin.annual;
  const quarterly = fin.quarterly;
  const choice = chooseOperatingBasis(annual, quarterly);

  const revenue = flowPreferTtm(annual, quarterly, "revenue");
  const ebit = flowPreferTtm(annual, quarterly, "operatingIncome");
  const netIncome = flowPreferTtm(annual, quarterly, "netIncome");
  const ebitda = ebitdaPreferTtm(annual, quarterly);

  const bsPrimary =
    choice.basis === "ttm" && quarterly.periods.length > 0 ? quarterly : annual;
  const bsFallback = bsPrimary === quarterly ? annual : quarterly;

  const shares = lastLinePrefer(bsPrimary, bsFallback, "sharesDiluted");
  const cash = lastLinePrefer(bsPrimary, bsFallback, "cash");
  const st = lastLinePrefer(bsPrimary, bsFallback, "stDebt");
  const lt = lastLinePrefer(bsPrimary, bsFallback, "ltDebt");

  let debt: number | null = null;
  if (st != null || lt != null) {
    debt = (st ?? 0) + (lt ?? 0);
  }

  let netDebt: number | null = null;
  if (debt != null || cash != null) {
    netDebt = (debt ?? 0) - (cash ?? 0);
  }

  return {
    revenue,
    ebitda,
    ebit,
    netIncome,
    shares,
    cash,
    debt,
    netDebt,
    basis: choice.basis,
    periodEnd: choice.periodEnd,
    periodLabel: choice.periodLabel,
  };
}
