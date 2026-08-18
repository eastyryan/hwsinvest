// Formula-driven PE LBO sheet: Sources & Uses, P&L, dual-tranche debt
// schedule, exit, MOIC / IRR.
//
// WHAT THIS IS. A transparent, assumption-driven LBO a reader can audit
// cell-by-cell. Blue cells are inputs; everything else is a formula with a
// cached result so the workbook reads correctly in Numbers / Sheets / preview
// panes and still recalculates in Excel.
//
// WHAT THIS IS NOT. No revolver, no PIK, no working-capital schedule, no
// management options. Interest is charged on *opening* debt so the schedule
// is closed-form (no Excel iteration).
//
// Units: $ millions (same scale as the rest of the workbook). The engine is
// unit-agnostic — write the numbers you want the sheet to show.

import type ExcelJS from "exceljs";
import type { LboResult, LboYear, LboInputs } from "@/lib/research/valuation/lbo";
import {
  colLetter,
  setFormula,
  setInput,
  sheetHeader,
  sizeColumns,
  sectionRow,
  INPUT_BLUE,
  NAVY,
  GREY,
  MONEY_FMT,
  PCT_FMT,
  MULT_FMT,
} from "@/lib/research/excel-format";

/** Optional DA fields another agent may add to the LBO engine. */
type LboDaInputs = { daPctEbitda?: number };
type LboDaYear = { da?: number; ebit?: number };

const DEFAULT_DA_PCT = 0.1;

export const LBO_SHEET_NAME = "LBO";

/** Fixed row map (column B = assumptions / scalars; C… = years). */
export const LBO_ROW = {
  assumptions: 6,
  entryEbitda: 7,
  entryMultiple: 8,
  leverage: 9,
  tlShare: 10,
  tlRate: 11,
  notesRate: 12,
  tlAmortPct: 13,
  ebitdaGrowth: 14,
  daPct: 15,
  taxRate: 16,
  reinvestPct: 17,
  sweepPct: 18,
  exitMultiple: 19,
  feesPct: 20,
  holdYears: 21,
  sources: 23,
  entryEv: 24,
  fees: 25,
  totalUses: 26,
  totalDebt: 27,
  termLoan: 28,
  notes: 29,
  sponsorEquity: 30,
  totalSources: 31,
  schedule: 33,
  tlBegin: 34,
  notesBegin: 35,
  debtBegin: 36,
  ebitda: 37,
  da: 38,
  ebit: 39,
  interest: 40,
  ebt: 41,
  tax: 42,
  ni: 43,
  reinvest: 44,
  fcf: 45,
  mandatory: 46,
  cashAfterMand: 47,
  sweepBudget: 48,
  tlSweep: 49,
  notesSweep: 50,
  optional: 51,
  totalPaydown: 52,
  tlEnd: 53,
  notesEnd: 54,
  debtEnd: 55,
  leverageOut: 56,
  coverage: 57,
  exit: 59,
  exitEbitda: 60,
  exitEv: 61,
  exitNetDebt: 62,
  equityOut: 63,
  equityIn: 64,
  moic: 65,
  irr: 66,
  notesFirst: 68,
} as const;

export const LBO_FIRST_YEAR_COL = 3; // C = Year 1

