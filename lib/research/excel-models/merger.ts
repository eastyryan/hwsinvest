// Formula-driven accretion / dilution sheet.
//
// Consideration → cash vs stock split → after-tax interest on cash+fees →
// after-tax synergies → pro forma EPS vs standalone.
//
// Pass `{ ...runMerger(inputs), inputs }` so the blue cells match the engine.
// MergerResult alone is accepted; missing inputs are reverse-engineered where
// unique and left blank otherwise.

import type ExcelJS from "exceljs";
import type { MergerInputs, MergerResult } from "@/lib/research/valuation/merger";
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
  SIGNED_PCT_FMT,
  PER_SHARE_FMT,
  SHARES_FMT,
  MULT_FMT,
} from "@/lib/research/excel-format";

export type MergerSheetResult = MergerResult & {
  inputs?: MergerInputs;
};

export const MERGER_SHEET_NAME = "Merger";

export const MERGER_ROW = {
  inputs: 6,
  acquirerNi: 7,
  acquirerShares: 8,
  acquirerPrice: 9,
  targetNi: 10,
  targetShares: 11,
  offerPrice: 12,
  cashPct: 13,
  stockPct: 14,
  debtRate: 15,
  taxRate: 16,
  synergiesPretax: 17,
  fees: 18,
  considerationSec: 20,
  consideration: 21,
  cashPortion: 22,
  stockPortion: 23,
  newShares: 24,
  exchangeRatio: 25,
  pfSec: 27,
  interestAt: 28,
  synergiesAt: 29,
  pfNi: 30,
  pfShares: 31,
  standEps: 32,
  pfEps: 33,
  accretion: 34,
  notesFirst: 36,
} as const;

