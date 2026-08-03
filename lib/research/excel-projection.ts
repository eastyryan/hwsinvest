// Forward projection: a driver-based three-statement model built on top of the
// historical sheets.
//
// WHAT THIS IS. The user supplies assumptions; the model computes their
// consequences and enforces that the three statements still articulate. The
// starting assumptions are mechanically derived from the company's own history
// (last actual margin, capex intensity, working-capital days, and so on) purely
// so the sheet opens with something coherent in it. They are inputs to be
// replaced, not a forecast of what the company will do, and the workbook says
// so in several places.
//
// FOUR DESIGN DECISIONS worth knowing about:
//
// 1. Interest is charged on the *opening* debt balance. The textbook treatment
//    charges it on the average balance, which makes the model circular:
//    interest -> net income -> cash -> debt -> interest. Excel can resolve that
//    with iterative calculation enabled, but a generated workbook must not
//    require the recipient to change an application setting, and a file that
//    opens with a circular-reference warning is a broken deliverable. Opening
//    balance is a standard simplification and keeps the model acyclic.
//
// 2. Unmodeled captions are held flat as explicit plug lines. This line set
//    models the major captions, not every caption, so the modeled assets rarely
//    sum to reported total assets. "Other assets" absorbs that difference, and
//    "Other liabilities" additionally absorbs whatever is needed for the base
//    year to balance (minority interest, deferred taxes). Both are held
//    constant across the projection. Because the cash flow statement is built
//    from the same drivers as the balance sheet, the projected balance sheet
//    then balances by construction — the check row proves it rather than
//    assuming it.
//
// 3. Operating expenses are driven *including* depreciation, so EBIT is gross
//    profit less operating expenses and therefore reproduces reported operating
//    income at the base year. EBITDA is then EBIT + D&A — the same definition
//    the historical statements and the Model Checks sheet use.
//
//    An earlier version derived the opex ratio the same way but then subtracted
//    D&A a second time to get EBIT, so the row labelled EBITDA was really
//    operating income and the row labelled EBIT was operating income *less*
//    D&A. For a capital-intensive filer that understated EBIT by the whole
//    depreciation charge; the workbook's own historical EBITDA and its
//    projected EBITDA disagreed by exactly D&A. The D&A line is now a memo
//    inside operating expenses: it drives the PP&E roll-forward and the
//    cash-flow add-back, and it does not move EBIT, because the driver above it
//    already fixes total operating cost as a share of revenue.
//
// 4. A revolver funds any cash shortfall. Without one, an aggressive assumption
//    (or a company that is simply burning cash) drove closing cash negative and
//    the balance sheet then presented a negative number as an asset while the
//    balance check still read zero — the model looked fine and was nonsense.
//    The revolver draws whatever is needed to hold cash at the minimum-cash
//    input and sweeps surplus cash back against the balance. Interest accrues
//    on its *opening* balance too, so the model stays acyclic.

import type ExcelJS from "exceljs";
import type { CompanyFinancials, StatementSet } from "./edgar";
import {
  colLetter,
  setFormula,
  setInput,
  sheetHeader,
  sizeColumns,
  sectionRow,
  INPUT_BLUE,
  NAVY,
  TEAL,
  SLATE,
  GREEN,
  RED,
  GREY,
  MUTED,
  MONEY_FMT,
  RESIDUAL_FMT,
  PCT_FMT,
  DAYS_FMT,
} from "./excel-format";

export const PROJECTION_YEARS = 5;

const n = (x: number | null | undefined) => x ?? 0;

/** Last reported value for a line on the annual statements. */
function actual(set: StatementSet, key: string, back = 0): number | null {
  const p = set.periods[back];
  if (!p) return null;
  for (const st of set.statements) {
    const l = st.lines.find((x) => x.key === key);
    if (l) return l.values[p.key] ?? null;
  }
  return null;
}

/** Clamp a derived assumption into a range a human would actually type. */
const clamp = (v: number, lo: number, hi: number, fallback: number) =>
  Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback;

interface Base {
  revenue: number;
  cogs: number;
  grossProfit: number;
  opex: number;
  operatingIncome: number;
  da: number;
  interest: number;
  ppe: number;
  cash: number;
  receivables: number;
  inventory: number;
  goodwill: number;
  intangibles: number;
  totalAssets: number;
  payables: number;
  debt: number;
  equity: number;
  otherAssets: number;
  otherLiabilities: number;
  totalLiabilities: number;
}

export interface Assumptions {
  revenueGrowth: number[];
  grossMargin: number[];
  opexPctRevenue: number[];
  sbcPctRevenue: number[];
  daPctPriorPpe: number[];
  capexPctRevenue: number[];
  interestRate: number[];
  taxRate: number[];
  dso: number[];
  dio: number[];
  dpo: number[];
  netDebtIssuance: number[];
  dividendPayout: number[];
  /** Floor the revolver defends. Stored in whole currency units, like every
   *  other money figure in this module; the sheet writes it in millions. */
  minCash: number[];
}

/**
 * What the company actually did, alongside each driver.
 *
 * Unclamped, so the anchor column also reveals where a derived starting value
 * hit a guard rail. `null` where the history doesn't support the reading.
 */
export type AssumptionActuals = {
  [K in keyof Assumptions]: number | null;
};

export interface Projection {
  labels: string[];
  base: Base;
  assumptions: Assumptions;
  actuals: AssumptionActuals;
  revenue: number[];
  cogs: number[];
  grossProfit: number[];
  opex: number[];
  ebitda: number[];
  ppeOpen: number[];
  da: number[];
  ebit: number[];
  sbc: number[];
  capex: number[];
  ppeClose: number[];
  debtOpen: number[];
  debtClose: number[];
  revolverOpen: number[];
  cashBefore: number[];
  revolverMove: number[];
  revolverClose: number[];
  interest: number[];
  ebt: number[];
  taxes: number[];
  netIncome: number[];
  receivables: number[];
  inventory: number[];
  payables: number[];
  cfo: number[];
  cfi: number[];
  dividends: number[];
  cff: number[];
  netChange: number[];
  cash: number[];
  equity: number[];
  totalAssets: number[];
  totalLiabilities: number[];
  check: number[];
}

function fill(v: number, years: number) {
  return Array.from({ length: years }, () => v);
}

/** A mature long-run growth rate high growers are faded toward. */
const LONG_RUN_GROWTH = 0.03;

/** Linear fade from `start` (first year) to `end` (final year); flat if 1 year. */
function fade(start: number, end: number, years: number) {
  return Array.from({ length: years }, (_, i) =>
    years <= 1 ? start : start + (end - start) * (i / (years - 1))
  );
}

