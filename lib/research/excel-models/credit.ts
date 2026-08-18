// Formula-driven debt-capacity / credit sheet.
//
// Current leverage and coverage, then two capacity constraints: a leverage cap
// (max net debt / EBITDA) and a coverage cap (EBIT / interest). Coverage
// capacity is sized as EBIT / minCoverage / assumedRate — the principal that,
// if refinanced at the assumed rate, would print interest equal to the
// coverage floor. The binding constraint is the tighter (lower) max debt.
//
// Pass `{ ...runCreditCapacity(inputs), inputs }` (or flatten CreditInputs
// onto the result) so the blue cells match the engine.

import type ExcelJS from "exceljs";
import type { CreditInputs, CreditResult } from "@/lib/research/valuation/credit";
import {
  setFormula,
  setInput,
  sheetHeader,
  sizeColumns,
  sectionRow,
  NAVY,
  GREY,
  MONEY_FMT,
  PCT_FMT,
  MULT_FMT,
} from "@/lib/research/excel-format";

export type CreditSheetResult = CreditResult &
  Partial<CreditInputs> & {
    inputs?: CreditInputs;
  };

export const CREDIT_SHEET_NAME = "Credit";

export const CREDIT_ROW = {
  inputs: 6,
  ebitda: 7,
  ebit: 8,
  interest: 9,
  netDebt: 10,
  totalDebt: 11,
  maxLev: 12,
  minCoverage: 13,
  assumedRate: 14,
  current: 16,
  currentLev: 17,
  currentCov: 18,
  capacity: 20,
  maxDebtLev: 21,
  maxDebtCov: 22,
  headroom: 23,
  binding: 24,
  notesFirst: 26,
} as const;