function isFiniteNumber(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

type MergerBlues = {
  acquirerNetIncome: number;
  acquirerShares: number;
  acquirerPricePerShare: number;
  targetNetIncome: number;
  targetShares: number;
  offerPricePerShare: number;
  cashPercent: number;
  stockPercent: number;
  newDebtInterestRate: number;
  taxRate: number;
  synergiesPretax: number;
  dealFees: number;
};

function bluesOf(result: MergerSheetResult): MergerBlues {
  const i = result.inputs;
  if (i) {
    const px =
      isFiniteNumber(i.acquirerPricePerShare) && i.acquirerPricePerShare > 0
        ? i.acquirerPricePerShare
        : result.newSharesIssued && result.newSharesIssued > 0
          ? result.stockPortion / result.newSharesIssued
          : 0;
    return {
      acquirerNetIncome: i.acquirerNetIncome,
      acquirerShares: i.acquirerShares,
      acquirerPricePerShare: px,
      targetNetIncome: i.targetNetIncome,
      targetShares: i.targetSharesOutstanding,
      offerPricePerShare: i.offerPricePerShare,
      cashPercent: i.cashPercent,
      stockPercent: i.stockPercent,
      newDebtInterestRate: i.newDebtInterestRate,
      taxRate: i.taxRate,
      synergiesPretax: i.synergiesPretax,
      dealFees: i.dealFees,
    };
  }
  const newSh = result.newSharesIssued ?? 0;
  const acqSh = result.proFormaShares - newSh;
  const acqNi = result.standaloneEps * acqSh;
  return {
    acquirerNetIncome: acqNi,
    acquirerShares: acqSh,
    acquirerPricePerShare: newSh > 0 ? result.stockPortion / newSh : 0,
    targetNetIncome:
      result.proFormaNetIncome - acqNi - result.synergiesAfterTax + result.interestExpenseAfterTax,
    targetShares: 0,
    offerPricePerShare: 0,
    cashPercent: result.consideration !== 0 ? result.cashPortion / result.consideration : 0,
    stockPercent: result.consideration !== 0 ? result.stockPortion / result.consideration : 0,
    newDebtInterestRate: 0,
    taxRate: 0,
    synergiesPretax: result.synergiesAfterTax,
    dealFees: 0,
  };
}

export function fillMergerSheet(ws: ExcelJS.Worksheet, result: MergerSheetResult) {
  const b = bluesOf(result);
  const R = MERGER_ROW;
  const B = "B";

  sheetHeader(
    ws,
    "M&A Accretion / Dilution",
    "Cash/stock consideration, debt-financed interest on cash + fees, after-tax synergies, pro forma EPS.",
    "$ millions except per-share and share counts (millions). Blue = inputs; black = formulas.",
    ["Amount"],
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
    const cached = value != null && Number.isFinite(value) ? value : null;
    setFormula(cell, formula, cached, fmt);
    cell.font = { size: 10, bold: opts.bold, color: opts.bold ? { argb: NAVY } : undefined };
  };

  sectionRow(ws, R.inputs, "Deal inputs", 1, NAVY);
  inputB(R.acquirerNi, "Acquirer net income", b.acquirerNetIncome, MONEY_FMT);
  inputB(R.acquirerShares, "Acquirer shares (millions)", b.acquirerShares, SHARES_FMT);
  inputB(R.acquirerPrice, "Acquirer price per share", b.acquirerPricePerShare, PER_SHARE_FMT);
  inputB(R.targetNi, "Target net income", b.targetNetIncome, MONEY_FMT);
  inputB(R.targetShares, "Target shares (millions)", b.targetShares, SHARES_FMT);
  inputB(R.offerPrice, "Offer price per share", b.offerPricePerShare, PER_SHARE_FMT);
  inputB(R.cashPct, "Cash % of consideration", b.cashPercent, PCT_FMT);
  inputB(R.stockPct, "Stock % of consideration", b.stockPercent, PCT_FMT);
  inputB(R.debtRate, "New debt interest rate", b.newDebtInterestRate, PCT_FMT);
  inputB(R.taxRate, "Tax rate", b.taxRate, PCT_FMT);
  inputB(R.synergiesPretax, "Pretax synergies", b.synergiesPretax, MONEY_FMT);
  inputB(R.fees, "Deal fees", b.dealFees, MONEY_FMT);

  const exchange =
    b.acquirerPricePerShare > 0 ? b.offerPricePerShare / b.acquirerPricePerShare : null;

  sectionRow(ws, R.considerationSec, "Consideration", 1, NAVY);
  formulaB(
    R.consideration,
    "Equity consideration",
    `${B}${R.offerPrice}*${B}${R.targetShares}`,
    result.consideration,
    MONEY_FMT,
    { bold: true }
  );
  formulaB(
    R.cashPortion,
    "Cash portion",
    `${B}${R.consideration}*${B}${R.cashPct}`,
    result.cashPortion,
    MONEY_FMT,
    { indent: true }
  );
  formulaB(
    R.stockPortion,
    "Stock portion",
    `${B}${R.consideration}*${B}${R.stockPct}`,
    result.stockPortion,
    MONEY_FMT,
    { indent: true }
  );
  formulaB(
    R.newShares,
    "New shares issued",
    `IFERROR(IF(${B}${R.acquirerPrice}<=0,0,${B}${R.stockPortion}/${B}${R.acquirerPrice}),0)`,
    result.newSharesIssued,
    SHARES_FMT
  );
  formulaB(
    R.exchangeRatio,
    "Exchange ratio  (offer / acquirer price)",
    `IFERROR(${B}${R.offerPrice}/${B}${R.acquirerPrice},"")`,
    exchange,
    MULT_FMT
  );

  sectionRow(ws, R.pfSec, "Pro forma EPS", 1, NAVY);
  formulaB(
    R.interestAt,
    "After-tax interest  ((cash + fees) × rate × (1 − tax))",
    `(${B}${R.cashPortion}+${B}${R.fees})*${B}${R.debtRate}*(1-${B}${R.taxRate})`,
    result.interestExpenseAfterTax,
    MONEY_FMT
  );
  formulaB(
    R.synergiesAt,
    "After-tax synergies",
    `${B}${R.synergiesPretax}*(1-${B}${R.taxRate})`,
    result.synergiesAfterTax,
    MONEY_FMT
  );
  formulaB(
    R.pfNi,
    "Pro forma net income",
    `${B}${R.acquirerNi}+${B}${R.targetNi}+${B}${R.synergiesAt}-${B}${R.interestAt}`,
    result.proFormaNetIncome,
    MONEY_FMT,
    { bold: true }
  );
  formulaB(
    R.pfShares,
    "Pro forma shares",
    `${B}${R.acquirerShares}+${B}${R.newShares}`,
    result.proFormaShares,
    SHARES_FMT
  );
  formulaB(
    R.standEps,
    "Standalone EPS",
    `IFERROR(${B}${R.acquirerNi}/${B}${R.acquirerShares},"")`,
    result.standaloneEps,
    PER_SHARE_FMT
  );
  formulaB(
    R.pfEps,
    "Pro forma EPS",
    `IFERROR(${B}${R.pfNi}/${B}${R.pfShares},"")`,
    result.proFormaEps,
    PER_SHARE_FMT,
    { bold: true }
  );
  formulaB(
    R.accretion,
    "Accretion / (dilution)",
    `IF(OR(${B}${R.standEps}="",${B}${R.standEps}=0),"",${B}${R.pfEps}/${B}${R.standEps}-1)`,
    Number.isFinite(result.accretionPct) ? result.accretionPct : null,
    SIGNED_PCT_FMT,
    { bold: true }
  );

  const notes = [
    "Cash consideration and deal fees are treated as debt-financed at the new-debt rate; the after-tax interest",
    "drag is (cash + fees) × rate × (1 − tax). Stock consideration issues acquirer shares at the acquirer price.",
    "Cash % and stock % should sum to 100%. The engine renormalizes if they do not; the sheet does not.",
    "This is a calculator that reflects the inputs above. It is not a fairness opinion or investment advice.",
    ...result.notes,
  ];
  notes.forEach((t, i) => {
    const cell = ws.getCell(R.notesFirst + i, 1);
    cell.value = t;
    cell.font = { size: 9, italic: true, color: { argb: GREY } };
  });

  sizeColumns(ws, 1, 52, 16);
  ws.views = [{ state: "frozen", xSplit: 1, ySplit: 4 }];
}