/**
 * Derive starting assumptions from the company's own history.
 *
 * Every one of these is a mechanical read of the last reported year (or a
 * short average), not a judgement about the business. They exist so the sheet
 * opens with internally consistent numbers.
 *
 * A driver whose input is *missing* falls back to the stated default rather
 * than to zero. That distinction is load-bearing: Apple stopped tagging
 * interest expense, and coercing the missing value to zero before clamping into
 * [0, 0.2] produced a 0% interest rate on $99bn of debt — a plausible-looking
 * number that was pure artefact. Same for capex.
 */
function deriveAssumptions(
  set: StatementSet,
  base: Base,
  years: number
): { assumptions: Assumptions; actuals: AssumptionActuals } {
  const rev0 = base.revenue;
  const rev1 = actual(set, "revenue", 1);
  const rev3 = actual(set, "revenue", 3);
  // Trailing 3-year revenue CAGR where available, else the last year-over-year
  // change, else flat. Capped well inside what a person would type by hand.
  let growth = 0.03;
  let growthActual: number | null = null;
  if (rev3 != null && rev3 > 0 && rev0 > 0) {
    growth = Math.pow(rev0 / rev3, 1 / 3) - 1;
    growthActual = growth;
  } else if (rev1 != null && rev1 > 0 && rev0 > 0) {
    growth = rev0 / rev1 - 1;
    growthActual = growth;
  }
  growth = clamp(growth, -0.2, 0.35, 0.03);
  // Fade growth toward a mature long-run rate across the horizon rather than
  // holding the last reading flat for five years. A high grower reverting to
  // ~3% is the defensible default — NVIDIA at 35% forever is not — and the model
  // already accepts a per-year growth vector, so this only moves the starting
  // numbers, not the mechanics. We only ever fade DOWN: a company already at or
  // below the long-run rate is held flat rather than assumed to accelerate.
  const revenueGrowthPath = fade(growth, Math.min(growth, LONG_RUN_GROWTH), years);

  const pretax = actual(set, "pretaxIncome");
  const taxes = actual(set, "taxes");
  const taxActual = pretax != null && taxes != null && pretax > 0 ? taxes / pretax : null;
  const taxRate = taxActual != null ? clamp(taxActual, 0, 0.45, 0.21) : 0.21;

  const ppePrior = actual(set, "ppe", 1);
  const daRaw = actual(set, "da");
  // No reported D&A means no depreciation charge, not a made-up one: inventing
  // a rate here would break the EBIT-to-operating-income tie for no reason.
  const daActual = daRaw != null && ppePrior != null && ppePrior > 0 ? daRaw / ppePrior : null;
  const daRate = daRaw == null ? 0 : daActual != null ? clamp(daActual, 0.02, 0.6, 0.12) : 0.12;

  const capexRaw = actual(set, "capex");
  const capexActual = capexRaw != null && rev0 > 0 ? Math.abs(capexRaw) / rev0 : null;
  const capexPct = capexActual != null ? clamp(capexActual, 0, 0.4, 0.05) : 0.05;

  const interestRaw = actual(set, "interestExpense");
  const rateActual =
    interestRaw != null && base.debt > 0 ? Math.abs(interestRaw) / base.debt : null;
  const rate = rateActual != null ? clamp(rateActual, 0, 0.2, 0.05) : 0.05;

  const dividends0 = Math.abs(n(actual(set, "dividends")));
  const ni0 = actual(set, "netIncome");
  const payoutActual = ni0 != null && ni0 > 0 ? dividends0 / ni0 : null;
  const payout = payoutActual != null ? clamp(payoutActual, 0, 1, 0) : 0;

  const dsoActual = rev0 > 0 ? (base.receivables / rev0) * 365 : null;
  const dioActual = base.cogs > 0 ? (base.inventory / base.cogs) * 365 : null;
  const dpoActual = base.cogs > 0 ? (base.payables / base.cogs) * 365 : null;
  const dso = dsoActual != null ? clamp(dsoActual, 0, 365, 45) : 45;
  const dio = dioActual != null ? clamp(dioActual, 0, 365, 60) : 0;
  const dpo = dpoActual != null ? clamp(dpoActual, 0, 365, 45) : 45;

  const gmActual = rev0 > 0 ? base.grossProfit / rev0 : null;
  const opexActual = rev0 > 0 ? base.opex / rev0 : null;
  const gm = gmActual != null ? clamp(gmActual, 0, 0.98, 0.4) : 0.4;
  const opexPct = opexActual != null ? clamp(opexActual, 0, 0.95, 0.2) : 0.2;

  // Stock-based compensation is already inside operating expenses (it lowers
  // operating income), so it never touches EBIT here. It is carried as its own
  // driver only so the cash-flow add-back and the paid-in-capital credit can be
  // sized — the two entries that a model without it silently omits, understating
  // both operating cash flow and equity by the SBC each year. Defaults to zero:
  // a filer that reports no SBC should show none, not an invented charge.
  const sbcRaw = actual(set, "sbc");
  const sbcActual = sbcRaw != null && rev0 > 0 ? Math.abs(sbcRaw) / rev0 : null;
  const sbcPct = sbcActual != null ? clamp(sbcActual, 0, 0.3, 0) : 0;

  return {
    assumptions: {
      revenueGrowth: revenueGrowthPath,
      grossMargin: fill(gm, years),
      opexPctRevenue: fill(opexPct, years),
      sbcPctRevenue: fill(sbcPct, years),
      daPctPriorPpe: fill(daRate, years),
      capexPctRevenue: fill(capexPct, years),
      interestRate: fill(rate, years),
      taxRate: fill(taxRate, years),
      dso: fill(dso, years),
      dio: fill(dio, years),
      dpo: fill(dpo, years),
      // Defaulting to no new borrowing keeps the opening model neutral: the user
      // decides how the balance sheet is financed.
      netDebtIssuance: fill(0, years),
      dividendPayout: fill(payout, years),
      // Zero by default so the revolver stays dormant for a company that funds
      // itself, and only appears when the assumptions would otherwise drive
      // cash negative. The anchor column shows the actual closing cash balance,
      // which is the number a user would reach for if they want a real floor.
      minCash: fill(0, years),
    },
    actuals: {
      revenueGrowth: growthActual,
      grossMargin: gmActual,
      opexPctRevenue: opexActual,
      sbcPctRevenue: sbcActual,
      daPctPriorPpe: daActual,
      capexPctRevenue: capexActual,
      interestRate: rateActual,
      taxRate: taxActual,
      dso: dsoActual,
      dio: dioActual,
      dpo: dpoActual,
      netDebtIssuance: null,
      dividendPayout: payoutActual,
      minCash: base.cash,
    },
  };
}

/**
 * Project forward, mirroring exactly what the Excel formulas will compute.
 *
 * `overrides` replaces derived drivers before the recursion runs. The workbook
 * itself never passes them — the Assumptions sheet is where a user changes an
 * input — but they are how the model gets exercised at the extremes a user can
 * reach by typing, which is exactly where a three-statement model stops
 * articulating if anything is wired wrong.
 */
