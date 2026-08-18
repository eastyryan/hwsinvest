/**
 * Simple debt capacity / credit metrics.
 *
 * Leverage headroom (max net debt / EBITDA) and interest coverage constraint
 * (EBIT / interest) — binding constraint is the tighter max debt.
 */

export type CreditInputs = {
  ebitda: number;
  ebit?: number | null;
  interestExpense?: number | null;
  netDebt?: number | null;
  totalDebt?: number | null;
  /** target max net debt / ebitda */
  maxLeverage?: number; // default 3.5
  /** min interest coverage EBIT/interest */
  minCoverage?: number; // default 3
  /** rate for capacity interest estimate */
  assumedRate?: number; // default 0.06
};

export type CreditResult = {
  currentLeverage: number | null;
  currentCoverage: number | null;
  maxDebtAtLeverage: number | null;
  debtCapacityHeadroom: number | null; // max - current totalDebt
  maxDebtAtCoverage: number | null;
  bindingConstraint: "leverage" | "coverage" | "none" | "insufficient_data";
  notes: string[];
};

const DEFAULT_MAX_LEVERAGE = 3.5;
const DEFAULT_MIN_COVERAGE = 3;
const DEFAULT_ASSUMED_RATE = 0.06;

function isFiniteNumber(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

export function runCreditCapacity(inputs: CreditInputs): CreditResult {
  const notes: string[] = [];

  const ebitda = inputs.ebitda;
  const ebit = isFiniteNumber(inputs.ebit) ? inputs.ebit : null;
  const interest = isFiniteNumber(inputs.interestExpense)
    ? inputs.interestExpense
    : null;
  const netDebt = isFiniteNumber(inputs.netDebt) ? inputs.netDebt : null;
  const totalDebt = isFiniteNumber(inputs.totalDebt) ? inputs.totalDebt : null;

  const maxLeverage = isFiniteNumber(inputs.maxLeverage)
    ? inputs.maxLeverage
    : DEFAULT_MAX_LEVERAGE;
  const minCoverage = isFiniteNumber(inputs.minCoverage)
    ? inputs.minCoverage
    : DEFAULT_MIN_COVERAGE;
  const assumedRate = isFiniteNumber(inputs.assumedRate)
    ? inputs.assumedRate
    : DEFAULT_ASSUMED_RATE;

  let currentLeverage: number | null = null;
  if (isFiniteNumber(ebitda) && ebitda !== 0 && netDebt != null) {
    currentLeverage = netDebt / ebitda;
  } else if (!isFiniteNumber(ebitda) || ebitda === 0) {
    notes.push("EBITDA missing or zero — current leverage unavailable");
  } else if (netDebt == null) {
    notes.push("Net debt missing — current leverage unavailable");
  }

  let currentCoverage: number | null = null;
  if (ebit != null && interest != null && interest !== 0) {
    currentCoverage = ebit / interest;
  } else if (ebit != null && (interest == null || interest === 0)) {
    notes.push("Interest expense missing or zero — current coverage unavailable");
  } else if (ebit == null) {
    notes.push("EBIT missing — current coverage unavailable");
  }

  let maxDebtAtLeverage: number | null = null;
  if (isFiniteNumber(ebitda) && ebitda > 0 && isFiniteNumber(maxLeverage)) {
    maxDebtAtLeverage = maxLeverage * ebitda;
  }

  let maxDebtAtCoverage: number | null = null;
  if (
    ebit != null &&
    ebit > 0 &&
    isFiniteNumber(minCoverage) &&
    minCoverage > 0 &&
    isFiniteNumber(assumedRate) &&
    assumedRate > 0
  ) {
    // Max interest = EBIT / minCoverage; max debt = maxInterest / rate
    const maxInterest = ebit / minCoverage;
    maxDebtAtCoverage = maxInterest / assumedRate;
  } else if (ebit != null && ebit > 0 && !(assumedRate > 0)) {
    notes.push("Assumed rate must be positive for coverage-based capacity");
  }

  // Headroom vs leverage cap: maxDebtAtLeverage − totalDebt (per type contract)
  let debtCapacityHeadroom: number | null = null;
  if (maxDebtAtLeverage != null && totalDebt != null) {
    debtCapacityHeadroom = maxDebtAtLeverage - totalDebt;
  } else if (maxDebtAtLeverage != null && totalDebt == null) {
    notes.push("Total debt missing — leverage headroom not computed");
  }

  let bindingConstraint: CreditResult["bindingConstraint"] = "insufficient_data";

  const hasLev = maxDebtAtLeverage != null;
  const hasCov = maxDebtAtCoverage != null;

  if (!hasLev && !hasCov) {
    bindingConstraint = "insufficient_data";
    notes.push("Insufficient data for both leverage and coverage capacity");
  } else if (hasLev && !hasCov) {
    bindingConstraint = "leverage";
    notes.push("Only leverage constraint available");
  } else if (!hasLev && hasCov) {
    bindingConstraint = "coverage";
    notes.push("Only coverage constraint available");
  } else if (hasLev && hasCov) {
    // Tighter (lower) max debt binds
    if (maxDebtAtLeverage! < maxDebtAtCoverage!) {
      bindingConstraint = "leverage";
    } else if (maxDebtAtCoverage! < maxDebtAtLeverage!) {
      bindingConstraint = "coverage";
    } else {
      bindingConstraint = "none"; // equal — neither uniquely binding
      notes.push("Leverage and coverage caps are equal");
    }
  }

  return {
    currentLeverage,
    currentCoverage,
    maxDebtAtLeverage,
    debtCapacityHeadroom,
    maxDebtAtCoverage,
    bindingConstraint,
    notes,
  };
}
