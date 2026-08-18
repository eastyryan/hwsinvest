// Discounted-cash-flow valuation, built on top of the forward projection.
//
// WHAT THIS IS. A transparent, assumption-driven DCF: unlevered free cash flow
// taken from the projection, discounted at a WACC the sheet builds up from its
// own inputs, with a terminal value by both the Gordon-growth and exit-multiple
// methods and a two-way sensitivity grid. Every number is a formula a reader can
// follow to its source; nothing is a black box, and the whole thing recomputes
// when the Assumptions sheet changes because the free-cash-flow lines reference
// the projection rather than copying it.
//
// It is a calculator, not a recommendation. The starting inputs (beta, the
// equity risk premium, the terminal growth rate) are conventional placeholders,
// not a house view, and the sheet says so.
//
// THREE THINGS WORTH KNOWING:
//
// 1. Free cash flow is *unlevered*: NOPAT (EBIT after cash tax, with no interest
//    shield) plus D&A, less capex, less the increase in net working capital.
//    Stock-based compensation is left inside EBIT as the real cost it is, rather
//    than added back — the conservative treatment, and the one that avoids
//    valuing a company on cash flow it never keeps.
//
// 2. Discounting is done with an explicit discount-factor row, each cell the one
//    to its left divided by (1 + WACC), rather than a hidden NPV() or a power.
//    The reader sees the factors, and the terminal value discounts at the final
//    year's factor like every other flow. Year-end is the default (DF₁ = 1/(1+w)).
//    Mid-year (optional) is the IB cash-timing convention: DF₁ = 1/√(1+w), then
//    × 1/(1+w) each year; Gordon TV still uses that same last DF.
//
// 3. The sensitivity grid recomputes value per share for each (WACC, growth)
//    pair from the same fixed free-cash-flow cells, so it needs no What-If data
//    table — which recalculates unreliably outside desktop Excel — and stays
//    consistent with the headline number by construction.

import type ExcelJS from "exceljs";
import type { CompanyFinancials, StatementSet } from "./edgar";
import type { Projection } from "./excel-projection";
import { A_ROW } from "./excel-projection";
import type { SectorBeta } from "./dcf-sector";
import {
  buildSensitivityMatrix,
  EXCEL_GROWTH_DELTAS,
  EXCEL_WACC_DELTAS,
  type DiscountConvention,
} from "./dcf-sensitivity";
import { companyOperatingMetrics } from "./valuation/metrics";
import {
  colLetter,
  setFormula,
  setInput,
  sheetHeader,
  sizeColumns,
  sectionRow,
  INPUT_BLUE,
  NAVY,
  GREEN,
  GREY,
  MUTED,
  MONEY_FMT,
  PCT_FMT,
  PER_SHARE_FMT,
  SHARES_FMT,
  MULT_FMT,
} from "./excel-format";

const M = 1e6;

/** Last reported annual value for a line. */
function lastValue(set: StatementSet, key: string): number | null {
  const p = set.periods[0];
  if (!p) return null;
  for (const st of set.statements) {
    const l = st.lines.find((x) => x.key === key);
    if (l) return l.values[p.key] ?? null;
  }
  return null;
}

function lineAt(set: StatementSet, key: string, periodKey: string): number | null {
  for (const st of set.statements) {
    const l = st.lines.find((x) => x.key === key);
    if (l) return l.values[periodKey] ?? null;
  }
  return null;
}

/** How many trailing annual years of history to show left of the forecast. */
export const DCF_HISTORY_YEARS = 3;

/**
 * Trailing annual FCF-bridge history (oldest → newest), for the DCF sheet.
 * Uses the same unlevered definition as the forward model; tax on EBIT at the
 * model tax rate when pretax/tax tags are incomplete.
 */
export function buildDcfHistory(
  fin: CompanyFinancials,
  taxRate: number,
  n = DCF_HISTORY_YEARS
): {
  labels: string[];
  ebit: (number | null)[];
  cashTax: (number | null)[];
  nopat: (number | null)[];
  da: (number | null)[];
  capex: (number | null)[];
  nwc: (number | null)[];
  changeNwc: (number | null)[];
  fcf: (number | null)[];
} {
  const set = fin.annual;
  // Newest first on the period axis → reverse to oldest-first columns.
  const periods = set.periods.slice(0, n).reverse();
  const labels = periods.map((p) => p.label || p.end.slice(0, 4));
  const ebit: (number | null)[] = [];
  const cashTax: (number | null)[] = [];
  const nopat: (number | null)[] = [];
  const da: (number | null)[] = [];
  const capex: (number | null)[] = [];
  const nwc: (number | null)[] = [];
  const changeNwc: (number | null)[] = [];
  const fcf: (number | null)[] = [];

  let prevNwc: number | null = null;
  // One year before the first history column, for ΔNWC on the first hist year.
  if (set.periods.length > n) {
    const prior = set.periods[n]; // newest-first: index n is the year before the oldest kept
    if (prior) {
      const ar = lineAt(set, "receivables", prior.key) ?? 0;
      const inv = lineAt(set, "inventory", prior.key) ?? 0;
      const ap = lineAt(set, "payables", prior.key) ?? 0;
      prevNwc = ar + inv - ap;
    }
  }

  for (const p of periods) {
    const e = lineAt(set, "operatingIncome", p.key);
    const daV = lineAt(set, "da", p.key);
    const capRaw = lineAt(set, "capex", p.key);
    const cap = capRaw != null ? Math.abs(capRaw) : null;
    const ar = lineAt(set, "receivables", p.key);
    const inv = lineAt(set, "inventory", p.key);
    const ap = lineAt(set, "payables", p.key);
    const wc =
      ar != null || inv != null || ap != null
        ? (ar ?? 0) + (inv ?? 0) - (ap ?? 0)
        : null;
    const tax = e != null && e > 0 ? e * taxRate : e != null ? 0 : null;
    const nop = e != null && tax != null ? e - tax : null;
    const dWc = wc != null && prevNwc != null ? wc - prevNwc : null;
    const f =
      nop != null && daV != null && cap != null && dWc != null
        ? nop + daV - cap - dWc
        : nop != null && daV != null && cap != null
          ? nop + daV - cap
          : null;

    ebit.push(e);
    cashTax.push(tax);
    nopat.push(nop);
    da.push(daV);
    capex.push(cap);
    nwc.push(wc);
    changeNwc.push(dWc);
    fcf.push(f);
    if (wc != null) prevNwc = wc;
  }

  return { labels, ebit, cashTax, nopat, da, capex, nwc, changeNwc, fcf };
}