function isFiniteNumber(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

function pick(...vals: (number | null | undefined)[]): number | null {
  for (const v of vals) {
    if (isFiniteNumber(v)) return v;
  }
  return null;
}

function creditInputsOf(r: CreditSheetResult): {
  ebitda: number | null;
  ebit: number | null;
  interest: number | null;
  netDebt: number | null;
  totalDebt: number | null;
  maxLeverage: number;
  minCoverage: number;
  assumedRate: number;
} {
  const i = r.inputs;
  return {
    ebitda: pick(i?.ebitda, r.ebitda),
    ebit: pick(i?.ebit, r.ebit),
    interest: pick(i?.interestExpense, r.interestExpense),
    netDebt: pick(i?.netDebt, r.netDebt),
    totalDebt: pick(i?.totalDebt, r.totalDebt),
    maxLeverage: pick(i?.maxLeverage, r.maxLeverage) ?? 3.5,
    minCoverage: pick(i?.minCoverage, r.minCoverage) ?? 3,
    assumedRate: pick(i?.assumedRate, r.assumedRate) ?? 0.06,
  };
}

export function fillCreditSheet(ws: ExcelJS.Worksheet, result: CreditSheetResult) {
  const inp = creditInputsOf(result);
  const R = CREDIT_ROW;
  const B = "B";

  sheetHeader(
    ws,
    "Debt Capacity / Credit",
    "Leverage and interest-coverage headroom under simple free covenants.",
    "$ millions. Blue = inputs; black = formulas. Coverage capacity = EBIT / min coverage / assumed rate.",
    ["Amount"],
    NAVY,
    "Line item"
  );

  const label = (row: number, text: string, opts: { bold?: boolean; indent?: boolean } = {}) => {
    const cell = ws.getRow(row).getCell(1);
    cell.value = (opts.indent ? "    " : "") + text;
    cell.font = { size: 10, bold: opts.bold };
  };

  const inputB = (row: number, text: string, value: number | null, fmt: string) => {
    label(row, text);
    if (value != null && isFiniteNumber(value)) setInput(ws.getRow(row).getCell(2), value, fmt);
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

  sectionRow(ws, R.inputs, "Inputs", 1, NAVY);
  inputB(R.ebitda, "EBITDA", inp.ebitda, MONEY_FMT);
  inputB(R.ebit, "EBIT", inp.ebit, MONEY_FMT);
  inputB(R.interest, "Interest expense", inp.interest, MONEY_FMT);
  inputB(R.netDebt, "Net debt", inp.netDebt, MONEY_FMT);
  inputB(R.totalDebt, "Total debt", inp.totalDebt, MONEY_FMT);
  inputB(R.maxLev, "Max net debt / EBITDA", inp.maxLeverage, MULT_FMT);
  inputB(R.minCoverage, "Min EBIT / interest", inp.minCoverage, MULT_FMT);
  inputB(R.assumedRate, "Assumed refinancing rate", inp.assumedRate, PCT_FMT);

  sectionRow(ws, R.current, "Current metrics", 1, NAVY);
  formulaB(
    R.currentLev,
    "Current leverage  (net debt / EBITDA)",
    `IFERROR(IF(OR(${B}${R.ebitda}="",${B}${R.ebitda}=0,${B}${R.netDebt}=""),"",${B}${R.netDebt}/${B}${R.ebitda}),"")`,
    result.currentLeverage,
    MULT_FMT,
    { bold: true }
  );
  formulaB(
    R.currentCov,
    "Current coverage  (EBIT / interest)",
    `IFERROR(IF(OR(${B}${R.ebit}="",${B}${R.interest}="",${B}${R.interest}=0),"",${B}${R.ebit}/${B}${R.interest}),"")`,
    result.currentCoverage,
    MULT_FMT,
    { bold: true }
  );

  sectionRow(ws, R.capacity, "Capacity", 1, NAVY);
  formulaB(
    R.maxDebtLev,
    "Max debt at leverage  (max lev × EBITDA)",
    `IF(OR(${B}${R.ebitda}="",${B}${R.ebitda}<=0,${B}${R.maxLev}=""),"",${B}${R.maxLev}*${B}${R.ebitda})`,
    result.maxDebtAtLeverage,
    MONEY_FMT
  );
  // Max interest = EBIT / minCoverage; max principal = maxInterest / assumedRate.
  formulaB(
    R.maxDebtCov,
    "Max debt at coverage  (EBIT / min coverage / assumed rate)",
    `IF(OR(${B}${R.ebit}="",${B}${R.ebit}<=0,${B}${R.minCoverage}="",${B}${R.minCoverage}<=0,${B}${R.assumedRate}="",${B}${R.assumedRate}<=0),"",${B}${R.ebit}/${B}${R.minCoverage}/${B}${R.assumedRate})`,
    result.maxDebtAtCoverage,
    MONEY_FMT
  );
  formulaB(
    R.headroom,
    "Leverage headroom  (max at lev − total debt)",
    `IF(OR(${B}${R.maxDebtLev}="",${B}${R.totalDebt}=""),"",${B}${R.maxDebtLev}-${B}${R.totalDebt})`,
    result.debtCapacityHeadroom,
    MONEY_FMT,
    { bold: true }
  );

  const bindFormula =
    `IF(AND(ISNUMBER(${B}${R.maxDebtLev}),ISNUMBER(${B}${R.maxDebtCov})),` +
    `IF(${B}${R.maxDebtLev}<${B}${R.maxDebtCov},"leverage",` +
    `IF(${B}${R.maxDebtCov}<${B}${R.maxDebtLev},"coverage","none")),` +
    `IF(ISNUMBER(${B}${R.maxDebtLev}),"leverage",` +
    `IF(ISNUMBER(${B}${R.maxDebtCov}),"coverage","insufficient_data")))`;

  label(R.binding, "Binding constraint", { bold: true });
  {
    const cell = ws.getRow(R.binding).getCell(2);
    cell.value = { formula: bindFormula, result: result.bindingConstraint };
    cell.font = { size: 10, bold: true, color: { argb: NAVY } };
  }

  const notes = [
    "Coverage capacity documents a refinancing identity: max interest = EBIT / minCoverage, so",
    "max principal = maxInterest / assumedRate = EBIT / minCoverage / assumedRate. It is not the",
    "current interest expense rolled forward, and it is not a rating-agency model.",
    "Headroom is the leverage cap minus current total debt (not net debt). The binding constraint is",
    "the tighter (lower) of the two max-debt figures; equal caps print \"none\".",
    "This is a calculator that reflects the inputs above. It is not a covenant notice or investment advice.",
    ...result.notes,
  ];
  notes.forEach((t, i) => {
    const cell = ws.getCell(R.notesFirst + i, 1);
    cell.value = t;
    cell.font = { size: 9, italic: true, color: { argb: GREY } };
  });

  sizeColumns(ws, 1, 58, 16);
  ws.views = [{ state: "frozen", xSplit: 1, ySplit: 4 }];
}