export function buildProjection(
  fin: CompanyFinancials,
  years = PROJECTION_YEARS,
  overrides?: Partial<Assumptions>
): Projection | null {
  const set = fin.annual;
  if (set.periods.length === 0) return null;

  const revenue0 = actual(set, "revenue");
  const totalAssets0 = actual(set, "totalAssets");
  const equity0 = actual(set, "equity");
  if (!revenue0 || revenue0 <= 0 || !totalAssets0 || totalAssets0 <= 0 || equity0 == null) {
    // Without a revenue base and a balancing balance sheet there is nothing
    // coherent to project. Banks and trusts frequently land here.
    return null;
  }

  const grossProfitRaw = actual(set, "grossProfit");
  const operatingIncomeRaw = actual(set, "operatingIncome");

  // A gross-profit / operating-income structure is what this model is built on.
  // Banks, insurers and trusts report neither — JPMorgan has no cost of revenue
  // and no gross profit at all — and forcing a margin-driven model onto them
  // produces a sheet that balances but means nothing. Omitting the projection is
  // the honest outcome.
  if (grossProfitRaw == null || grossProfitRaw <= 0 || operatingIncomeRaw == null) {
    return null;
  }

  const grossProfit0 = grossProfitRaw;
  const operatingIncome0 = operatingIncomeRaw;
  const cogs0 = n(actual(set, "cogs")) || revenue0 - grossProfit0;

  // Operating expenses are defined here as gross profit less operating income,
  // which holds regardless of how the filer tags.
  //
  // The reported `opex` line cannot be trusted for this: it resolves to either
  // `OperatingExpenses` or `CostsAndExpenses`, and the latter is *total* costs
  // including cost of revenue. Alphabet tags it that way, so using the line
  // directly subtracted cost of revenue twice — a 59.7% gross margin against a
  // 68% "opex" ratio, projecting a multi-billion loss for a highly profitable
  // company. The identity below gives 27.6%, which is the real figure.
  //
  // This figure is inclusive of depreciation, because operating income is. See
  // design decision 3 at the top of the file.
  const opex0 = Math.max(0, grossProfit0 - operatingIncome0);

  const cash0 = n(actual(set, "cash"));
  const ar0 = n(actual(set, "receivables"));
  const inv0 = n(actual(set, "inventory"));
  const ppe0 = n(actual(set, "ppe"));
  const gw0 = n(actual(set, "goodwill"));
  const intang0 = n(actual(set, "intangibles"));
  const ap0 = n(actual(set, "payables"));
  const debt0 = n(actual(set, "ltDebt")) + n(actual(set, "stDebt"));

  const otherAssets = totalAssets0 - (cash0 + ar0 + inv0 + ppe0 + gw0 + intang0);
  // Absorbs every unmodeled liability *and* whatever is required for the base
  // year to balance, so the projection starts from a balanced sheet.
  const otherLiabilities = totalAssets0 - (ap0 + debt0) - equity0;

  const base: Base = {
    revenue: revenue0,
    cogs: cogs0,
    grossProfit: grossProfit0 || revenue0 - cogs0,
    opex: opex0,
    operatingIncome: operatingIncome0,
    da: n(actual(set, "da")),
    interest: Math.abs(n(actual(set, "interestExpense"))),
    ppe: ppe0,
    cash: cash0,
    receivables: ar0,
    inventory: inv0,
    goodwill: gw0,
    intangibles: intang0,
    totalAssets: totalAssets0,
    payables: ap0,
    debt: debt0,
    equity: equity0,
    otherAssets,
    otherLiabilities,
    totalLiabilities: ap0 + debt0 + otherLiabilities,
  };

  const { assumptions: derived, actuals } = deriveAssumptions(set, base, years);
  const a: Assumptions = { ...derived, ...overrides };

  const lastLabel = set.periods[0].label;
  const yearMatch = /(\d{4})/.exec(lastLabel);
  const startYear = yearMatch ? Number(yearMatch[1]) : null;
  const labels = Array.from({ length: years }, (_, i) =>
    startYear ? `FY${startYear + i + 1}E` : `Year ${i + 1}E`
  );

  const p: Projection = {
    labels,
    base,
    assumptions: a,
    actuals,
    revenue: [], cogs: [], grossProfit: [], opex: [], ebitda: [],
    ppeOpen: [], da: [], ebit: [], sbc: [], capex: [], ppeClose: [],
    debtOpen: [], debtClose: [],
    revolverOpen: [], cashBefore: [], revolverMove: [], revolverClose: [],
    interest: [], ebt: [], taxes: [], netIncome: [],
    receivables: [], inventory: [], payables: [],
    cfo: [], cfi: [], dividends: [], cff: [], netChange: [],
    cash: [], equity: [], totalAssets: [], totalLiabilities: [], check: [],
  };

  for (let t = 0; t < years; t++) {
    const prevRevenue = t === 0 ? base.revenue : p.revenue[t - 1];
    const revenue = prevRevenue * (1 + a.revenueGrowth[t]);
    const grossProfit = revenue * a.grossMargin[t];
    const cogs = revenue - grossProfit;
    const opex = revenue * a.opexPctRevenue[t];

    const ppeOpen = t === 0 ? base.ppe : p.ppeClose[t - 1];
    const da = ppeOpen * a.daPctPriorPpe[t];
    const capex = revenue * a.capexPctRevenue[t];
    const ppeClose = ppeOpen + capex - da;

    // Stock-based compensation: a non-cash charge already inside opex. It is
    // added back to operating cash flow and credited to paid-in capital, so both
    // cash and equity rise by it and the balance sheet still ties. See the note
    // in fillProjectionsSheet.
    const sbc = revenue * a.sbcPctRevenue[t];

    // EBIT reproduces reported operating income; EBITDA adds depreciation back.
    const ebit = grossProfit - opex;
    const ebitda = ebit + da;

    const debtOpen = t === 0 ? base.debt : p.debtClose[t - 1];
    const debtClose = debtOpen + a.netDebtIssuance[t];
    const revolverOpen = t === 0 ? 0 : p.revolverClose[t - 1];
    // Opening balances, deliberately: see the note at the top of this file.
    const interest = (debtOpen + revolverOpen) * a.interestRate[t];

    const ebt = ebit - interest;
    const taxes = ebt > 0 ? ebt * a.taxRate[t] : 0;
    const netIncome = ebt - taxes;

    const receivables = (a.dso[t] / 365) * revenue;
    const inventory = (a.dio[t] / 365) * cogs;
    const payables = (a.dpo[t] / 365) * cogs;

    const arOpen = t === 0 ? base.receivables : p.receivables[t - 1];
    const invOpen = t === 0 ? base.inventory : p.inventory[t - 1];
    const apOpen = t === 0 ? base.payables : p.payables[t - 1];

    const cfo =
      netIncome + da + sbc - (receivables - arOpen) - (inventory - invOpen) + (payables - apOpen);
    const cfi = -capex;
    const dividends = netIncome > 0 ? netIncome * a.dividendPayout[t] : 0;

    // The revolver closes the gap between what the business generates and the
    // minimum cash the user wants held. Draw and repayment are mutually
    // exclusive, so a single expression covers both.
    const cashOpen = t === 0 ? base.cash : p.cash[t - 1];
    const cashBefore = cashOpen + cfo + cfi + a.netDebtIssuance[t] - dividends;
    const minCash = a.minCash[t];
    const revolverMove =
      Math.max(0, minCash - cashBefore) -
      Math.min(revolverOpen, Math.max(0, cashBefore - minCash));
    const revolverClose = revolverOpen + revolverMove;

    const cff = a.netDebtIssuance[t] - dividends + revolverMove;
    const netChange = cfo + cfi + cff;

    const cash = cashOpen + netChange;
    const equity = (t === 0 ? base.equity : p.equity[t - 1]) + netIncome + sbc - dividends;

    const totalAssets =
      cash + receivables + inventory + ppeClose + base.goodwill + base.intangibles + base.otherAssets;
    const totalLiabilities = payables + debtClose + revolverClose + base.otherLiabilities;

    p.revenue.push(revenue); p.cogs.push(cogs); p.grossProfit.push(grossProfit);
    p.opex.push(opex); p.ebitda.push(ebitda);
    p.ppeOpen.push(ppeOpen); p.da.push(da); p.ebit.push(ebit); p.sbc.push(sbc);
    p.capex.push(capex); p.ppeClose.push(ppeClose);
    p.debtOpen.push(debtOpen); p.debtClose.push(debtClose);
    p.revolverOpen.push(revolverOpen); p.cashBefore.push(cashBefore);
    p.revolverMove.push(revolverMove); p.revolverClose.push(revolverClose);
    p.interest.push(interest);
    p.ebt.push(ebt); p.taxes.push(taxes); p.netIncome.push(netIncome);
    p.receivables.push(receivables); p.inventory.push(inventory); p.payables.push(payables);
    p.cfo.push(cfo); p.cfi.push(cfi); p.dividends.push(dividends);
    p.cff.push(cff); p.netChange.push(netChange);
    p.cash.push(cash); p.equity.push(equity);
    p.totalAssets.push(totalAssets); p.totalLiabilities.push(totalLiabilities);
    p.check.push(totalAssets - totalLiabilities - equity);
  }

  return p;
}