const clamp = (v: number, lo: number, hi: number, fallback: number) =>
  Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback;

export interface DcfInputs {
  riskFree: number;
  beta: number;
  equityRiskPremium: number;
  preTaxCostOfDebt: number;
  taxRate: number;
  weightEquity: number;
  terminalGrowth: number;
  exitMultiple: number;
  /** Default year-end so existing callers and tests stay put. */
  discountConvention?: DiscountConvention;
}

export interface Dcf {
  labels: string[];
  inputs: DcfInputs;
  /** Reference sector the starting beta came from, if a SIC mapping was found. */
  sector: string | null;
  costOfEquity: number;
  afterTaxCostOfDebt: number;
  weightDebt: number;
  wacc: number;
  // Per projected year.
  ebit: number[];
  cashTax: number[];
  nopat: number[];
  da: number[];
  capex: number[];
  nwc: number[];
  changeNwc: number[];
  fcf: number[];
  discountFactor: number[];
  pvFcf: number[];
  // Valuation summary (raw currency units, except per-share which is per share).
  baseNwc: number;
  sumPvFcf: number;
  terminalValue: number;
  pvTerminalValue: number;
  enterpriseValue: number;
  debt: number;
  cash: number;
  /** Filed legs used in the fuller equity bridge; null = not tagged. */
  leases: number | null;
  nci: number | null;
  preferred: number | null;
  pensionDeficit: number | null;
  cashUnrestricted: number | null;
  /** debt + leases + NCI + pref + pension − (unrestricted cash ?? cash). */
  netDebt: number;
  equityValue: number;
  shares: number | null;
  perShare: number | null;
  notes: string[];
  tvShareOfEv: number;
  // Exit-multiple cross-check.
  ebitdaFinal: number;
  exitTerminalValue: number;
  exitEnterpriseValue: number;
  exitPerShare: number | null;
  // Sensitivity.
  waccAxis: number[];
  growthAxis: number[];
  sensitivity: number[][]; // [waccIndex][growthIndex] -> value per share
  // Reverse DCF — present only when a market price was available.
  reverse: ReverseDcf | null;
}

export interface ReverseDcf {
  marketPrice: number;
  marketEquity: number;
  netDebt: number;
  marketEV: number;
  /** Discount rate that makes our FCF path worth the market EV: the return
   *  the market is pricing in, holding terminal growth fixed. */
  impliedReturn: number;
  returnClamped: boolean;
  /** Perpetual growth that justifies the market EV at our base WACC. */
  impliedGrowth: number;
  growthClamped: boolean;
}

/** Enterprise value of a fixed FCF path discounted at `rate`, Gordon TV at `g`. */
function evAtRate(
  fcf: number[],
  rate: number,
  g: number,
  convention: DiscountConvention = "year-end"
): number {
  const r = 1 + rate;
  let df = convention === "mid-year" ? 1 / Math.sqrt(r) : 1 / r;
  let sum = 0;
  for (let t = 0; t < fcf.length; t++) {
    if (t > 0) df /= r;
    sum += fcf[t] * df;
  }
  const tv = rate > g ? (fcf[fcf.length - 1] * (1 + g)) / (rate - g) : Infinity;
  return sum + tv * df;
}

/**
 * Closed-form perpetual growth that prices Market EV at base WACC, holding the
 * explicit FCF path fixed (Gordon terminal only).
 *
 * Let A = (MarketEV − Σ PV explicit FCF) / (FCFₙ × DFₙ).
 * Then A = (1+g)/(WACC−g) ⇒ g = (A×WACC − 1)/(A + 1).
 */
export function impliedGrowthClosedForm(
  marketEV: number,
  sumPvFcf: number,
  finalFcf: number,
  finalDf: number,
  wacc: number
): { value: number; clamped: boolean } {
  const lo = -0.05;
  const hi = wacc - 0.005;
  if (
    !(finalFcf > 0) ||
    !(finalDf > 0) ||
    !(wacc > 0) ||
    !Number.isFinite(marketEV) ||
    !Number.isFinite(sumPvFcf)
  ) {
    return { value: Math.max(lo, Math.min(hi, 0)), clamped: true };
  }
  const residual = marketEV - sumPvFcf;
  const A = residual / (finalFcf * finalDf);
  if (!(A > 0) || !Number.isFinite(A)) {
    return { value: lo, clamped: true };
  }
  const g = (A * wacc - 1) / (A + 1);
  if (!Number.isFinite(g)) return { value: lo, clamped: true };
  if (g < lo) return { value: lo, clamped: true };
  if (g > hi) return { value: hi, clamped: true };
  return { value: g, clamped: false };
}

/** Bisection for the value where `f` crosses `target`; `f` must be monotone. */
function bisect(
  f: (x: number) => number,
  lo: number,
  hi: number,
  target: number,
  increasing: boolean
): { value: number; clamped: boolean } {
  if (increasing) {
    if (f(lo) >= target) return { value: lo, clamped: true };
    if (f(hi) <= target) return { value: hi, clamped: true };
  } else {
    if (f(lo) <= target) return { value: lo, clamped: true };
    if (f(hi) >= target) return { value: hi, clamped: true };
  }
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    const below = increasing ? f(mid) < target : f(mid) > target;
    if (below) lo = mid;
    else hi = mid;
  }
  return { value: (lo + hi) / 2, clamped: false };
}

