/**
 * Simple PE-style LBO valuation engine.
 *
 * Sources & Uses → dual-tranche debt (term loan + senior notes) → annual FCF
 * with mandatory TL amort and cash sweep → exit equity proceeds → MOIC / IRR.
 *
 * Intentionally lightweight (no revolver, no PIK, no working-capital schedule).
 *
 * Tax is on (EBIT − interest) = (EBITDA − D&A − interest), not on EBITDA − interest.
 * Interest is charged on beginning balances so the paydown / tax loop does not
 * circularise — the usual PE-model shortcut, not a mid-year revolver solve.
 */

export type LboInputs = {
  entryEbitda: number;
  entryMultiple: number; // EV / EBITDA
  /** Total entry debt / entry EBITDA */
  leverageMultiple: number;
  /** Split of debt: term loan share of total debt (0-1); rest senior notes */
  termLoanShare?: number; // default 0.6
  termLoanRate?: number; // default 0.07
  notesRate?: number; // default 0.09
  /** Mandatory annual amort of beginning term loan balance */
  termLoanAmortPct?: number; // default 0.05
  ebitdaGrowth: number; // constant annual
  ebitdaMargin?: number; // optional for revenue path display only
  years: number; // hold period 3-7 typical, clamp 1-10
  taxRate?: number; // default 0.21
  /** D&A as % of that year's EBITDA; default 0.10. Set 0 to recover the old tax base. */
  daPctEbitda?: number;
  /** Capex + NWC as % of EBITDA for FCF approx (simple PE model) */
  reinvestmentPctEbitda?: number; // default 0.15
  cashSweepPct?: number; // default 1.0 of excess cash after mandatory amort
  exitMultiple: number;
  /** Optional transaction fees as % of entry EV */
  feesPctEv?: number; // default 0.02 added to uses / equity
};

export type LboYear = {
  year: number;
  ebitda: number;
  da: number;
  ebit: number;
  interest: number;
  ebt: number;
  tax: number;
  nopat: number;
  ni: number;
  reinvestment: number;
  fcf: number; // before debt paydown
  mandatoryAmort: number;
  optionalPaydown: number;
  totalPaydown: number;
  beginningDebt: number;
  endingDebt: number;
  termLoanEnd: number;
  notesEnd: number;
  netDebtEbitda: number;
  interestCoverage: number | null;
};

export type LboResult = {
  inputs: Required<LboInputs>;
  sourcesAndUses: {
    entryEv: number;
    fees: number;
    totalUses: number;
    termLoan: number;
    notes: number;
    totalDebt: number;
    sponsorEquity: number;
    totalSources: number;
  };
  years: LboYear[];
  exit: {
    ebitda: number;
    exitEv: number;
    netDebt: number;
    equityProceeds: number;
  };
  returns: {
    moic: number | null;
    irr: number | null; // annualized
    equityIn: number;
    equityOut: number;
  };
  notes: string[];
};

const DEFAULTS = {
  termLoanShare: 0.6,
  termLoanRate: 0.07,
  notesRate: 0.09,
  termLoanAmortPct: 0.05,
  ebitdaMargin: 0,
  taxRate: 0.21,
  daPctEbitda: 0.1,
  reinvestmentPctEbitda: 0.15,
  cashSweepPct: 1.0,
  feesPctEv: 0.02,
} as const;

const MAX_LEVERAGE = 6.5;
const DEFAULT_LEVERAGE = 4.5;
const DEFAULT_ENTRY_MULTIPLE = 12;
const DEFAULT_GROWTH = 0.05;
const DEFAULT_YEARS = 5;

