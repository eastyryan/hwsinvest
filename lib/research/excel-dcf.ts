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
//    year's factor like every other flow.
//
// 3. The sensitivity grid recomputes value per share for each (WACC, growth)
//    pair from the same fixed free-cash-flow cells, so it needs no What-If data
//    table — which recalculates unreliably outside desktop Excel — and stays
//    consistent with the headline number by construction.

import type ExcelJS from "exceljs";
import type { CompanyFinancials, StatementSet } from "./edgar";
import type { Projection } from "./excel-projection";
import type { SectorBeta } from "./dcf-sector";
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
  equityValue: number;
  shares: number | null;
  perShare: number | null;
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
function evAtRate(fcf: number[], rate: number, g: number): number {
  const r = 1 + rate;
  let df = 1;
  let sum = 0;
  for (let t = 0; t < fcf.length; t++) {
    df /= r;
    sum += fcf[t] * df;
  }
  const tv = rate > g ? (fcf[fcf.length - 1] * (1 + g)) / (rate - g) : Infinity;
  return sum + tv * df;
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

/** Value per share for one (WACC, growth) pair, from fixed free-cash-flows. */
function valuePerShare(
  fcf: number[],
  wacc: number,
  growth: number,
  debt: number,
  cash: number,
  shares: number | null
): number | null {
  const r = 1 + wacc;
  let df = 1;
  let sumPv = 0;
  for (let t = 0; t < fcf.length; t++) {
    df /= r;
    sumPv += fcf[t] * df;
  }
  const spread = wacc - growth;
  if (spread <= 0) return null;
  const tv = (fcf[fcf.length - 1] * (1 + growth)) / spread;
  const ev = sumPv + tv * df; // df is now the final-year factor
  const equity = ev - debt + cash;
  return shares && shares > 0 ? equity / shares : null;
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
    ...overrides,
  };

  const costOfEquity = inputs.riskFree + inputs.beta * inputs.equityRiskPremium;
  const afterTaxCostOfDebt = inputs.preTaxCostOfDebt * (1 - inputs.taxRate);
  const weightDebt = 1 - inputs.weightEquity;
  const wacc = inputs.weightEquity * costOfEquity + weightDebt * afterTaxCostOfDebt;

  const baseNwc = base.receivables + base.inventory - base.payables;

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

  for (let t = 0; t < years; t++) {
    const e = p.ebit[t];
    const tax = e > 0 ? e * inputs.taxRate : 0;
    const nop = e - tax;
    const wc = p.receivables[t] + p.inventory[t] - p.payables[t];
    const wcPrev = t === 0 ? baseNwc : nwc[t - 1];
    const dWc = wc - wcPrev;
    const f = nop + p.da[t] - p.capex[t] - dWc;
    const df = t === 0 ? 1 / (1 + wacc) : discountFactor[t - 1] / (1 + wacc);
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
  const pvTerminalValue = terminalValue * finalDf;
  const enterpriseValue = sumPvFcf + pvTerminalValue;
  const debt = base.debt;
  const cash = base.cash;
  const equityValue = enterpriseValue - debt + cash;
  const shares = lastValue(fin.annual, "sharesDiluted");
  const perShare = shares && shares > 0 ? equityValue / shares : null;
  const tvShareOfEv = enterpriseValue !== 0 ? pvTerminalValue / enterpriseValue : 0;

  const ebitdaFinal = p.ebitda[years - 1];
  const exitTerminalValue = ebitdaFinal * inputs.exitMultiple;
  const exitEnterpriseValue = sumPvFcf + exitTerminalValue * finalDf;
  const exitPerShare =
    shares && shares > 0 ? (exitEnterpriseValue - debt + cash) / shares : null;

  // Sensitivity axes centred on the base case: WACC in 1% steps, growth in 0.5%.
  const waccAxis = [-0.02, -0.01, 0, 0.01, 0.02].map((d) => wacc + d);
  const growthAxis = [-0.01, -0.005, 0, 0.005, 0.01].map((d) => g + d);
  const sensitivity = waccAxis.map((w) =>
    growthAxis.map((gg) => valuePerShare(fcf, w, gg, debt, cash, shares) ?? 0)
  );

  // Reverse DCF: hold the free-cash-flow path fixed and back out what today's
  // price implies. Two readings — the discount rate that makes our cash flows
  // worth the market's enterprise value (the return being priced in), and the
  // perpetual growth that does the same at our base WACC.
  let reverse: ReverseDcf | null = null;
  if (marketPrice != null && marketPrice > 0 && shares && shares > 0) {
    const marketEquity = marketPrice * shares;
    const netDebt = debt - cash;
    const marketEV = marketEquity + netDebt;
    const ret = bisect((r) => evAtRate(fcf, r, g), g + 0.005, 0.6, marketEV, false);
    const grw = bisect((gg) => evAtRate(fcf, wacc, gg), -0.05, wacc - 0.005, marketEV, true);
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
    equityValue,
    shares,
    perShare,
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
const P_ROW = { ebit: 12, da: 11, ebitda: 10 };
const S_ROW = { capex: 7, receivables: 24, inventory: 25, payables: 26 };
const pRef = (row: number, t: number) => `'${PROJECTIONS_SHEET}'!${colLetter(t + 3)}${row}`;
const sRef = (row: number, t: number) => `'${SCHEDULES_SHEET}'!${colLetter(t + 3)}${row}`;

export function fillDcfSheet(ws: ExcelJS.Worksheet, fin: CompanyFinancials, d: Dcf) {
  const cols = d.labels; // five projected years
  sheetHeader(
    ws,
    "DCF Valuation",
    "Unlevered free cash flow discounted at WACC, with Gordon-growth and exit-multiple terminal values.",
    `${fin.currency} in millions unless noted. Blue cells are inputs; everything else is a formula. This is a calculator, not a forecast or investment advice.`,
    cols,
    NAVY,
    "Line item"
  );

  const C = (t: number) => colLetter(t + 3);
  const money = (row: number, label: string, vals: number[], opts: { bold?: boolean; indent?: boolean } = {}) => {
    const r = ws.getRow(row);
    r.getCell(1).value = (opts.indent ? "    " : "") + label;
    r.getCell(1).font = { size: 10, bold: opts.bold };
    return r;
  };
  // A single-value figure in column C.
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
    const c = r.getCell(3);
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
  // A formula across the projected-year columns.
  const across = (
    row: number,
    label: string,
    expr: (t: number) => string,
    vals: number[],
    fmt: string,
    opts: { bold?: boolean; indent?: boolean } = {}
  ) => {
    const r = money(row, label, vals, opts);
    vals.forEach((v, t) => {
      const cell = r.getCell(t + 3);
      setFormula(cell, expr(t), v, fmt);
      cell.font = { size: 10, bold: opts.bold };
    });
  };

  // --- WACC build-up
  sectionRow(ws, 6, "Cost of capital (WACC)", cols.length, NAVY);
  one(R.riskFree, "Risk-free rate", null, d.inputs.riskFree, PCT_FMT, { input: true });
  one(R.beta, d.sector ? `Beta (levered — ${d.sector} ref.)` : "Beta (levered)",
    null, d.inputs.beta, "0.00", { input: true });
  one(R.erp, "Equity risk premium", null, d.inputs.equityRiskPremium, PCT_FMT, { input: true });
  one(R.costEquity, "Cost of equity  (rf + β × ERP)",
    `C${R.riskFree}+C${R.beta}*C${R.erp}`, d.costOfEquity, PCT_FMT, { bold: true });
  one(R.preTaxKd, "Pre-tax cost of debt", null, d.inputs.preTaxCostOfDebt, PCT_FMT, { input: true });
  one(R.taxRate, "Tax rate", null, d.inputs.taxRate, PCT_FMT, { input: true });
  one(R.afterTaxKd, "After-tax cost of debt  (× (1 − tax))",
    `C${R.preTaxKd}*(1-C${R.taxRate})`, d.afterTaxCostOfDebt, PCT_FMT, { bold: true });
  one(R.weightEquity, "Weight of equity", null, d.inputs.weightEquity, PCT_FMT, { input: true });
  one(R.weightDebt, "Weight of debt  (1 − equity)",
    `1-C${R.weightEquity}`, d.weightDebt, PCT_FMT);
  one(R.wacc, "WACC",
    `C${R.weightEquity}*C${R.costEquity}+C${R.weightDebt}*C${R.afterTaxKd}`,
    d.wacc, PCT_FMT, { bold: true, color: NAVY });

  // --- unlevered free cash flow
  sectionRow(ws, 19, "Unlevered free cash flow", cols.length, NAVY);
  across(R.ebit, "EBIT (from Projections)", (t) => pRef(P_ROW.ebit, t), d.ebit.map((v) => v / M), MONEY_FMT);
  across(R.cashTax, "Less: cash taxes on EBIT",
    (t) => `-IF(${C(t)}${R.ebit}>0,${C(t)}${R.ebit}*$C$${R.taxRate},0)`,
    d.cashTax.map((v) => -v / M), MONEY_FMT, { indent: true });
  across(R.nopat, "NOPAT", (t) => `${C(t)}${R.ebit}+${C(t)}${R.cashTax}`,
    d.nopat.map((v) => v / M), MONEY_FMT, { bold: true });
  across(R.da, "Add: D&A", (t) => pRef(P_ROW.da, t), d.da.map((v) => v / M), MONEY_FMT, { indent: true });
  across(R.capex, "Less: capital expenditure", (t) => `-${sRef(S_ROW.capex, t)}`,
    d.capex.map((v) => -v / M), MONEY_FMT, { indent: true });
  across(R.nwc, "Net working capital",
    (t) => `${sRef(S_ROW.receivables, t)}+${sRef(S_ROW.inventory, t)}-${sRef(S_ROW.payables, t)}`,
    d.nwc.map((v) => v / M), MONEY_FMT, { indent: true });
  // The base-year net working capital sits under column B of this row, so the
  // first year's change has something to difference against.
  {
    const b = ws.getRow(R.nwc).getCell(2);
    b.value = d.baseNwc / M;
    b.numFmt = MONEY_FMT;
    b.font = { size: 10, color: { argb: MUTED }, italic: true };
  }
  across(R.changeNwc, "Less: increase in NWC",
    (t) => `-(${C(t)}${R.nwc}-${t === 0 ? "B" : colLetter(t + 2)}${R.nwc})`,
    d.changeNwc.map((v) => -v / M), MONEY_FMT, { indent: true });
  across(R.fcf, "Unlevered free cash flow",
    (t) => `${C(t)}${R.nopat}+${C(t)}${R.da}+${C(t)}${R.capex}+${C(t)}${R.changeNwc}`,
    d.fcf.map((v) => v / M), MONEY_FMT, { bold: true });
  across(R.df, "Discount factor @ WACC",
    (t) => (t === 0 ? `1/(1+$C$${R.wacc})` : `${colLetter(t + 2)}${R.df}/(1+$C$${R.wacc})`),
    d.discountFactor, "0.000", { indent: true });
  across(R.pv, "PV of free cash flow", (t) => `${C(t)}${R.fcf}*${C(t)}${R.df}`,
    d.pvFcf.map((v) => v / M), MONEY_FMT, { bold: true });

  // --- valuation (Gordon growth)
  sectionRow(ws, 31, "Enterprise & equity value (Gordon growth)", cols.length, NAVY);
  const lastCol = C(cols.length - 1);
  one(R.sumPv, "Sum of PV of explicit FCF",
    `SUM(C${R.pv}:${lastCol}${R.pv})`, d.sumPvFcf / M, MONEY_FMT, { bold: true });
  one(R.termGrowth, "Terminal growth rate", null, d.inputs.terminalGrowth, PCT_FMT, { input: true });
  one(R.termValue, "Terminal value  (FCFₙ × (1+g) / (WACC − g))",
    `IFERROR(${lastCol}${R.fcf}*(1+C${R.termGrowth})/(C${R.wacc}-C${R.termGrowth}),"")`,
    d.terminalValue / M, MONEY_FMT);
  one(R.pvTermValue, "PV of terminal value",
    `C${R.termValue}*${lastCol}${R.df}`, d.pvTerminalValue / M, MONEY_FMT);
  one(R.ev, "Enterprise value",
    `C${R.sumPv}+C${R.pvTermValue}`, d.enterpriseValue / M, MONEY_FMT, { bold: true, color: NAVY });
  // Debt, cash and share count are last-actual figures, so they are plain values
  // (not formulas) — the equity bridge below references them.
  one(R.lessDebt, "Less: total debt", null, -d.debt / M, MONEY_FMT, { indent: true });
  one(R.addCash, "Add: cash & equivalents", null, d.cash / M, MONEY_FMT, { indent: true });
  one(R.equity, "Equity value",
    `C${R.ev}+C${R.lessDebt}+C${R.addCash}`, d.equityValue / M, MONEY_FMT, { bold: true, color: NAVY });
  one(R.shares, "Diluted shares (millions)", null, d.shares != null ? d.shares / M : 0, SHARES_FMT, {
    indent: true,
  });
  if (d.perShare != null) {
    one(R.perShare, "Implied value per share",
      `C${R.equity}/C${R.shares}`, d.perShare, PER_SHARE_FMT, { bold: true, color: GREEN });
  } else {
    money(R.perShare, "Implied value per share", [], { bold: true });
  }
  one(R.tvPct, "Terminal value as % of enterprise value",
    `C${R.pvTermValue}/C${R.ev}`, d.tvShareOfEv, PCT_FMT, { indent: true });

  // --- exit-multiple cross-check
  sectionRow(ws, 43, "Cross-check: exit multiple", cols.length, NAVY);
  one(R.exitMult, "Exit EV / EBITDA multiple", null, d.inputs.exitMultiple, MULT_FMT, { input: true });
  one(R.exitTv, "Terminal value  (final EBITDA × multiple)",
    `'${PROJECTIONS_SHEET}'!${lastCol}${P_ROW.ebitda}*C${R.exitMult}`,
    d.exitTerminalValue / M, MONEY_FMT);
  one(R.exitEv, "Implied enterprise value (exit method)",
    `C${R.sumPv}+C${R.exitTv}*${lastCol}${R.df}`, d.exitEnterpriseValue / M, MONEY_FMT, { bold: true });
  if (d.exitPerShare != null) {
    one(R.exitPerShare, "Implied value per share (exit method)",
      `(C${R.exitEv}+C${R.lessDebt}+C${R.addCash})/C${R.shares}`, d.exitPerShare, PER_SHARE_FMT, { bold: true });
  } else {
    money(R.exitPerShare, "Implied value per share (exit method)", [], { bold: true });
  }

  // --- sensitivity grid: value per share vs WACC (rows) × growth (cols)
  const gr = ws.getRow(R.sensTitle);
  gr.getCell(1).value = "Sensitivity — implied value per share";
  gr.getCell(1).font = { size: 10, bold: true, color: { argb: NAVY } };
  // Growth header across D..H; the corner labels the WACC axis below it.
  const hdr = ws.getRow(R.sensGrowthHeader);
  hdr.getCell(3).value = "WACC ↓ / g →";
  hdr.getCell(3).font = { size: 9, italic: true, color: { argb: GREY } };
  d.growthAxis.forEach((g_, j) => {
    const c = hdr.getCell(j + 4);
    c.value = g_;
    c.numFmt = PCT_FMT;
    c.font = { size: 10, bold: true, color: { argb: NAVY } };
    c.alignment = { horizontal: "right" };
  });
  d.waccAxis.forEach((w, i) => {
    const rr = R.sensFirst + i;
    const r = ws.getRow(rr);
    const waccCell = r.getCell(3);
    waccCell.value = w;
    waccCell.numFmt = PCT_FMT;
    waccCell.font = { size: 10, bold: true, color: { argb: NAVY } };
    d.growthAxis.forEach((_g, j) => {
      const col = colLetter(j + 4);
      const gHdr = `${col}$${R.sensGrowthHeader}`;
      const wRef = `$C${rr}`;
      const r1 = `(1+${wRef})`;
      // Horner over the fixed FCF cells C..G on row R.fcf: discount at this row's
      // WACC and add the Gordon terminal value at this column's growth, then run
      // the equity bridge and divide by shares. Only + − × ÷ — no powers.
      const fcfCell = (t: number) => `$${colLetter(t + 3)}$${R.fcf}`;
      const n = cols.length;
      const tv = `${fcfCell(n - 1)}*(1+${gHdr})/(${wRef}-${gHdr})`;
      let horner = `(${fcfCell(n - 1)}+${tv})`;
      for (let t = n - 2; t >= 0; t--) {
        horner = `(${fcfCell(t)}+${horner}/${r1})`;
      }
      const ev = `${horner}/${r1}`;
      const perShare = `(${ev}+$C$${R.lessDebt}+$C$${R.addCash})/$C$${R.shares}`;
      const cell = r.getCell(j + 4);
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
  sectionRow(ws, R.revTitle, "Reverse DCF — what the price implies", cols.length, NAVY);
  if (d.reverse) {
    const rv = d.reverse;
    one(R.revPrice, "Current market price", null, rv.marketPrice, PER_SHARE_FMT, { input: true });
    one(R.revShares, "Diluted shares (millions)", `C${R.shares}`, (d.shares ?? 0) / M, SHARES_FMT, {
      indent: true,
    });
    one(R.revMktCap, "Market capitalization", `C${R.revPrice}*C${R.revShares}`, rv.marketEquity / M, MONEY_FMT);
    one(R.revNetDebt, "Net debt (total debt − cash)", `-C${R.lessDebt}-C${R.addCash}`, rv.netDebt / M,
      MONEY_FMT, { indent: true });
    one(R.revMktEV, "Market enterprise value", `C${R.revMktCap}+C${R.revNetDebt}`, rv.marketEV / M,
      MONEY_FMT, { bold: true });
    one(R.revBaseEV, "Base-case enterprise value (Gordon)", `C${R.ev}`, d.enterpriseValue / M,
      MONEY_FMT, { indent: true });
    // Solved constants, not formulas: they need iteration Excel won't do on open.
    one(R.revReturn, `Implied expected return (priced in)${rv.returnClamped ? " — bounded" : ""}`,
      null, rv.impliedReturn, PCT_FMT, { bold: true, color: NAVY });
    one(R.revGrowth, `Implied perpetual growth (at base WACC)${rv.growthClamped ? " — bounded" : ""}`,
      null, rv.impliedGrowth, PCT_FMT, { bold: true });
  } else {
    const c = ws.getCell(R.revTitle + 1, 1);
    c.value = "Market price unavailable — reverse DCF omitted for this filer.";
    c.font = { size: 9, italic: true, color: { argb: GREY } };
  }

  const notes = [
    "Free cash flow is unlevered: EBIT after cash tax, plus D&A, less capex and the increase in net working",
    "capital. Stock-based compensation stays inside EBIT as a real cost rather than being added back.",
    "Terminal value uses Gordon growth as the headline and the exit multiple as a cross-check; the two rarely",
    "agree exactly, and a wide gap is a signal to revisit the assumptions rather than an error.",
    "Equity value is enterprise value less total debt plus cash. Non-operating assets such as long-term",
    "investments are not added back — fold them in yourself if your definition of value includes them.",
    "Reverse DCF holds the cash-flow path fixed and backs out what the price implies: the discount rate that makes",
    "those flows worth the market's enterprise value (the return priced in), and the perpetual growth that does the",
    "same at the base WACC. Editing the price updates the bridge; re-solve the implied figures with Goal Seek.",
    "This is a calculator that reflects the inputs above. It is not a forecast, a price target, or investment advice.",
  ];
  notes.forEach((t, i) => {
    const c = ws.getCell(R.notesFirst + i, 1);
    c.value = t;
    c.font = { size: 9, italic: true, color: { argb: i === notes.length - 1 ? INPUT_BLUE : GREY } };
  });

  sizeColumns(ws, cols.length, 46);
}