/**
 * Build the DCF off a finished projection. Returns null when the projection is
 * absent (banks, trusts) — there is no unlevered cash flow to discount.
 *
 * `overrides` exist for the same reason the projection's do: to exercise the
 * model at the extremes a user can type. The workbook never passes them.
 */
export function buildDcf(
  fin: CompanyFinancials,
  projection: Projection | null,
  betaSector?: SectorBeta | null,
  marketPrice?: number | null,
  overrides?: Partial<DcfInputs>
): Dcf | null {
  if (!projection) return null;
  const p = projection;
  const years = p.labels.length;
  if (years < 1) return null;

  const base = p.base;
  // Cost of debt: the projection's own derived interest rate, unless it rounded
  // to near-zero (a filer that stopped tagging interest), where a conventional
  // 5% is more honest than valuing debt as free.
  const modelRate = p.assumptions.interestRate[0];
  const preTaxKd = modelRate > 0.01 ? clamp(modelRate, 0.01, 0.15, 0.05) : 0.05;
  const taxRate = clamp(p.assumptions.taxRate[0], 0, 0.45, 0.21);

  // Book / target-from-filings weights, not live market cap / EV. A market-weight
  // WACC would re-lever every day (the usual IB approach); this one stays
  // filing-native on purpose.
  const totalCap = base.equity + base.debt;
  const weightEquity =
    totalCap > 0 && base.equity > 0 ? clamp(base.equity / totalCap, 0, 1, 1) : 1;

  const inputs: DcfInputs = {
    riskFree: 0.043,
    // Sector reference beta where the SIC maps to one, else the neutral default.
    beta: betaSector?.beta ?? 1.1,
    equityRiskPremium: 0.055,
    preTaxCostOfDebt: preTaxKd,
    taxRate,
    weightEquity,
    terminalGrowth: 0.025,
    exitMultiple: 12,
    discountConvention: "year-end",
    ...overrides,
  };
  if (inputs.discountConvention !== "mid-year") {
    inputs.discountConvention = "year-end";
  }
  const convention: DiscountConvention = inputs.discountConvention;

  const costOfEquity = inputs.riskFree + inputs.beta * inputs.equityRiskPremium;
  const afterTaxCostOfDebt = inputs.preTaxCostOfDebt * (1 - inputs.taxRate);
  const weightDebt = 1 - inputs.weightEquity;
  const wacc = inputs.weightEquity * costOfEquity + weightDebt * afterTaxCostOfDebt;

  const baseNwc = base.receivables + base.inventory - base.payables;
  const notes: string[] = [];

  const ebit: number[] = [];
  const cashTax: number[] = [];
  const nopat: number[] = [];
  const da: number[] = [];
  const capex: number[] = [];
  const nwc: number[] = [];
  const changeNwc: number[] = [];
  const fcf: number[] = [];
  const discountFactor: number[] = [];
  const pvFcf: number[] = [];

  // Mid-year: first DF is 1/√(1+w), then × 1/(1+w) each year (0-based t+0.5).
  const rWacc = 1 + wacc;
  let rollingDf = convention === "mid-year" ? 1 / Math.sqrt(rWacc) : 1 / rWacc;

  for (let t = 0; t < years; t++) {
    const e = p.ebit[t];
    const tax = e > 0 ? e * inputs.taxRate : 0;
    const nop = e - tax;
    const wc = p.receivables[t] + p.inventory[t] - p.payables[t];
    const wcPrev = t === 0 ? baseNwc : nwc[t - 1];
    const dWc = wc - wcPrev;
    const f = nop + p.da[t] - p.capex[t] - dWc;
    if (t > 0) rollingDf /= rWacc;
    const df = rollingDf;
    ebit.push(e);
    cashTax.push(tax);
    nopat.push(nop);
    da.push(p.da[t]);
    capex.push(p.capex[t]);
    nwc.push(wc);
    changeNwc.push(dWc);
    fcf.push(f);
    discountFactor.push(df);
    pvFcf.push(f * df);
  }

  const sumPvFcf = pvFcf.reduce((s, v) => s + v, 0);
  const finalDf = discountFactor[years - 1];
  const g = inputs.terminalGrowth;
  const spread = wacc - g;
  const terminalValue = spread > 0 ? (fcf[years - 1] * (1 + g)) / spread : 0;
  if (!(spread > 0)) {
    notes.push("WACC ≤ terminal growth — Gordon TV set to 0 (non-convergent).");
  }
  const pvTerminalValue = terminalValue * finalDf;
  const enterpriseValue = sumPvFcf + pvTerminalValue;
  const debt = base.debt;
  const cash = base.cash;

  // Fuller equity bridge: debt + leases + NCI + pref + pension − unrestricted cash.
  // Null extra legs are omitted, so this equals EV − debt + cash when they are blank.
  const op = companyOperatingMetrics(fin);
  const leases = op.leaseLiability;
  const nci = op.minorityInterest;
  const preferred = op.preferredEquity;
  const pensionDeficit = op.pensionDeficit;
  const cashUnrestricted = op.cashUnrestricted;
  const cashForBridge = cashUnrestricted ?? cash;
  const netDebt =
    debt +
    (leases ?? 0) +
    (nci ?? 0) +
    (preferred ?? 0) +
    (pensionDeficit ?? 0) -
    cashForBridge;
  const equityValue = enterpriseValue - netDebt;
  const shares = lastValue(fin.annual, "sharesDiluted");
  const perShare = shares && shares > 0 ? equityValue / shares : null;
  const tvShareOfEv = enterpriseValue !== 0 ? pvTerminalValue / enterpriseValue : 0;

  const ebitdaFinal = p.ebitda[years - 1];
  const exitTerminalValue = ebitdaFinal * inputs.exitMultiple;
  const exitEnterpriseValue = sumPvFcf + exitTerminalValue * finalDf;
  const exitPerShare =
    shares && shares > 0 ? (exitEnterpriseValue - netDebt) / shares : null;

  // Sensitivity axes centred on the base case (Excel grid: WACC ±2% / 1% steps,
  // growth ±1% / 0.5% steps). The in-UI grid uses tighter steps via dcf-sensitivity.
  // Book debt/cash (not the fuller net-debt legs) so the Excel Horner block can
  // stay on R.lessDebt / R.addCash without inserting rows into the grid.
  const sens = buildSensitivityMatrix({
    fcf,
    baseWacc: wacc,
    baseGrowth: g,
    debt,
    cash,
    shares,
    waccDeltas: EXCEL_WACC_DELTAS,
    growthDeltas: EXCEL_GROWTH_DELTAS,
    discountConvention: convention,
  });
  const waccAxis = sens.waccAxis;
  const growthAxis = sens.growthAxis;
  const sensitivity = sens.values.map((row) => row.map((v) => v ?? 0));

  // Reverse DCF: hold the free-cash-flow path fixed and back out what today's
  // price implies. Two readings — the discount rate that makes our cash flows
  // worth the market's enterprise value (the return being priced in), and the
  // perpetual growth that does the same at our base WACC.
  let reverse: ReverseDcf | null = null;
  if (marketPrice != null && marketPrice > 0 && shares && shares > 0) {
    const marketEquity = marketPrice * shares;
    const marketEV = marketEquity + netDebt;
    // Return: circular (Gordon TV depends on the solved rate) — bisection, not closed form.
    const ret = bisect((r) => evAtRate(fcf, r, g, convention), g + 0.005, 0.6, marketEV, false);
    // Growth: closed-form at base WACC (matches the Excel live formula).
    const finalFcf = fcf[fcf.length - 1]!;
    const grw = impliedGrowthClosedForm(
      marketEV,
      sumPvFcf,
      finalFcf,
      finalDf,
      wacc
    );
    reverse = {
      marketPrice,
      marketEquity,
      netDebt,
      marketEV,
      impliedReturn: ret.value,
      returnClamped: ret.clamped,
      impliedGrowth: grw.value,
      growthClamped: grw.clamped,
    };
  }

  return {
    labels: p.labels,
    inputs,
    sector: betaSector?.sector ?? null,
    costOfEquity,
    afterTaxCostOfDebt,
    weightDebt,
    wacc,
    ebit,
    cashTax,
    nopat,
    da,
    capex,
    nwc,
    changeNwc,
    fcf,
    discountFactor,
    pvFcf,
    baseNwc,
    sumPvFcf,
    terminalValue,
    pvTerminalValue,
    enterpriseValue,
    debt,
    cash,
    leases,
    nci,
    preferred,
    pensionDeficit,
    cashUnrestricted,
    netDebt,
    equityValue,
    shares,
    perShare,
    notes,
    tvShareOfEv,
    ebitdaFinal,
    exitTerminalValue,
    exitEnterpriseValue,
    exitPerShare,
    waccAxis,
    growthAxis,
    sensitivity,
    reverse,
  };
}