function isFiniteNumber(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/**
 * Build starter LBO inputs from reported metrics.
 * Returns null when EBITDA is missing or non-positive.
 * D&A as % of EBITDA is left unset here; resolveInputs defaults it to 10%.
 */
export function defaultLboInputsFromMetrics(m: {
  ebitda: number | null;
  netDebt: number | null;
  revenue?: number | null;
}): LboInputs | null {
  if (!isFiniteNumber(m.ebitda) || m.ebitda <= 0) return null;

  const entryEbitda = m.ebitda;
  const entryMultiple = DEFAULT_ENTRY_MULTIPLE;

  let leverageMultiple: number;
  if (!isFiniteNumber(m.netDebt)) {
    leverageMultiple = DEFAULT_LEVERAGE;
  } else {
    leverageMultiple = clamp(m.netDebt / entryEbitda, 0, MAX_LEVERAGE);
  }

  const out: LboInputs = {
    entryEbitda,
    entryMultiple,
    leverageMultiple,
    ebitdaGrowth: DEFAULT_GROWTH,
    years: DEFAULT_YEARS,
    exitMultiple: entryMultiple,
    daPctEbitda: DEFAULTS.daPctEbitda,
  };

  if (isFiniteNumber(m.revenue) && m.revenue > 0) {
    out.ebitdaMargin = entryEbitda / m.revenue;
  }

  return out;
}

function resolveInputs(inputs: LboInputs): Required<LboInputs> | null {
  if (!isFiniteNumber(inputs.entryEbitda) || inputs.entryEbitda <= 0) return null;
  if (!isFiniteNumber(inputs.entryMultiple) || inputs.entryMultiple <= 0) return null;
  if (!isFiniteNumber(inputs.exitMultiple) || inputs.exitMultiple <= 0) return null;
  if (!isFiniteNumber(inputs.ebitdaGrowth)) return null;

  const years = clamp(Math.round(inputs.years), 1, 10);
  if (!Number.isFinite(years) || years < 1) return null;

  const rawLev = isFiniteNumber(inputs.leverageMultiple) ? inputs.leverageMultiple : DEFAULT_LEVERAGE;
  const leverageMultiple = clamp(rawLev, 0, MAX_LEVERAGE);

  const termLoanShare = clamp(
    isFiniteNumber(inputs.termLoanShare) ? inputs.termLoanShare! : DEFAULTS.termLoanShare,
    0,
    1
  );
  const termLoanRate = isFiniteNumber(inputs.termLoanRate)
    ? Math.max(0, inputs.termLoanRate!)
    : DEFAULTS.termLoanRate;
  const notesRate = isFiniteNumber(inputs.notesRate)
    ? Math.max(0, inputs.notesRate!)
    : DEFAULTS.notesRate;
  const termLoanAmortPct = clamp(
    isFiniteNumber(inputs.termLoanAmortPct)
      ? inputs.termLoanAmortPct!
      : DEFAULTS.termLoanAmortPct,
    0,
    1
  );
  const taxRate = clamp(
    isFiniteNumber(inputs.taxRate) ? inputs.taxRate! : DEFAULTS.taxRate,
    0,
    1
  );
  const daPctEbitda = isFiniteNumber(inputs.daPctEbitda)
    ? Math.max(0, inputs.daPctEbitda!)
    : DEFAULTS.daPctEbitda;
  const reinvestmentPctEbitda = isFiniteNumber(inputs.reinvestmentPctEbitda)
    ? inputs.reinvestmentPctEbitda!
    : DEFAULTS.reinvestmentPctEbitda;
  const cashSweepPct = clamp(
    isFiniteNumber(inputs.cashSweepPct) ? inputs.cashSweepPct! : DEFAULTS.cashSweepPct,
    0,
    1
  );
  const feesPctEv = Math.max(
    0,
    isFiniteNumber(inputs.feesPctEv) ? inputs.feesPctEv! : DEFAULTS.feesPctEv
  );
  const ebitdaMargin = isFiniteNumber(inputs.ebitdaMargin)
    ? inputs.ebitdaMargin!
    : DEFAULTS.ebitdaMargin;

  return {
    entryEbitda: inputs.entryEbitda,
    entryMultiple: inputs.entryMultiple,
    leverageMultiple,
    termLoanShare,
    termLoanRate,
    notesRate,
    termLoanAmortPct,
    ebitdaGrowth: inputs.ebitdaGrowth,
    ebitdaMargin,
    years,
    taxRate,
    daPctEbitda,
    reinvestmentPctEbitda,
    cashSweepPct,
    exitMultiple: inputs.exitMultiple,
    feesPctEv,
  };
}

/**
 * NPV of cash flows at rate r (annual compounding, end-of-period).
 * CF[0] is t=0 (entry).
 */
export function npv(rate: number, cashFlows: number[]): number {
  let total = 0;
  for (let t = 0; t < cashFlows.length; t++) {
    total += cashFlows[t]! / Math.pow(1 + rate, t);
  }
  return total;
}

/**
 * Annualized IRR via Newton–Raphson with bisection fallback.
 * Returns null when no sensible root exists (e.g. all non-positive outflows).
 */
export function solveIrr(cashFlows: number[]): number | null {
  if (cashFlows.length < 2) return null;
  const hasPos = cashFlows.some((c) => c > 0);
  const hasNeg = cashFlows.some((c) => c < 0);
  if (!hasPos || !hasNeg) return null;

  // Closed form when only CF0 and CFn are non-zero (classic LBO equity).
  const nonzero: { t: number; v: number }[] = [];
  for (let t = 0; t < cashFlows.length; t++) {
    if (cashFlows[t] !== 0) nonzero.push({ t, v: cashFlows[t]! });
  }
  if (
    nonzero.length === 2 &&
    nonzero[0]!.t === 0 &&
    nonzero[0]!.v < 0 &&
    nonzero[1]!.v > 0
  ) {
    const n = nonzero[1]!.t;
    const ratio = -nonzero[1]!.v / nonzero[0]!.v;
    if (ratio <= 0 || n <= 0) return null;
    return Math.pow(ratio, 1 / n) - 1;
  }

  // Newton–Raphson
  let r = 0.1;
  for (let i = 0; i < 50; i++) {
    let f = 0;
    let df = 0;
    for (let t = 0; t < cashFlows.length; t++) {
      const cf = cashFlows[t]!;
      const denom = Math.pow(1 + r, t);
      f += cf / denom;
      if (t > 0) df -= (t * cf) / Math.pow(1 + r, t + 1);
    }
    if (!Number.isFinite(f) || !Number.isFinite(df) || Math.abs(df) < 1e-14) break;
    const next = r - f / df;
    if (!Number.isFinite(next) || next <= -0.999999) break;
    if (Math.abs(next - r) < 1e-10) return next;
    r = next;
  }

  // Bisection on (-0.999, 10), expand hi for high-return deals
  let lo = -0.999;
  let hi = 10;
  let fLo = npv(lo, cashFlows);
  let fHi = npv(hi, cashFlows);
  if (!Number.isFinite(fLo) || !Number.isFinite(fHi) || fLo * fHi > 0) {
    hi = 50;
    fHi = npv(hi, cashFlows);
    if (!Number.isFinite(fHi) || fLo * fHi > 0) return null;
  }
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    const fMid = npv(mid, cashFlows);
    if (!Number.isFinite(fMid) || Math.abs(fMid) < 1e-10) return mid;
    if (fLo * fMid <= 0) {
      hi = mid;
      fHi = fMid;
    } else {
      lo = mid;
      fLo = fMid;
    }
  }
  return (lo + hi) / 2;
}