function isFiniteNumber(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

function readDaPct(inputs: LboResult["inputs"], years: LboYear[]): number {
  const extra = inputs as Required<LboInputs> & LboDaInputs;
  if (isFiniteNumber(extra.daPctEbitda)) return extra.daPctEbitda;
  const y1 = years[0];
  const da = y1 ? readYearDa(y1) : undefined;
  if (da != null && y1 && y1.ebitda !== 0) return da / y1.ebitda;
  return DEFAULT_DA_PCT;
}

function readYearDa(year: LboYear): number | undefined {
  const extra = year as LboYear & LboDaYear;
  return isFiniteNumber(extra.da) ? extra.da : undefined;
}

function readYearEbit(year: LboYear): number | undefined {
  const extra = year as LboYear & LboDaYear;
  return isFiniteNumber(extra.ebit) ? extra.ebit : undefined;
}

/**
 * Professional P&L + opening-balance debt schedule used to cache formula
 * results. If the engine already carries da/ebit we seed those; otherwise
 * DA = EBITDA × daPct and EBIT = EBITDA − DA. Tax is on EBIT − interest
 * (the DA tax shield); FCF = NI + DA − reinvestment.
 */
export type LboSheetYear = {
  tlBegin: number;
  notesBegin: number;
  debtBegin: number;
  ebitda: number;
  da: number;
  ebit: number;
  interest: number;
  ebt: number;
  tax: number;
  ni: number;
  reinvest: number;
  fcf: number;
  mandatory: number;
  cashAfterMand: number;
  sweepBudget: number;
  tlSweep: number;
  notesSweep: number;
  optional: number;
  totalPaydown: number;
  tlEnd: number;
  notesEnd: number;
  debtEnd: number;
  leverageOut: number;
  coverage: number | null;
};

export function professionalLboYears(result: LboResult): LboSheetYear[] {
  const inp = result.inputs;
  const daPct = readDaPct(inp, result.years);
  let tl = result.sourcesAndUses.termLoan;
  let notes = result.sourcesAndUses.notes;
  const out: LboSheetYear[] = [];

  for (const y of result.years) {
    const tlBegin = tl;
    const notesBegin = notes;
    const debtBegin = tlBegin + notesBegin;
    const ebitda = y.ebitda;
    const da = readYearDa(y) ?? ebitda * daPct;
    const ebit = readYearEbit(y) ?? ebitda - da;
    const interest = tlBegin * inp.termLoanRate + notesBegin * inp.notesRate;
    const ebt = ebit - interest;
    const tax = ebt > 0 ? ebt * inp.taxRate : 0;
    const ni = ebt - tax;
    const reinvest = ebitda * inp.reinvestmentPctEbitda;
    const fcf = ni + da - reinvest;

    let cashForDebt = Math.max(0, fcf);
    const scheduled = tlBegin * inp.termLoanAmortPct;
    const mandatory = Math.min(scheduled, tlBegin, cashForDebt);
    cashForDebt -= mandatory;
    const sweepBudget = cashForDebt * inp.cashSweepPct;
    const tlAfterMand = tlBegin - mandatory;
    const tlSweep = Math.min(sweepBudget, tlAfterMand);
    const notesSweep = Math.min(sweepBudget - tlSweep, notesBegin);
    const optional = tlSweep + notesSweep;

    tl = tlAfterMand - tlSweep;
    notes = notesBegin - notesSweep;
    if (tl < 1e-9) tl = 0;
    if (notes < 1e-9) notes = 0;

    const debtEnd = tl + notes;
    out.push({
      tlBegin,
      notesBegin,
      debtBegin,
      ebitda,
      da,
      ebit,
      interest,
      ebt,
      tax,
      ni,
      reinvest,
      fcf,
      mandatory,
      cashAfterMand: Math.max(0, fcf) - mandatory,
      sweepBudget,
      tlSweep,
      notesSweep,
      optional,
      totalPaydown: mandatory + optional,
      tlEnd: tl,
      notesEnd: notes,
      debtEnd,
      leverageOut: ebitda > 0 ? debtEnd / ebitda : 0,
      coverage: interest > 1e-12 ? ebitda / interest : null,
    });
  }
  return out;
}

export function fillLboSheet(ws: ExcelJS.Worksheet, result: LboResult) {
  const n = result.years.length;
  const inp = result.inputs;
  const su = result.sourcesAndUses;
  const daPct = readDaPct(inp, result.years);
  const years = professionalLboYears(result);
  const last = years[years.length - 1];
  const yearLabels = result.years.map((y) => `Year ${y.year}`);
  const C = (t: number) => colLetter(LBO_FIRST_YEAR_COL + t);
  const lastCol = C(n - 1);
  const B = "B";
  const R = LBO_ROW;

  sheetHeader(
    ws,
    "LBO — Sources, Uses & Returns",
    "PE-style sources & uses, opening-balance interest, mandatory TL amort and cash sweep, exit MOIC / IRR.",
    "$ millions. Blue = inputs; black = formulas. No revolver. Interest on opening debt (avoids iteration). Not a full LBO — no WC schedule.",
    ["Entry / close", ...yearLabels],
    NAVY,
    "Line item"
  );

  const label = (row: number, text: string, opts: { bold?: boolean; indent?: boolean } = {}) => {
    const cell = ws.getRow(row).getCell(1);
    cell.value = (opts.indent ? "    " : "") + text;
    cell.font = { size: 10, bold: opts.bold };
  };

  const inputB = (row: number, text: string, value: number, fmt: string) => {
    label(row, text);
    setInput(ws.getRow(row).getCell(2), value, fmt);
  };

  const formulaB = (
    row: number,
    text: string,
    formula: string,
    value: number | null,
    fmt: string,
    opts: { bold?: boolean; indent?: boolean } = {}
  ) => {
    label(row, text, opts);
    const cell = ws.getRow(row).getCell(2);
    setFormula(cell, formula, value, fmt);
    cell.font = { size: 10, bold: opts.bold, color: opts.bold ? { argb: NAVY } : undefined };
  };

  const across = (
    row: number,
    text: string,
    expr: (t: number) => string,
    vals: (number | null)[],
    fmt: string,
    opts: { bold?: boolean; indent?: boolean } = {}
  ) => {
    label(row, text, opts);
    vals.forEach((v, t) => {
      const cell = ws.getRow(row).getCell(LBO_FIRST_YEAR_COL + t);
      setFormula(cell, expr(t), v, fmt);
      cell.font = { size: 10, bold: opts.bold };
    });
  };

  // --- Assumptions (blue)
  sectionRow(ws, R.assumptions, "Assumptions", n + 1, NAVY);
  inputB(R.entryEbitda, "Entry EBITDA", inp.entryEbitda, MONEY_FMT);
  inputB(R.entryMultiple, "Entry multiple  (EV / EBITDA)", inp.entryMultiple, MULT_FMT);
  inputB(R.leverage, "Leverage  (Debt / EBITDA)", inp.leverageMultiple, MULT_FMT);
  inputB(R.tlShare, "Term loan share of debt", inp.termLoanShare, PCT_FMT);
  inputB(R.tlRate, "Term loan interest rate", inp.termLoanRate, PCT_FMT);
  inputB(R.notesRate, "Senior notes interest rate", inp.notesRate, PCT_FMT);
  inputB(R.tlAmortPct, "Term loan mandatory amort %", inp.termLoanAmortPct, PCT_FMT);
  inputB(R.ebitdaGrowth, "EBITDA growth", inp.ebitdaGrowth, PCT_FMT);
  inputB(R.daPct, "D&A % of EBITDA", daPct, PCT_FMT);
  inputB(R.taxRate, "Cash tax rate", inp.taxRate, PCT_FMT);
  inputB(R.reinvestPct, "Reinvestment % of EBITDA", inp.reinvestmentPctEbitda, PCT_FMT);
  inputB(R.sweepPct, "Cash sweep % of excess FCF", inp.cashSweepPct, PCT_FMT);
  inputB(R.exitMultiple, "Exit multiple  (EV / EBITDA)", inp.exitMultiple, MULT_FMT);
  inputB(R.feesPct, "Transaction fees % of entry EV", inp.feesPctEv, PCT_FMT);
  inputB(R.holdYears, "Hold period (years, informational)", inp.years, "0");

  // --- Sources & Uses
  sectionRow(ws, R.sources, "Sources & Uses", n + 1, NAVY);
  formulaB(R.entryEv, "Entry enterprise value", `${B}${R.entryEbitda}*${B}${R.entryMultiple}`, su.entryEv, MONEY_FMT, {
    bold: true,
  });
  formulaB(R.fees, "Transaction fees", `${B}${R.entryEv}*${B}${R.feesPct}`, su.fees, MONEY_FMT, {
    indent: true,
  });
  formulaB(R.totalUses, "Total uses", `${B}${R.entryEv}+${B}${R.fees}`, su.totalUses, MONEY_FMT, { bold: true });
  formulaB(R.totalDebt, "Total debt", `${B}${R.entryEbitda}*${B}${R.leverage}`, su.totalDebt, MONEY_FMT);
  formulaB(R.termLoan, "Term loan", `${B}${R.totalDebt}*${B}${R.tlShare}`, su.termLoan, MONEY_FMT, {
    indent: true,
  });
  formulaB(R.notes, "Senior notes", `${B}${R.totalDebt}-${B}${R.termLoan}`, su.notes, MONEY_FMT, {
    indent: true,
  });
  formulaB(
    R.sponsorEquity,
    "Sponsor equity",
    `${B}${R.totalUses}-${B}${R.totalDebt}`,
    su.sponsorEquity,
    MONEY_FMT,
    { bold: true }
  );
  formulaB(
    R.totalSources,
    "Total sources",
    `${B}${R.totalDebt}+${B}${R.sponsorEquity}`,
    su.totalSources,
    MONEY_FMT,
    { bold: true }
  );

  // --- P&L + debt schedule (years across)
  sectionRow(ws, R.schedule, "P&L and debt schedule", n + 1, NAVY);

  across(
    R.tlBegin,
    "Beginning term loan",
    (t) => (t === 0 ? `$${B}$${R.termLoan}` : `${C(t - 1)}${R.tlEnd}`),
    years.map((y) => y.tlBegin),
    MONEY_FMT
  );
  across(
    R.notesBegin,
    "Beginning senior notes",
    (t) => (t === 0 ? `$${B}$${R.notes}` : `${C(t - 1)}${R.notesEnd}`),
    years.map((y) => y.notesBegin),
    MONEY_FMT
  );
  across(
    R.debtBegin,
    "Beginning net debt",
    (t) => `${C(t)}${R.tlBegin}+${C(t)}${R.notesBegin}`,
    years.map((y) => y.debtBegin),
    MONEY_FMT,
    { bold: true }
  );
  across(
    R.ebitda,
    "EBITDA",
    (t) =>
      t === 0
        ? `$${B}$${R.entryEbitda}*(1+$${B}$${R.ebitdaGrowth})`
        : `${C(t - 1)}${R.ebitda}*(1+$${B}$${R.ebitdaGrowth})`,
    years.map((y) => y.ebitda),
    MONEY_FMT,
    { bold: true }
  );
  across(
    R.da,
    "D&A",
    (t) => `${C(t)}${R.ebitda}*$${B}$${R.daPct}`,
    years.map((y) => y.da),
    MONEY_FMT,
    { indent: true }
  );
  across(
    R.ebit,
    "EBIT",
    (t) => `${C(t)}${R.ebitda}-${C(t)}${R.da}`,
    years.map((y) => y.ebit),
    MONEY_FMT,
    { bold: true }
  );
  // Opening-balance interest — see notes. Not ending-balance (would cycle).
  across(
    R.interest,
    "Interest  (on opening debt)",
    (t) =>
      `${C(t)}${R.tlBegin}*$${B}$${R.tlRate}+${C(t)}${R.notesBegin}*$${B}$${R.notesRate}`,
    years.map((y) => y.interest),
    MONEY_FMT,
    { indent: true }
  );
  across(
    R.ebt,
    "Earnings before tax",
    (t) => `${C(t)}${R.ebit}-${C(t)}${R.interest}`,
    years.map((y) => y.ebt),
    MONEY_FMT
  );
  across(
    R.tax,
    "Cash tax  (no refund on losses)",
    (t) => `IF(${C(t)}${R.ebt}>0,${C(t)}${R.ebt}*$${B}$${R.taxRate},0)`,
    years.map((y) => y.tax),
    MONEY_FMT,
    { indent: true }
  );
  across(
    R.ni,
    "Net income",
    (t) => `${C(t)}${R.ebt}-${C(t)}${R.tax}`,
    years.map((y) => y.ni),
    MONEY_FMT,
    { bold: true }
  );
  across(
    R.reinvest,
    "Reinvestment  (capex + NWC proxy)",
    (t) => `${C(t)}${R.ebitda}*$${B}$${R.reinvestPct}`,
    years.map((y) => y.reinvest),
    MONEY_FMT,
    { indent: true }
  );
  across(
    R.fcf,
    "Free cash flow",
    (t) => `${C(t)}${R.ni}+${C(t)}${R.da}-${C(t)}${R.reinvest}`,
    years.map((y) => y.fcf),
    MONEY_FMT,
    { bold: true }
  );
  across(
    R.mandatory,
    "Mandatory TL amort",
    (t) =>
      `MIN(${C(t)}${R.tlBegin}*$${B}$${R.tlAmortPct},${C(t)}${R.tlBegin},MAX(${C(t)}${R.fcf},0))`,
    years.map((y) => y.mandatory),
    MONEY_FMT
  );
  across(
    R.cashAfterMand,
    "Cash after mandatory",
    (t) => `MAX(${C(t)}${R.fcf},0)-${C(t)}${R.mandatory}`,
    years.map((y) => y.cashAfterMand),
    MONEY_FMT,
    { indent: true }
  );
  across(
    R.sweepBudget,
    "Sweep budget",
    (t) => `${C(t)}${R.cashAfterMand}*$${B}$${R.sweepPct}`,
    years.map((y) => y.sweepBudget),
    MONEY_FMT,
    { indent: true }
  );
  across(
    R.tlSweep,
    "Term loan sweep",
    (t) => `MIN(${C(t)}${R.sweepBudget},${C(t)}${R.tlBegin}-${C(t)}${R.mandatory})`,
    years.map((y) => y.tlSweep),
    MONEY_FMT,
    { indent: true }
  );
  across(
    R.notesSweep,
    "Notes sweep",
    (t) => `MIN(${C(t)}${R.sweepBudget}-${C(t)}${R.tlSweep},${C(t)}${R.notesBegin})`,
    years.map((y) => y.notesSweep),
    MONEY_FMT,
    { indent: true }
  );
  across(
    R.optional,
    "Optional paydown",
    (t) => `${C(t)}${R.tlSweep}+${C(t)}${R.notesSweep}`,
    years.map((y) => y.optional),
    MONEY_FMT
  );
  across(
    R.totalPaydown,
    "Total paydown",
    (t) => `${C(t)}${R.mandatory}+${C(t)}${R.optional}`,
    years.map((y) => y.totalPaydown),
    MONEY_FMT,
    { bold: true }
  );
  across(
    R.tlEnd,
    "Ending term loan",
    (t) => `MAX(0,${C(t)}${R.tlBegin}-${C(t)}${R.mandatory}-${C(t)}${R.tlSweep})`,
    years.map((y) => y.tlEnd),
    MONEY_FMT
  );
  across(
    R.notesEnd,
    "Ending senior notes",
    (t) => `MAX(0,${C(t)}${R.notesBegin}-${C(t)}${R.notesSweep})`,
    years.map((y) => y.notesEnd),
    MONEY_FMT
  );
  across(
    R.debtEnd,
    "Ending net debt",
    (t) => `${C(t)}${R.tlEnd}+${C(t)}${R.notesEnd}`,
    years.map((y) => y.debtEnd),
    MONEY_FMT,
    { bold: true }
  );
  across(
    R.leverageOut,
    "Net debt / EBITDA",
    (t) => `IFERROR(${C(t)}${R.debtEnd}/${C(t)}${R.ebitda},"")`,
    years.map((y) => y.leverageOut),
    MULT_FMT
  );
  across(
    R.coverage,
    "Interest coverage  (EBITDA / interest)",
    (t) => `IF(${C(t)}${R.interest}>0,${C(t)}${R.ebitda}/${C(t)}${R.interest},"")`,
    years.map((y) => y.coverage),
    MULT_FMT
  );

  // --- Exit & returns
  sectionRow(ws, R.exit, "Exit & returns", n + 1, NAVY);
  const exitEbitda = last?.ebitda ?? 0;
  const exitEv = exitEbitda * inp.exitMultiple;
  const exitNd = last?.debtEnd ?? 0;
  const equityOut = exitEv - exitNd;
  const equityIn = su.sponsorEquity;
  const moic = equityIn > 0 ? equityOut / equityIn : null;
  const irr = equityIn > 0 && inp.years > 0 ? Math.pow(equityOut / equityIn, 1 / inp.years) - 1 : null;

  formulaB(R.exitEbitda, "Exit EBITDA", `${lastCol}${R.ebitda}`, exitEbitda, MONEY_FMT);
  formulaB(R.exitEv, "Exit enterprise value", `${B}${R.exitEbitda}*${B}${R.exitMultiple}`, exitEv, MONEY_FMT, {
    bold: true,
  });
  formulaB(R.exitNetDebt, "Ending net debt", `${lastCol}${R.debtEnd}`, exitNd, MONEY_FMT, { indent: true });
  formulaB(
    R.equityOut,
    "Equity proceeds",
    `${B}${R.exitEv}-${B}${R.exitNetDebt}`,
    equityOut,
    MONEY_FMT,
    { bold: true }
  );
  formulaB(R.equityIn, "Equity invested", `${B}${R.sponsorEquity}`, equityIn, MONEY_FMT);
  formulaB(
    R.moic,
    "MOIC",
    `IF(${B}${R.equityIn}<=0,"",${B}${R.equityOut}/${B}${R.equityIn})`,
    moic,
    MULT_FMT,
    { bold: true }
  );
  // Classic two-point IRR: only t=0 (equity in) and t=n (equity out).
  formulaB(
    R.irr,
    "IRR  ((out / in)^(1/n) − 1)",
    `IF(OR(${B}${R.equityIn}<=0,${B}${R.holdYears}<=0),"",(${B}${R.equityOut}/${B}${R.equityIn})^(1/${B}${R.holdYears})-1)`,
    irr,
    PCT_FMT,
    { bold: true }
  );

  const notes = [
    "Interest is charged on opening (beginning-of-year) term-loan and notes balances. Opening-balance interest",
    "avoids a circular reference among interest → tax → FCF → paydown → interest that would require Excel",
    "iteration and would not match this closed-form schedule.",
    "No revolver: excess cash after the sweep is not modelled as a cash balance, so net debt = gross debt.",
    "Not a full LBO — no working-capital schedule, no PIK, no management rollover or options, no minimum cash.",
    "D&A is a % of EBITDA (tax shield only; added back in FCF = NI + D&A − reinvestment).",
    "Hold period is informational: changing it updates IRR but does not add or remove year columns.",
    "This is a calculator that reflects the inputs above. It is not a bid, a commitment, or investment advice.",
    ...result.notes,
  ];
  notes.forEach((t, i) => {
    const cell = ws.getCell(R.notesFirst + i, 1);
    cell.value = t;
    cell.font = { size: 9, italic: true, color: { argb: i === notes.length - 1 ? INPUT_BLUE : GREY } };
  });

  sizeColumns(ws, n + 1, 44, 13);
  ws.views = [{ state: "frozen", xSplit: 1, ySplit: 4 }];
}