// --- sheet writer -----------------------------------------------------------

// Row layout. WACC and valuation figures are single values in column C; the
// free-cash-flow build spans the projected-year columns C..G like the other
// projection sheets.
const R = {
  riskFree: 7,
  beta: 8,
  erp: 9,
  costEquity: 10,
  preTaxKd: 12,
  taxRate: 13,
  afterTaxKd: 14,
  weightEquity: 15,
  weightDebt: 16,
  wacc: 17,
  ebit: 20,
  cashTax: 21,
  nopat: 22,
  da: 23,
  capex: 24,
  nwc: 25,
  changeNwc: 26,
  fcf: 27,
  df: 28,
  pv: 29,
  sumPv: 32,
  termGrowth: 33,
  termValue: 34,
  pvTermValue: 35,
  ev: 36,
  lessDebt: 37,
  addCash: 38,
  equity: 39,
  shares: 40,
  perShare: 41,
  tvPct: 42,
  exitMult: 44,
  exitTv: 45,
  exitEv: 46,
  exitPerShare: 47,
  sensTitle: 49,
  sensGrowthHeader: 50,
  sensFirst: 51, // grid rows sensFirst .. sensFirst+4
  revTitle: 57,
  revPrice: 58,
  revShares: 59,
  revMktCap: 60,
  revNetDebt: 61,
  revMktEV: 62,
  revBaseEV: 63,
  revReturn: 64,
  revGrowth: 65,
  notesFirst: 67,
} as const;

// The projection sheets these formulas reference. Kept in sync with
// excel-projection.ts by the workbook builder, which names all three.
const PROJECTIONS_SHEET = "Projections";
const SCHEDULES_SHEET = "Schedules";
const ASSUMPTIONS_SHEET = "Assumptions";
const P_ROW = { ebit: 12, da: 11, ebitda: 10 };
const S_ROW = { capex: 7, receivables: 24, inventory: 25, payables: 26 };
const pRef = (row: number, t: number) => `'${PROJECTIONS_SHEET}'!${colLetter(t + 3)}${row}`;
const sRef = (row: number, t: number) => `'${SCHEDULES_SHEET}'!${colLetter(t + 3)}${row}`;
/** Column C of Assumptions = first forecast year (year 1E). */
const aRefC = (row: number) => `'${ASSUMPTIONS_SHEET}'!C${row}`;