// --- sheet writers ----------------------------------------------------------

const ASSUMPTIONS_SHEET = "Assumptions";
const SCHEDULES_SHEET = "Schedules";
const PROJECTIONS_SHEET = "Projections";
const M = 1e6;

/** Assumption row positions, so the schedules and projections can point at them. */
const A_ROW = {
  revenueGrowth: 6,
  grossMargin: 7,
  opexPctRevenue: 8,
  taxRate: 9,
  sbcPctRevenue: 10,
  daPctPriorPpe: 12,
  capexPctRevenue: 13,
  dso: 16,
  dio: 17,
  dpo: 18,
  interestRate: 21,
  netDebtIssuance: 22,
  dividendPayout: 23,
  minCash: 24,
} as const;

/** Schedule row positions. */
const S_ROW = {
  ppeOpen: 6, capex: 7, da: 8, ppeClose: 9,
  debtOpen: 12, issuance: 13, debtClose: 14,
  revolverOpen: 15, cashBefore: 16, revolverMove: 17, revolverClose: 18,
  interest: 19,
  wcRevenue: 22, wcCogs: 23, receivables: 24, inventory: 25, payables: 26,
} as const;

/** Projection sheet row positions. */
const P_ROW = {
  revenue: 6, cogs: 7, grossProfit: 8, opex: 9,
  ebitda: 10, da: 11, ebit: 12,
  interest: 13, ebt: 14, taxes: 15, netIncome: 16,
  cfNi: 19, cfDa: 20, cfSbc: 21, cfAr: 22, cfInv: 23, cfAp: 24, cfo: 25,
  cfCapex: 26, cfi: 27, cfDebt: 28, cfDiv: 29, cfRevolver: 30, cff: 31,
  netChange: 32, cashOpen: 33, cashClose: 34,
  bsCash: 37, bsAr: 38, bsInv: 39, bsPpe: 40, bsGw: 41, bsIntang: 42,
  bsOther: 43, bsTotalAssets: 44,
  bsAp: 46, bsDebt: 47, bsRevolver: 48, bsOtherL: 49, bsTotalLiab: 50,
  bsEquityOpen: 52, bsNi: 53, bsSbc: 54, bsDiv: 55, bsEquityClose: 56,
  bsCheck: 58,
} as const;

// Every cross-sheet reference is quoted, whether or not the current sheet names
// require it. An unquoted reference is only valid while the name stays free of
// spaces and punctuation, and that is not a property worth relying on.
const aRef = (row: number, t: number) => `'${ASSUMPTIONS_SHEET}'!${colLetter(t + 3)}${row}`;
const sRef = (row: number, t: number) => `'${SCHEDULES_SHEET}'!${colLetter(t + 3)}${row}`;
const pRef = (row: number, t: number) => `'${PROJECTIONS_SHEET}'!${colLetter(t + 3)}${row}`;
const sAnchor = (row: number) => `'${SCHEDULES_SHEET}'!B${row}`;