/**
 * Run the LBO model. Returns null when core inputs are invalid.
 */
export function runLbo(inputs: LboInputs): LboResult | null {
  const resolved = resolveInputs(inputs);
  if (!resolved) return null;

  const notes: string[] = [];
  if (resolved.years !== Math.round(inputs.years)) {
    notes.push(`Hold period clamped to ${resolved.years} years (allowed 1–10).`);
  }
  if (
    isFiniteNumber(inputs.leverageMultiple) &&
    inputs.leverageMultiple !== resolved.leverageMultiple
  ) {
    notes.push(
      `Leverage clamped to ${resolved.leverageMultiple.toFixed(2)}× (cap ${MAX_LEVERAGE}×).`
    );
  }

  const entryEv = resolved.entryEbitda * resolved.entryMultiple;
  const fees = entryEv * resolved.feesPctEv;
  const totalUses = entryEv + fees;
  const totalDebt = resolved.entryEbitda * resolved.leverageMultiple;
  const termLoan0 = totalDebt * resolved.termLoanShare;
  const notes0 = totalDebt - termLoan0;
  const sponsorEquity = totalUses - totalDebt;
  const totalSources = totalDebt + sponsorEquity;

  if (sponsorEquity <= 0) {
    notes.push(
      "Sponsor equity is non-positive (debt + fees cover or exceed uses); returns undefined."
    );
  }
  if (resolved.leverageMultiple === 0) {
    notes.push("Zero leverage: all-equity buyout; debt schedule is empty.");
  }
  notes.push(
    `Tax on (EBIT − interest) with D&A at ${(resolved.daPctEbitda * 100).toFixed(0)}% of EBITDA; interest on beginning balances.`
  );

  let termLoan = termLoan0;
  let notesBal = notes0;
  const yearsOut: LboYear[] = [];

  for (let y = 1; y <= resolved.years; y++) {
    const beginningDebt = termLoan + notesBal;
    const ebitda = resolved.entryEbitda * Math.pow(1 + resolved.ebitdaGrowth, y);
    const da = ebitda * resolved.daPctEbitda;
    const ebit = ebitda - da;
    // Interest on beginning balances — avoids a circular paydown / tax solve.
    const interest = termLoan * resolved.termLoanRate + notesBal * resolved.notesRate;
    const ebt = ebit - interest;
    // Cash tax on EBIT − interest; no refund on losses
    const tax = ebt > 0 ? ebt * resolved.taxRate : 0;
    const ni = ebt - tax;
    const nopat = ni;
    const reinvestment = ebitda * resolved.reinvestmentPctEbitda;
    // ni + da − reinvestment ≡ ebitda − interest − tax − reinvestment
    const fcf = ni + da - reinvestment;

    // Debt paydown: never go negative; mandatory TL amort first, then sweep.
    let cashForDebt = Math.max(0, fcf);
    const scheduledAmort = termLoan * resolved.termLoanAmortPct;
    const mandatoryAmort = Math.min(scheduledAmort, termLoan, cashForDebt);
    termLoan -= mandatoryAmort;
    cashForDebt -= mandatoryAmort;

    const sweepBudget = cashForDebt * resolved.cashSweepPct;
    let optionalPaydown = 0;
    // Sweep term loan first, then senior notes
    const tlSweep = Math.min(sweepBudget, termLoan);
    termLoan -= tlSweep;
    optionalPaydown += tlSweep;
    const remainingSweep = sweepBudget - tlSweep;
    const notesSweep = Math.min(remainingSweep, notesBal);
    notesBal -= notesSweep;
    optionalPaydown += notesSweep;

    // Numerical floor
    if (termLoan < 1e-9) termLoan = 0;
    if (notesBal < 1e-9) notesBal = 0;

    const totalPaydown = mandatoryAmort + optionalPaydown;
    const endingDebt = termLoan + notesBal;
    const netDebtEbitda = ebitda > 0 ? endingDebt / ebitda : 0;
    const interestCoverage = interest > 1e-12 ? ebitda / interest : null;

    yearsOut.push({
      year: y,
      ebitda,
      da,
      ebit,
      interest,
      ebt,
      tax,
      nopat,
      ni,
      reinvestment,
      fcf,
      mandatoryAmort,
      optionalPaydown,
      totalPaydown,
      beginningDebt,
      endingDebt,
      termLoanEnd: termLoan,
      notesEnd: notesBal,
      netDebtEbitda,
      interestCoverage,
    });
  }

  const last = yearsOut[yearsOut.length - 1]!;
  const exitEbitda = last.ebitda;
  const exitEv = exitEbitda * resolved.exitMultiple;
  const netDebt = last.endingDebt;
  // Equity proceeds floored at 0 (no negative exit check written)
  const equityProceeds = exitEv - netDebt;

  const equityIn = sponsorEquity;
  const equityOut = equityProceeds;

  let moic: number | null = null;
  let irr: number | null = null;
  if (equityIn > 0) {
    moic = equityOut / equityIn;
    // Cash flow timeline: -equity at t=0, zeros through year n-1, exit at t=n
    const cfs = new Array<number>(resolved.years + 1).fill(0);
    cfs[0] = -equityIn;
    cfs[resolved.years] = equityOut;
    irr = solveIrr(cfs);
  }

  return {
    inputs: resolved,
    sourcesAndUses: {
      entryEv,
      fees,
      totalUses,
      termLoan: termLoan0,
      notes: notes0,
      totalDebt,
      sponsorEquity,
      totalSources,
    },
    years: yearsOut,
    exit: {
      ebitda: exitEbitda,
      exitEv,
      netDebt,
      equityProceeds,
    },
    returns: {
      moic,
      irr,
      equityIn,
      equityOut,
    },
    notes,
  };
}