export function fillDcfSheet(ws: ExcelJS.Worksheet, fin: CompanyFinancials, d: Dcf) {
  // Column layout:
  //   A = labels
  //   B = scalar inputs / outputs (WACC, EV bridge, reverse DCF)
  //   C.. = up to 3 historical years (oldest → newest)
  //   then forecast years (Y1E..)
  const hist = buildDcfHistory(fin, d.inputs.taxRate, DCF_HISTORY_YEARS);
  const HIST_N = hist.labels.length;
  const fcastN = d.labels.length;
  const SC = "B"; // scalar column
  const histStartCol = 3; // C
  const fcastStartCol = histStartCol + HIST_N;
  const H = (h: number) => colLetter(histStartCol + h);
  const C = (t: number) => colLetter(fcastStartCol + t);
  const totalTimeCols = HIST_N + fcastN;
  const colLabels = [...hist.labels, ...d.labels];

  sheetHeader(
    ws,
    "DCF Valuation",
    "Unlevered free cash flow discounted at WACC, with Gordon-growth and exit-multiple terminal values.",
    `${fin.currency} in millions unless noted. Columns ${hist.labels[0] ?? "—"}–${hist.labels[HIST_N - 1] ?? "—"} are filed history; ${d.labels[0] ?? "Y1E"}+ are the forecast. Blue = inputs; green = cross-sheet links. Column B holds WACC/valuation scalars.`,
    // Leading blank keeps column B free for scalars under an empty header.
    ["", ...colLabels],
    NAVY,
    "Line item"
  );
  // Tint history headers so they read as actuals, not forecasts.
  {
    const headerRow = ws.getRow(4);
    for (let h = 0; h < HIST_N; h++) {
      const cell = headerRow.getCell(histStartCol + h);
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF475569" }, // slate — history
      };
    }
  }

  const money = (row: number, label: string, opts: { bold?: boolean; indent?: boolean } = {}) => {
    const r = ws.getRow(row);
    r.getCell(1).value = (opts.indent ? "    " : "") + label;
    r.getCell(1).font = { size: 10, bold: opts.bold };
    return r;
  };
  // Scalar figure in column B (WACC build, EV bridge, reverse DCF).
  const one = (
    row: number,
    label: string,
    formula: string | null,
    result: number,
    fmt: string,
    opts: { bold?: boolean; input?: boolean; indent?: boolean; color?: string } = {}
  ) => {
    const r = ws.getRow(row);
    r.getCell(1).value = (opts.indent ? "    " : "") + label;
    r.getCell(1).font = { size: 10, bold: opts.bold };
    const c = r.getCell(2);
    if (opts.input) {
      setInput(c, result, fmt);
    } else if (formula) {
      setFormula(c, formula, result, fmt);
      c.font = { size: 10, bold: opts.bold, color: opts.color ? { argb: opts.color } : undefined };
    } else {
      c.value = result;
      c.numFmt = fmt;
      c.font = { size: 10, bold: opts.bold, color: opts.color ? { argb: opts.color } : undefined };
    }
  };
  /** Static history values (muted) left of the forecast. */
  const acrossHist = (
    row: number,
    vals: (number | null)[],
    fmt: string,
    scale = true
  ) => {
    const r = ws.getRow(row);
    vals.forEach((v, h) => {
      if (v == null || !Number.isFinite(v)) return;
      const cell = r.getCell(histStartCol + h);
      cell.value = scale ? v / M : v;
      cell.numFmt = fmt;
      cell.font = { size: 10, color: { argb: MUTED }, italic: true };
    });
  };
  // Formulas across the projected-year columns only.
  const across = (
    row: number,
    label: string,
    expr: (t: number) => string,
    vals: number[],
    fmt: string,
    opts: { bold?: boolean; indent?: boolean } = {}
  ) => {
    const r = money(row, label, opts);
    vals.forEach((v, t) => {
      const cell = r.getCell(fcastStartCol + t);
      setFormula(cell, expr(t), v, fmt);
      cell.font = { size: 10, bold: opts.bold };
    });
  };

  // --- WACC build-up (scalars in column B)
  sectionRow(ws, 6, "Cost of capital (WACC)", totalTimeCols + 1, NAVY);
  one(R.riskFree, "Risk-free rate", null, d.inputs.riskFree, PCT_FMT, { input: true });
  one(R.beta, d.sector ? `Beta (levered — ${d.sector} ref.)` : "Beta (levered)",
    null, d.inputs.beta, "0.00", { input: true });
  one(R.erp, "Equity risk premium", null, d.inputs.equityRiskPremium, PCT_FMT, { input: true });
  one(R.costEquity, "Cost of equity  (rf + β × ERP)",
    `${SC}${R.riskFree}+${SC}${R.beta}*${SC}${R.erp}`, d.costOfEquity, PCT_FMT, { bold: true });
  // Single source of truth: same drivers as Assumptions (interest rate / tax).
  one(
    R.preTaxKd,
    "Pre-tax cost of debt  (Assumptions interest rate)",
    aRefC(A_ROW.interestRate),
    d.inputs.preTaxCostOfDebt,
    PCT_FMT,
    { color: GREEN }
  );
  one(
    R.taxRate,
    "Tax rate  (Assumptions effective tax)",
    aRefC(A_ROW.taxRate),
    d.inputs.taxRate,
    PCT_FMT,
    { color: GREEN }
  );
  one(R.afterTaxKd, "After-tax cost of debt  (× (1 − tax))",
    `${SC}${R.preTaxKd}*(1-${SC}${R.taxRate})`, d.afterTaxCostOfDebt, PCT_FMT, { bold: true });
  one(R.weightEquity, "Weight of equity", null, d.inputs.weightEquity, PCT_FMT, { input: true });
  one(R.weightDebt, "Weight of debt  (1 − equity)",
    `1-${SC}${R.weightEquity}`, d.weightDebt, PCT_FMT);
  one(R.wacc, "WACC",
    `${SC}${R.weightEquity}*${SC}${R.costEquity}+${SC}${R.weightDebt}*${SC}${R.afterTaxKd}`,
    d.wacc, PCT_FMT, { bold: true, color: NAVY });
  // Weights are book / target-from-filings, not live market cap — see notes.

  // --- unlevered free cash flow (history left, forecast right)
  sectionRow(ws, 19, "Unlevered free cash flow", totalTimeCols + 1, NAVY);
  across(R.ebit, "EBIT", (t) => pRef(P_ROW.ebit, t), d.ebit.map((v) => v / M), MONEY_FMT);
  acrossHist(R.ebit, hist.ebit, MONEY_FMT);
  across(R.cashTax, "Less: cash taxes on EBIT",
    (t) => `-IF(${C(t)}${R.ebit}>0,${C(t)}${R.ebit}*$${SC}$${R.taxRate},0)`,
    d.cashTax.map((v) => -v / M), MONEY_FMT, { indent: true });
  acrossHist(R.cashTax, hist.cashTax.map((v) => (v == null ? null : -v)), MONEY_FMT);
  across(R.nopat, "NOPAT", (t) => `${C(t)}${R.ebit}+${C(t)}${R.cashTax}`,
    d.nopat.map((v) => v / M), MONEY_FMT, { bold: true });
  acrossHist(R.nopat, hist.nopat, MONEY_FMT);
  across(R.da, "Add: D&A", (t) => pRef(P_ROW.da, t), d.da.map((v) => v / M), MONEY_FMT, { indent: true });
  acrossHist(R.da, hist.da, MONEY_FMT);
  across(R.capex, "Less: capital expenditure", (t) => `-${sRef(S_ROW.capex, t)}`,
    d.capex.map((v) => -v / M), MONEY_FMT, { indent: true });
  acrossHist(R.capex, hist.capex.map((v) => (v == null ? null : -v)), MONEY_FMT);
  across(R.nwc, "Net working capital",
    (t) => `${sRef(S_ROW.receivables, t)}+${sRef(S_ROW.inventory, t)}-${sRef(S_ROW.payables, t)}`,
    d.nwc.map((v) => v / M), MONEY_FMT, { indent: true });
  acrossHist(R.nwc, hist.nwc, MONEY_FMT);
  // First forecast ΔNWC differences against last historical NWC (or model base NWC).
  const nwcPriorExpr =
    HIST_N > 0 ? `${H(HIST_N - 1)}${R.nwc}` : String(d.baseNwc / M);
  across(R.changeNwc, "Less: increase in NWC",
    (t) =>
      `-(${C(t)}${R.nwc}-${t === 0 ? nwcPriorExpr : `${C(t - 1)}${R.nwc}`})`,
    d.changeNwc.map((v) => -v / M), MONEY_FMT, { indent: true });
  acrossHist(R.changeNwc, hist.changeNwc.map((v) => (v == null ? null : -v)), MONEY_FMT);
  across(R.fcf, "Unlevered free cash flow",
    (t) => `${C(t)}${R.nopat}+${C(t)}${R.da}+${C(t)}${R.capex}+${C(t)}${R.changeNwc}`,
    d.fcf.map((v) => v / M), MONEY_FMT, { bold: true });
  acrossHist(R.fcf, hist.fcf, MONEY_FMT);
  const midYear = d.inputs.discountConvention === "mid-year";
  across(
    R.df,
    midYear ? "Discount factor @ WACC (mid-year)" : "Discount factor @ WACC",
    (t) =>
      t === 0
        ? midYear
          ? `1/SQRT(1+$${SC}$${R.wacc})`
          : `1/(1+$${SC}$${R.wacc})`
        : `${C(t - 1)}${R.df}/(1+$${SC}$${R.wacc})`,
    d.discountFactor, "0.000", { indent: true });
  across(R.pv, "PV of free cash flow", (t) => `${C(t)}${R.fcf}*${C(t)}${R.df}`,
    d.pvFcf.map((v) => v / M), MONEY_FMT, { bold: true });

  // --- valuation (Gordon growth)
  sectionRow(ws, 31, "Enterprise & equity value (Gordon growth)", totalTimeCols + 1, NAVY);
  const lastCol = C(fcastN - 1);
  const firstPvCol = C(0);

  // Extra equity-bridge legs land AFTER the notes block (R.notesFirst is fixed).
  // Signed the same way as Less debt / Add cash so the headline equity formula
  // can just add them. Null legs are omitted — formula then matches today.
  const extraLegs: { label: string; value: number }[] = [];
  if (d.leases != null) {
    extraLegs.push({ label: "Less: operating leases (filed)", value: -d.leases });
  }
  if (d.nci != null) {
    extraLegs.push({ label: "Less: NCI / minority interest (filed)", value: -d.nci });
  }
  if (d.preferred != null) {
    extraLegs.push({ label: "Less: preferred equity (filed)", value: -d.preferred });
  }
  if (d.pensionDeficit != null) {
    extraLegs.push({ label: "Less: pension deficit (filed)", value: -d.pensionDeficit });
  }
  if (
    d.cashUnrestricted != null &&
    Number.isFinite(d.cashUnrestricted) &&
    d.cashUnrestricted !== d.cash
  ) {
    extraLegs.push({
      label: "Add: unrestricted cash vs reported cash",
      value: d.cashUnrestricted - d.cash,
    });
  }

  const sheetNotes = [
    "Free cash flow is unlevered: EBIT after cash tax, plus D&A, less capex and the increase in net working",
    "capital. Stock-based compensation stays inside EBIT as a real cost rather than being added back.",
    "Historical columns (slate headers) are filed actuals rebuilt with the same unlevered FCF definition;",
    "they are not discounted. Forecast columns link to Projections / Schedules.",
    midYear
      ? "Discount factors are mid-year (IB cash-timing): year 1 is 1/√(1+WACC), then × 1/(1+WACC). Gordon TV uses the same last DF."
      : "Discount factors are year-end: year 1 is 1/(1+WACC), then × 1/(1+WACC). Gordon TV uses the same last DF.",
    "WACC equity/debt weights are book capital (or the target implied by filings), not live market cap / EV.",
    "Terminal value uses Gordon growth as the headline and the exit multiple as a cross-check; the two rarely",
    "agree exactly, and a wide gap is a signal to revisit the assumptions rather than an error.",
    extraLegs.length > 0
      ? "Equity value is EV less a fuller net debt (debt + leases + NCI + preferred + pension − unrestricted cash)."
      : "Equity value is enterprise value less total debt plus cash. Non-operating assets such as long-term",
    extraLegs.length > 0
      ? "Extra filed legs are listed after these notes and folded into the equity formula; they do not shift the WACC/FCF grid."
      : "investments are not added back — fold them in yourself if your definition of value includes them.",
    "Pre-tax cost of debt and tax rate are linked to Assumptions (green) — edit them there, not on this sheet.",
    "Reverse DCF — implied perpetual growth is a live closed-form formula at the base WACC and updates with",
    "price and the FCF path. Implied expected return is Goal Seek only: Data → What-If → Goal Seek, set Market",
    "enterprise value equal to Base-case enterprise value by changing the return cell (inherently circular).",
    ...d.notes,
    "This is a calculator that reflects the inputs above. It is not a forecast, a price target, or investment advice.",
  ];
  const extraHeaderRow = R.notesFirst + sheetNotes.length + 2;
  const extraFirstLegRow = extraHeaderRow + 1;
  let extraEq = "";
  for (let i = 0; i < extraLegs.length; i++) {
    extraEq += `+${SC}${extraFirstLegRow + i}`;
  }

  one(R.sumPv, "Sum of PV of explicit FCF",
    `SUM(${firstPvCol}${R.pv}:${lastCol}${R.pv})`, d.sumPvFcf / M, MONEY_FMT, { bold: true });
  one(R.termGrowth, "Terminal growth rate", null, d.inputs.terminalGrowth, PCT_FMT, { input: true });
  one(R.termValue, "Terminal value  (FCFₙ × (1+g) / (WACC − g))",
    `IF(${SC}${R.wacc}>${SC}${R.termGrowth},${lastCol}${R.fcf}*(1+${SC}${R.termGrowth})/(${SC}${R.wacc}-${SC}${R.termGrowth}),0)`,
    d.terminalValue / M, MONEY_FMT);
  one(R.pvTermValue, "PV of terminal value",
    `${SC}${R.termValue}*${lastCol}${R.df}`, d.pvTerminalValue / M, MONEY_FMT);
  one(R.ev, "Enterprise value",
    `${SC}${R.sumPv}+${SC}${R.pvTermValue}`, d.enterpriseValue / M, MONEY_FMT, { bold: true, color: NAVY });
  one(R.lessDebt, "Less: total debt", null, -d.debt / M, MONEY_FMT, { indent: true });
  one(R.addCash, "Add: cash & equivalents", null, d.cash / M, MONEY_FMT, { indent: true });
  one(R.equity, "Equity value",
    `${SC}${R.ev}+${SC}${R.lessDebt}+${SC}${R.addCash}${extraEq}`, d.equityValue / M, MONEY_FMT, { bold: true, color: NAVY });
  one(R.shares, "Diluted shares (millions)", null, d.shares != null ? d.shares / M : 0, SHARES_FMT, {
    indent: true,
  });
  if (d.perShare != null) {
    one(R.perShare, "Implied value per share",
      `${SC}${R.equity}/${SC}${R.shares}`, d.perShare, PER_SHARE_FMT, { bold: true, color: GREEN });
  } else {
    money(R.perShare, "Implied value per share", { bold: true });
  }
  one(R.tvPct, "Terminal value as % of enterprise value",
    `${SC}${R.pvTermValue}/${SC}${R.ev}`, d.tvShareOfEv, PCT_FMT, { indent: true });

  // --- exit-multiple cross-check
  sectionRow(ws, 43, "Cross-check: exit multiple", totalTimeCols + 1, NAVY);
  one(R.exitMult, "Exit EV / EBITDA multiple", null, d.inputs.exitMultiple, MULT_FMT, { input: true });
  one(R.exitTv, "Terminal value  (final EBITDA × multiple)",
    `'${PROJECTIONS_SHEET}'!${colLetter(3 + fcastN - 1)}${P_ROW.ebitda}*${SC}${R.exitMult}`,
    d.exitTerminalValue / M, MONEY_FMT);
  one(R.exitEv, "Implied enterprise value (exit method)",
    `${SC}${R.sumPv}+${SC}${R.exitTv}*${lastCol}${R.df}`, d.exitEnterpriseValue / M, MONEY_FMT, { bold: true });
  if (d.exitPerShare != null) {
    one(R.exitPerShare, "Implied value per share (exit method)",
      `(${SC}${R.exitEv}+${SC}${R.lessDebt}+${SC}${R.addCash})/${SC}${R.shares}`, d.exitPerShare, PER_SHARE_FMT, { bold: true });
  } else {
    money(R.exitPerShare, "Implied value per share (exit method)", { bold: true });
  }

  // --- sensitivity grid: value per share vs WACC (rows) × growth (cols)
  const gr = ws.getRow(R.sensTitle);
  gr.getCell(1).value = "Sensitivity — implied value per share";
  gr.getCell(1).font = { size: 10, bold: true, color: { argb: NAVY } };
  const hdr = ws.getRow(R.sensGrowthHeader);
  hdr.getCell(2).value = "WACC ↓ / g →";
  hdr.getCell(2).font = { size: 9, italic: true, color: { argb: GREY } };
  d.growthAxis.forEach((g_, j) => {
    const c = hdr.getCell(j + 3);
    c.value = g_;
    c.numFmt = PCT_FMT;
    c.font = { size: 10, bold: true, color: { argb: NAVY } };
    c.alignment = { horizontal: "right" };
  });
  d.waccAxis.forEach((w, i) => {
    const rr = R.sensFirst + i;
    const r = ws.getRow(rr);
    const waccCell = r.getCell(2);
    waccCell.value = w;
    waccCell.numFmt = PCT_FMT;
    waccCell.font = { size: 10, bold: true, color: { argb: NAVY } };
    d.growthAxis.forEach((_g, j) => {
      const col = colLetter(j + 3);
      const gHdr = `${col}$${R.sensGrowthHeader}`;
      const wRef = `$${SC}${rr}`;
      const r1 = `(1+${wRef})`;
      // Mid-year first DF is 1/√(1+w); year-end is 1/(1+w). Horner is the same
      // after that. History is not discounted.
      const firstDf = midYear ? `SQRT${r1}` : r1;
      const fcfCell = (t: number) => `$${C(t)}$${R.fcf}`;
      const n = fcastN;
      const tv = `${fcfCell(n - 1)}*(1+${gHdr})/(${wRef}-${gHdr})`;
      let horner = `(${fcfCell(n - 1)}+${tv})`;
      for (let t = n - 2; t >= 0; t--) {
        horner = `(${fcfCell(t)}+${horner}/${r1})`;
      }
      const ev = `${horner}/${firstDf}`;
      const perShare = `(${ev}+$${SC}$${R.lessDebt}+$${SC}$${R.addCash})/$${SC}$${R.shares}`;
      const cell = r.getCell(j + 3);
      const shadow = d.sensitivity[i][j];
      if (d.shares && d.shares > 0) {
        setFormula(cell, `IFERROR(${perShare},"")`, shadow, PER_SHARE_FMT);
      } else {
        cell.value = "";
      }
      const isBase = i === 2 && j === 2;
      cell.font = {
        size: 10,
        bold: isBase,
        color: isBase ? { argb: GREEN } : undefined,
      };
    });
  });

  // --- reverse DCF: what today's price implies
  sectionRow(ws, R.revTitle, "Reverse DCF — what the price implies", totalTimeCols + 1, NAVY);
  if (d.reverse) {
    const rv = d.reverse;
    one(R.revPrice, "Current market price", null, rv.marketPrice, PER_SHARE_FMT, { input: true });
    one(R.revShares, "Diluted shares (millions)", `${SC}${R.shares}`, (d.shares ?? 0) / M, SHARES_FMT, {
      indent: true,
    });
    one(R.revMktCap, "Market capitalization", `${SC}${R.revPrice}*${SC}${R.revShares}`, rv.marketEquity / M, MONEY_FMT);
    let revNd = `-${SC}${R.lessDebt}-${SC}${R.addCash}`;
    for (let i = 0; i < extraLegs.length; i++) {
      revNd += `-${SC}${extraFirstLegRow + i}`;
    }
    one(
      R.revNetDebt,
      extraLegs.length > 0
        ? "Net debt (fuller filed bridge)"
        : "Net debt (total debt − cash)",
      revNd,
      rv.netDebt / M,
      MONEY_FMT,
      { indent: true }
    );
    one(R.revMktEV, "Market enterprise value", `${SC}${R.revMktCap}+${SC}${R.revNetDebt}`, rv.marketEV / M,
      MONEY_FMT, { bold: true });
    one(R.revBaseEV, "Base-case enterprise value (Gordon)", `${SC}${R.ev}`, d.enterpriseValue / M,
      MONEY_FMT, { indent: true });
    one(
      R.revReturn,
      `Implied expected return (Goal Seek)${rv.returnClamped ? " — bounded" : ""}`,
      null,
      rv.impliedReturn,
      PCT_FMT,
      { bold: true, color: NAVY, input: true }
    );
    {
      const A = `((${SC}${R.revMktEV}-${SC}${R.sumPv})/(${lastCol}${R.fcf}*${lastCol}${R.df}))`;
      const gFormula = `IFERROR(MAX(-0.05,MIN(${SC}${R.wacc}-0.005,(${A}*${SC}${R.wacc}-1)/(${A}+1))),"")`;
      one(
        R.revGrowth,
        `Implied perpetual growth (at base WACC, closed-form)${rv.growthClamped ? " — bounded" : ""}`,
        gFormula,
        rv.impliedGrowth,
        PCT_FMT,
        { bold: true, color: GREEN }
      );
    }
  } else {
    const c = ws.getCell(R.revTitle + 1, 1);
    c.value = "Market price unavailable — reverse DCF omitted for this filer.";
    c.font = { size: 9, italic: true, color: { argb: GREY } };
  }

  sheetNotes.forEach((t, i) => {
    const c = ws.getCell(R.notesFirst + i, 1);
    c.value = t;
    c.font = { size: 9, italic: true, color: { argb: i === sheetNotes.length - 1 ? INPUT_BLUE : GREY } };
  });

  if (extraLegs.length > 0) {
    sectionRow(
      ws,
      extraHeaderRow,
      "Fuller equity bridge — filed legs beyond book debt and cash",
      totalTimeCols + 1,
      NAVY
    );
    extraLegs.forEach((leg, i) => {
      one(
        extraFirstLegRow + i,
        leg.label,
        null,
        leg.value / M,
        MONEY_FMT,
        { indent: true }
      );
    });
  }

  // +1 for empty scalar header column under B
  sizeColumns(ws, totalTimeCols + 1, 46);
}