export function fillAssumptionsSheet(
  ws: ExcelJS.Worksheet,
  fin: CompanyFinancials,
  p: Projection
) {
  const cols = [fin.annual.periods[0].label + " (A)", ...p.labels];
  sheetHeader(
    ws,
    "Assumptions",
    "Every blue cell is an input. Change one and the schedules, projections and checks all follow.",
    "Column B is what the company actually did, unclamped. The blue columns start from it — they are a place to begin, not a forecast. Replace them with your own view.",
    cols,
    TEAL,
    "Driver"
  );

  const a = p.assumptions;
  const put = (
    row: number,
    label: string,
    values: number[],
    fmt: string,
    actualValue: number | null
  ) => {
    const r = ws.getRow(row);
    r.getCell(1).value = label;
    r.getCell(1).font = { size: 10 };
    if (actualValue != null && Number.isFinite(actualValue)) {
      const c = r.getCell(2);
      c.value = actualValue;
      c.numFmt = fmt;
      c.font = { size: 10, color: { argb: MUTED }, italic: true };
    }
    values.forEach((v, t) => setInput(r.getCell(t + 3), v, fmt));
  };
  const act = p.actuals;

  sectionRow(ws, 5, "Income statement", cols.length, TEAL);
  put(A_ROW.revenueGrowth, "Revenue growth %", a.revenueGrowth, PCT_FMT, act.revenueGrowth);
  put(A_ROW.grossMargin, "Gross margin %", a.grossMargin, PCT_FMT, act.grossMargin);
  put(A_ROW.opexPctRevenue, "Operating expenses % of revenue (incl. D&A)",
      a.opexPctRevenue, PCT_FMT, act.opexPctRevenue);
  put(A_ROW.taxRate, "Effective tax rate %", a.taxRate, PCT_FMT, act.taxRate);
  put(A_ROW.sbcPctRevenue, "Stock-based comp % of revenue", a.sbcPctRevenue, PCT_FMT,
      act.sbcPctRevenue);

  sectionRow(ws, 11, "Fixed assets", cols.length, TEAL);
  put(A_ROW.daPctPriorPpe, "D&A % of opening PP&E", a.daPctPriorPpe, PCT_FMT, act.daPctPriorPpe);
  put(A_ROW.capexPctRevenue, "Capex % of revenue", a.capexPctRevenue, PCT_FMT, act.capexPctRevenue);

  sectionRow(ws, 15, "Working capital", cols.length, TEAL);
  put(A_ROW.dso, "Days sales outstanding", a.dso, DAYS_FMT, act.dso);
  put(A_ROW.dio, "Days inventory outstanding", a.dio, DAYS_FMT, act.dio);
  put(A_ROW.dpo, "Days payable outstanding", a.dpo, DAYS_FMT, act.dpo);

  sectionRow(ws, 20, "Financing & liquidity", cols.length, TEAL);
  put(A_ROW.interestRate, "Interest rate on debt %", a.interestRate, PCT_FMT, act.interestRate);
  put(A_ROW.netDebtIssuance, `Net term debt issued (${fin.currency} m)`,
      a.netDebtIssuance.map((v) => v / M), MONEY_FMT, null);
  put(A_ROW.dividendPayout, "Dividend payout % of net income", a.dividendPayout, PCT_FMT,
      act.dividendPayout);
  put(A_ROW.minCash, `Minimum cash balance (${fin.currency} m)`,
      a.minCash.map((v) => v / M), MONEY_FMT,
      act.minCash == null ? null : act.minCash / M);

  const notes = [
    "",
    "EBIT is gross profit less operating expenses, so it reproduces reported operating income in the",
    "base year. Operating expenses are inclusive of depreciation; the D&A line is a memo that drives the",
    "PP&E roll-forward and the cash flow add-back. Raising it therefore shifts cost between cash and",
    "non-cash rather than reducing EBIT — the driver above already fixes total operating cost.",
    "",
    "Interest is charged on the opening debt balance, not the average. Charging it on the average",
    "makes the model circular (interest → net income → cash → debt → interest), which Excel can only",
    "resolve with iterative calculation switched on. Opening balance keeps the workbook self-contained.",
    "",
    "If the assumptions would drive cash below the minimum above, a revolver draws the difference and",
    "carries the same interest rate. Surplus cash above the minimum repays it. Without that, closing",
    "cash simply went negative and sat on the balance sheet as an asset.",
    "",
    "Taxes are only charged on positive pre-tax income; loss years carry no benefit and no loss is",
    "carried forward. Dividends are only paid out of positive net income, and a payout above 100% is",
    "accepted as typed — it will drain equity.",
    "",
    "This is a modelling tool, not a forecast and not investment advice.",
  ];
  notes.forEach((t, i) => {
    const c = ws.getCell(26 + i, 1);
    c.value = t;
    c.font = { size: 9, italic: true, color: { argb: GREY } };
  });

  sizeColumns(ws, cols.length, 44);
}

export function fillSchedulesSheet(
  ws: ExcelJS.Worksheet,
  fin: CompanyFinancials,
  p: Projection
) {
  const cols = [fin.annual.periods[0].label + " (A)", ...p.labels];
  sheetHeader(
    ws,
    "Supporting schedules",
    "Fixed assets, debt, the revolver and working capital.",
    `${fin.currency} in millions. Column B is the last actual closing balance; every projected cell is a formula driven by the Assumptions sheet.`,
    cols,
    SLATE,
    "Schedule"
  );

  const label = (row: number, text: string, bold = false) => {
    const c = ws.getRow(row).getCell(1);
    c.value = text;
    c.font = { size: 10, bold };
  };
  /**
   * The last actual closing balance, written against the *closing* row.
   *
   * It used to sit on the opening row, which read as "FY2025 opening PP&E" in a
   * column headed FY2025 (A) while actually holding FY2025's closing figure.
   * Anchoring the closing row instead lets every opening row be the same
   * formula — the cell to its left — and says what it means.
   */
  const anchor = (row: number, value: number) => {
    const c = ws.getRow(row).getCell(2);
    c.value = value / M;
    c.numFmt = MONEY_FMT;
    c.font = { size: 10, color: { argb: MUTED }, italic: true };
  };
  const formulaRow = (
    row: number,
    exprs: (t: number) => string,
    vals: number[],
    opts: { bold?: boolean; warnPositive?: boolean } = {}
  ) => {
    vals.forEach((v, t) => {
      const cell = ws.getRow(row).getCell(t + 3);
      setFormula(cell, exprs(t), v / M, MONEY_FMT);
      cell.font = {
        size: 10,
        bold: opts.bold,
        color: opts.warnPositive && v > 0.5 * M ? { argb: RED } : undefined,
      };
    });
  };
  const C = (t: number) => colLetter(t + 3);
  const prevCol = (t: number) => colLetter(t + 2);

  // Fixed assets
  sectionRow(ws, 5, "Fixed assets", cols.length, SLATE);
  label(S_ROW.ppeOpen, "Opening PP&E");
  formulaRow(S_ROW.ppeOpen, (t) => `${prevCol(t)}${S_ROW.ppeClose}`, p.ppeOpen);
  label(S_ROW.capex, "Capital expenditure");
  formulaRow(S_ROW.capex, (t) => `${pRef(P_ROW.revenue, t)}*${aRef(A_ROW.capexPctRevenue, t)}`, p.capex);
  label(S_ROW.da, "Depreciation & amortisation");
  formulaRow(S_ROW.da, (t) => `${C(t)}${S_ROW.ppeOpen}*${aRef(A_ROW.daPctPriorPpe, t)}`, p.da);
  label(S_ROW.ppeClose, "Closing PP&E", true);
  anchor(S_ROW.ppeClose, p.base.ppe);
  formulaRow(
    S_ROW.ppeClose,
    (t) => `${C(t)}${S_ROW.ppeOpen}+${C(t)}${S_ROW.capex}-${C(t)}${S_ROW.da}`,
    p.ppeClose,
    { bold: true }
  );

  // Debt and the revolver
  sectionRow(ws, 11, "Debt & liquidity", cols.length, SLATE);
  label(S_ROW.debtOpen, "Opening term debt");
  formulaRow(S_ROW.debtOpen, (t) => `${prevCol(t)}${S_ROW.debtClose}`, p.debtOpen);
  label(S_ROW.issuance, "Net term debt issued / (repaid)");
  formulaRow(S_ROW.issuance, (t) => aRef(A_ROW.netDebtIssuance, t), p.assumptions.netDebtIssuance);
  label(S_ROW.debtClose, "Closing term debt", true);
  anchor(S_ROW.debtClose, p.base.debt);
  formulaRow(
    S_ROW.debtClose,
    (t) => `${C(t)}${S_ROW.debtOpen}+${C(t)}${S_ROW.issuance}`,
    p.debtClose,
    { bold: true }
  );

  label(S_ROW.revolverOpen, "Opening revolver");
  formulaRow(S_ROW.revolverOpen, (t) => `${prevCol(t)}${S_ROW.revolverClose}`, p.revolverOpen);
  label(S_ROW.cashBefore, "    Cash before revolver");
  formulaRow(
    S_ROW.cashBefore,
    (t) =>
      `${pRef(P_ROW.cashOpen, t)}+${pRef(P_ROW.cfo, t)}+${pRef(P_ROW.cfi, t)}` +
      `+${pRef(P_ROW.cfDebt, t)}+${pRef(P_ROW.cfDiv, t)}`,
    p.cashBefore
  );
  label(S_ROW.revolverMove, "    Draw / (repayment)");
  formulaRow(
    S_ROW.revolverMove,
    (t) =>
      `MAX(0,${aRef(A_ROW.minCash, t)}-${C(t)}${S_ROW.cashBefore})` +
      `-MIN(${C(t)}${S_ROW.revolverOpen},MAX(0,${C(t)}${S_ROW.cashBefore}-${aRef(A_ROW.minCash, t)}))`,
    p.revolverMove
  );
  label(S_ROW.revolverClose, "Closing revolver", true);
  // No revolver exists in the base year by construction: the historical balance
  // sheet's borrowings are already in term debt.
  anchor(S_ROW.revolverClose, 0);
  formulaRow(
    S_ROW.revolverClose,
    (t) => `${C(t)}${S_ROW.revolverOpen}+${C(t)}${S_ROW.revolverMove}`,
    p.revolverClose,
    { bold: true, warnPositive: true }
  );
  label(S_ROW.interest, "Interest expense (on opening balances)");
  formulaRow(
    S_ROW.interest,
    (t) => `(${C(t)}${S_ROW.debtOpen}+${C(t)}${S_ROW.revolverOpen})*${aRef(A_ROW.interestRate, t)}`,
    p.interest
  );

  // Working capital
  sectionRow(ws, 21, "Working capital", cols.length, SLATE);
  label(S_ROW.wcRevenue, "Revenue (from projections)");
  anchor(S_ROW.wcRevenue, p.base.revenue);
  formulaRow(S_ROW.wcRevenue, (t) => pRef(P_ROW.revenue, t), p.revenue);
  label(S_ROW.wcCogs, "Cost of revenue (from projections)");
  anchor(S_ROW.wcCogs, p.base.cogs);
  formulaRow(S_ROW.wcCogs, (t) => pRef(P_ROW.cogs, t), p.cogs);
  label(S_ROW.receivables, "Accounts receivable");
  anchor(S_ROW.receivables, p.base.receivables);
  formulaRow(S_ROW.receivables, (t) => `${aRef(A_ROW.dso, t)}/365*${C(t)}${S_ROW.wcRevenue}`, p.receivables);
  label(S_ROW.inventory, "Inventory");
  anchor(S_ROW.inventory, p.base.inventory);
  formulaRow(S_ROW.inventory, (t) => `${aRef(A_ROW.dio, t)}/365*${C(t)}${S_ROW.wcCogs}`, p.inventory);
  label(S_ROW.payables, "Accounts payable");
  anchor(S_ROW.payables, p.base.payables);
  formulaRow(S_ROW.payables, (t) => `${aRef(A_ROW.dpo, t)}/365*${C(t)}${S_ROW.wcCogs}`, p.payables);

  sizeColumns(ws, cols.length, 44);
}

export function fillProjectionsSheet(
  ws: ExcelJS.Worksheet,
  fin: CompanyFinancials,
  p: Projection
) {
  const cols = [fin.annual.periods[0].label + " (A)", ...p.labels];
  sheetHeader(
    ws,
    "Projections",
    "Three projected statements, driven entirely by the Assumptions sheet.",
    `${fin.currency} in millions. Column B is the last actual year. The balance check at the bottom must read zero in every column.`,
    cols,
    NAVY,
    "Line item"
  );

  const C = (t: number) => colLetter(t + 3);
  const prevCol = (t: number) => colLetter(t + 2);

  const label = (row: number, text: string, bold = false, indent = false) => {
    const c = ws.getRow(row).getCell(1);
    c.value = (indent ? "    " : "") + text;
    c.font = { size: 10, bold };
  };
  const anchor = (row: number, value: number | null) => {
    if (value == null || !Number.isFinite(value)) return;
    const c = ws.getRow(row).getCell(2);
    c.value = value / M;
    c.numFmt = MONEY_FMT;
    c.font = { size: 10, color: { argb: MUTED }, italic: true };
  };
  const row = (
    r: number,
    text: string,
    expr: (t: number) => string,
    vals: number[],
    opts: {
      bold?: boolean;
      indent?: boolean;
      anchorValue?: number | null;
      warnNegative?: boolean;
      warnPositive?: boolean;
      /** Row a driver pins to a target, so dust should read as zero. */
      pinned?: boolean;
    } = {}
  ) => {
    label(r, text, opts.bold, opts.indent);
    if (opts.anchorValue !== undefined) anchor(r, opts.anchorValue);
    vals.forEach((v, t) => {
      const cell = ws.getRow(r).getCell(t + 3);
      setFormula(cell, expr(t), v / M, opts.pinned ? RESIDUAL_FMT : MONEY_FMT);
      const warn =
        (opts.warnNegative && v < -0.5 * M) || (opts.warnPositive && v > 0.5 * M);
      cell.font = { size: 10, bold: opts.bold, color: warn ? { argb: RED } : undefined };
    });
  };

  // --- income statement
  sectionRow(ws, 5, "Income statement", cols.length, NAVY);
  row(P_ROW.revenue, "Revenue",
      (t) => `${prevCol(t)}${P_ROW.revenue}*(1+${aRef(A_ROW.revenueGrowth, t)})`,
      p.revenue, { bold: true, anchorValue: p.base.revenue });
  row(P_ROW.grossProfit, "Gross profit",
      (t) => `${C(t)}${P_ROW.revenue}*${aRef(A_ROW.grossMargin, t)}`,
      p.grossProfit, { bold: true, anchorValue: p.base.grossProfit });
  row(P_ROW.cogs, "Cost of revenue",
      (t) => `${C(t)}${P_ROW.revenue}-${C(t)}${P_ROW.grossProfit}`,
      p.cogs, { anchorValue: p.base.cogs });
  row(P_ROW.opex, "Operating expenses (incl. D&A)",
      (t) => `${C(t)}${P_ROW.revenue}*${aRef(A_ROW.opexPctRevenue, t)}`,
      p.opex, { anchorValue: p.base.opex });
  // EBITDA is EBIT plus depreciation, matching the historical statements and the
  // Model Checks sheet. It reads above D&A because that is the conventional
  // order, not because it is computed first.
  row(P_ROW.ebitda, "EBITDA",
      (t) => `${C(t)}${P_ROW.ebit}+${C(t)}${P_ROW.da}`,
      p.ebitda, { bold: true, anchorValue: p.base.operatingIncome + p.base.da });
  row(P_ROW.da, "Depreciation & amortisation (in opex)",
      (t) => sRef(S_ROW.da, t), p.da, { indent: true, anchorValue: p.base.da });
  row(P_ROW.ebit, "EBIT / operating income",
      (t) => `${C(t)}${P_ROW.grossProfit}-${C(t)}${P_ROW.opex}`, p.ebit,
      { bold: true, anchorValue: p.base.operatingIncome });
  row(P_ROW.interest, "Interest expense",
      (t) => sRef(S_ROW.interest, t), p.interest,
      { indent: true, anchorValue: p.base.interest || null });
  row(P_ROW.ebt, "Pre-tax income",
      (t) => `${C(t)}${P_ROW.ebit}-${C(t)}${P_ROW.interest}`, p.ebt, { bold: true });
  row(P_ROW.taxes, "Income taxes",
      (t) => `IF(${C(t)}${P_ROW.ebt}>0,${C(t)}${P_ROW.ebt}*${aRef(A_ROW.taxRate, t)},0)`,
      p.taxes, { indent: true });
  row(P_ROW.netIncome, "Net income",
      (t) => `${C(t)}${P_ROW.ebt}-${C(t)}${P_ROW.taxes}`, p.netIncome, { bold: true });

  // --- cash flow
  sectionRow(ws, 18, "Cash flow", cols.length, NAVY);
  row(P_ROW.cfNi, "Net income", (t) => `${C(t)}${P_ROW.netIncome}`, p.netIncome);
  row(P_ROW.cfDa, "Add: D&A", (t) => `${C(t)}${P_ROW.da}`, p.da, { indent: true });
  // A non-cash charge already inside operating income, added back here. Sized off
  // revenue rather than held flat so it scales with the business. The mirror
  // entry is the paid-in-capital credit in the equity roll-forward below; both
  // rise by the same amount, so the balance sheet still ties.
  row(P_ROW.cfSbc, "Add: stock-based compensation",
      (t) => `${C(t)}${P_ROW.revenue}*${aRef(A_ROW.sbcPctRevenue, t)}`, p.sbc, { indent: true });
  row(P_ROW.cfAr, "Change in receivables",
      (t) => `-(${sRef(S_ROW.receivables, t)}-${t === 0 ? sAnchor(S_ROW.receivables) : sRef(S_ROW.receivables, t - 1)})`,
      p.receivables.map((v, t) => -(v - (t === 0 ? p.base.receivables : p.receivables[t - 1]))),
      { indent: true });
  row(P_ROW.cfInv, "Change in inventory",
      (t) => `-(${sRef(S_ROW.inventory, t)}-${t === 0 ? sAnchor(S_ROW.inventory) : sRef(S_ROW.inventory, t - 1)})`,
      p.inventory.map((v, t) => -(v - (t === 0 ? p.base.inventory : p.inventory[t - 1]))),
      { indent: true });
  row(P_ROW.cfAp, "Change in payables",
      (t) => `${sRef(S_ROW.payables, t)}-${t === 0 ? sAnchor(S_ROW.payables) : sRef(S_ROW.payables, t - 1)}`,
      p.payables.map((v, t) => v - (t === 0 ? p.base.payables : p.payables[t - 1])),
      { indent: true });
  row(P_ROW.cfo, "Operating cash flow",
      (t) => `SUM(${C(t)}${P_ROW.cfNi}:${C(t)}${P_ROW.cfAp})`, p.cfo, { bold: true });
  row(P_ROW.cfCapex, "Capital expenditure",
      (t) => `-${sRef(S_ROW.capex, t)}`, p.capex.map((v) => -v), { indent: true });
  row(P_ROW.cfi, "Investing cash flow",
      (t) => `${C(t)}${P_ROW.cfCapex}`, p.cfi, { bold: true });
  row(P_ROW.cfDebt, "Net term debt issued",
      (t) => sRef(S_ROW.issuance, t), p.assumptions.netDebtIssuance, { indent: true });
  row(P_ROW.cfDiv, "Dividends paid",
      (t) => `-IF(${C(t)}${P_ROW.netIncome}>0,${C(t)}${P_ROW.netIncome}*${aRef(A_ROW.dividendPayout, t)},0)`,
      p.dividends.map((v) => -v), { indent: true });
  row(P_ROW.cfRevolver, "Revolver draw / (repayment)",
      (t) => sRef(S_ROW.revolverMove, t), p.revolverMove,
      { indent: true, warnPositive: true });
  row(P_ROW.cff, "Financing cash flow",
      (t) => `${C(t)}${P_ROW.cfDebt}+${C(t)}${P_ROW.cfDiv}+${C(t)}${P_ROW.cfRevolver}`,
      p.cff, { bold: true });
  row(P_ROW.netChange, "Net change in cash",
      (t) => `${C(t)}${P_ROW.cfo}+${C(t)}${P_ROW.cfi}+${C(t)}${P_ROW.cff}`,
      p.netChange, { bold: true });
  // Opening cash is always the cell to its left, which in the first projected
  // year is the last actual closing balance. No special case, and column B says
  // what it means.
  row(P_ROW.cashOpen, "Opening cash",
      (t) => `${prevCol(t)}${P_ROW.cashClose}`,
      p.cash.map((_, t) => (t === 0 ? p.base.cash : p.cash[t - 1])));
  row(P_ROW.cashClose, "Closing cash",
      (t) => `${C(t)}${P_ROW.cashOpen}+${C(t)}${P_ROW.netChange}`, p.cash,
      { bold: true, anchorValue: p.base.cash, warnNegative: true, pinned: true });

  // --- balance sheet
  sectionRow(ws, 36, "Balance sheet", cols.length, NAVY);
  row(P_ROW.bsCash, "Cash & equivalents", (t) => `${C(t)}${P_ROW.cashClose}`, p.cash,
      { anchorValue: p.base.cash, warnNegative: true, pinned: true });
  row(P_ROW.bsAr, "Accounts receivable", (t) => sRef(S_ROW.receivables, t), p.receivables,
      { anchorValue: p.base.receivables });
  row(P_ROW.bsInv, "Inventory", (t) => sRef(S_ROW.inventory, t), p.inventory,
      { anchorValue: p.base.inventory });
  row(P_ROW.bsPpe, "Property, plant & equipment", (t) => sRef(S_ROW.ppeClose, t), p.ppeClose,
      { anchorValue: p.base.ppe });
  row(P_ROW.bsGw, "Goodwill", () => `$B$${P_ROW.bsGw}`, p.labels.map(() => p.base.goodwill),
      { anchorValue: p.base.goodwill });
  row(P_ROW.bsIntang, "Intangible assets", () => `$B$${P_ROW.bsIntang}`,
      p.labels.map(() => p.base.intangibles), { anchorValue: p.base.intangibles });
  row(P_ROW.bsOther, "Other assets (held flat)", () => `$B$${P_ROW.bsOther}`,
      p.labels.map(() => p.base.otherAssets), { anchorValue: p.base.otherAssets });
  row(P_ROW.bsTotalAssets, "Total assets",
      (t) => `SUM(${C(t)}${P_ROW.bsCash}:${C(t)}${P_ROW.bsOther})`, p.totalAssets,
      { bold: true, anchorValue: p.base.totalAssets });

  row(P_ROW.bsAp, "Accounts payable", (t) => sRef(S_ROW.payables, t), p.payables,
      { anchorValue: p.base.payables });
  row(P_ROW.bsDebt, "Term debt", (t) => sRef(S_ROW.debtClose, t), p.debtClose,
      { anchorValue: p.base.debt });
  row(P_ROW.bsRevolver, "Revolver", (t) => sRef(S_ROW.revolverClose, t), p.revolverClose,
      { anchorValue: 0, warnPositive: true });
  row(P_ROW.bsOtherL, "Other liabilities (held flat)", () => `$B$${P_ROW.bsOtherL}`,
      p.labels.map(() => p.base.otherLiabilities), { anchorValue: p.base.otherLiabilities });
  row(P_ROW.bsTotalLiab, "Total liabilities",
      (t) => `SUM(${C(t)}${P_ROW.bsAp}:${C(t)}${P_ROW.bsOtherL})`, p.totalLiabilities,
      { bold: true, anchorValue: p.base.totalLiabilities });

  row(P_ROW.bsEquityOpen, "Opening equity",
      (t) => `${prevCol(t)}${P_ROW.bsEquityClose}`,
      p.equity.map((_, t) => (t === 0 ? p.base.equity : p.equity[t - 1])));
  row(P_ROW.bsNi, "Add: net income", (t) => `${C(t)}${P_ROW.netIncome}`, p.netIncome,
      { indent: true });
  // The paid-in-capital side of stock-based comp: it credits equity by the same
  // amount the cash-flow statement adds back, which is what keeps the sheet tied.
  row(P_ROW.bsSbc, "Add: stock-based compensation", (t) => `${C(t)}${P_ROW.cfSbc}`, p.sbc,
      { indent: true });
  row(P_ROW.bsDiv, "Less: dividends", (t) => `${C(t)}${P_ROW.cfDiv}`, p.dividends.map((v) => -v),
      { indent: true });
  row(P_ROW.bsEquityClose, "Closing equity",
      (t) => `${C(t)}${P_ROW.bsEquityOpen}+${C(t)}${P_ROW.bsNi}+${C(t)}${P_ROW.bsSbc}+${C(t)}${P_ROW.bsDiv}`,
      p.equity, { bold: true, anchorValue: p.base.equity, warnNegative: true });

  // --- the check
  label(P_ROW.bsCheck, "Balance check (must be zero)", true);
  // The base year ties too — that is what the two plug lines are for — so the
  // anchor column carries its own residual rather than leaving the reader to
  // take the construction on trust.
  const baseCheck =
    p.base.cash + p.base.receivables + p.base.inventory + p.base.ppe + p.base.goodwill +
    p.base.intangibles + p.base.otherAssets - p.base.totalLiabilities - p.base.equity;
  const checkCell = ws.getRow(P_ROW.bsCheck).getCell(2);
  checkCell.value = baseCheck / M;
  checkCell.numFmt = RESIDUAL_FMT;
  checkCell.font = {
    size: 10,
    italic: true,
    color: { argb: Math.abs(baseCheck / M) < 0.5 ? GREEN : RED },
  };
  p.check.forEach((v, t) => {
    const cell = ws.getRow(P_ROW.bsCheck).getCell(t + 3);
    setFormula(
      cell,
      `${C(t)}${P_ROW.bsTotalAssets}-${C(t)}${P_ROW.bsTotalLiab}-${C(t)}${P_ROW.bsEquityClose}`,
      v / M,
      RESIDUAL_FMT
    );
    cell.font = {
      size: 10,
      bold: true,
      color: { argb: Math.abs(v / M) < 0.5 ? GREEN : RED },
    };
  });
  // Make the check live. Edit an assumption until the sheet stops balancing and
  // the residual turns red on its own, instead of keeping the green it was baked
  // with; the baked colour above is the fallback for viewers that ignore
  // conditional formats. The formula is relative to the range's first cell, so
  // each column tests its own residual.
  ws.addConditionalFormatting({
    ref: `B${P_ROW.bsCheck}:${colLetter(cols.length + 1)}${P_ROW.bsCheck}`,
    rules: [
      {
        type: "expression",
        priority: 1,
        formulae: [`ABS(B${P_ROW.bsCheck})>=0.5`],
        style: {
          font: { bold: true, color: { argb: "FFFFFFFF" } },
          fill: { type: "pattern", pattern: "solid", bgColor: { argb: RED } },
        },
      },
      {
        type: "expression",
        priority: 2,
        formulae: [`ABS(B${P_ROW.bsCheck})<0.5`],
        style: { font: { color: { argb: GREEN } } },
      },
    ],
  });

  const notes = [
    "Goodwill, intangibles and the two plug lines are held at their last actual value. Because the cash flow",
    "statement is built from the same drivers as the balance sheet, the sheet balances by construction.",
    "A revolver balance in red means the assumptions do not fund the business: that is a financing gap to",
    "close, not a rounding issue. Red equity or red cash means the same thing further along.",
    "Output reflects the assumptions you enter. It is not a forecast, a valuation, or investment advice.",
  ];
  notes.forEach((text, i) => {
    const c = ws.getCell(P_ROW.bsCheck + 2 + i, 1);
    c.value = text;
    c.font = {
      italic: true,
      size: 9,
      color: { argb: i === notes.length - 1 ? INPUT_BLUE : GREY },
    };
  });

  sizeColumns(ws, cols.length, 44);
}
