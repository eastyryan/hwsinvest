/**
 * Precedent-transaction sheet.
 *
 * If no actionable (non-illustrative) deals: title + SANDBOX banner + empty
 * table + “templates are not a deal database”.
 *
 * Otherwise each deal EV / sales / EBITDA is a blue input; implied multiples
 * are formulas; median / p25 / p75 are Excel MEDIAN and PERCENTILE.INC;
 * implied subject values are formulas. Banner if any row is illustrative.
 *
 * Layout:
 *   1–4   sheetHeader
 *   5     banner (sandbox / mixed)
 *   6     subject inputs (revenue, EBITDA, net debt, shares, premium)
 *   8     deal table header
 *   9…    actionable deals
 *   +2    median / p25 / p75
 *   +     implied subject
 *   +     illustrative deals (reference only, excluded from stats)
 */

import type ExcelJS from "exceljs";
import {
  dealMultiples,
  precedentsAreActionable,
  type ImpliedMethod,
  type PrecedentDeal,
  type PrecedentsResult,
} from "@/lib/research/valuation/precedents";
import { median as statsMedian, percentile } from "@/lib/research/valuation/stats";
import {
  setFormula,
  setInput,
  sheetHeader,
  sizeColumns,
  sectionRow,
  safeDiv,
  NAVY,
  GREY,
  AMBER,
  LIGHT_BAND,
  MONEY_FMT,
  PER_SHARE_FMT,
  SHARES_FMT,
  MULT_FMT,
  PCT_FMT,
} from "@/lib/research/excel-format";

const M = 1e6;

export const PRECEDENTS_SHEET_NAME = "Precedents";

export const PRECEDENTS_COL = {
  target: 1,
  acquirer: 2,
  year: 3,
  ev: 4,
  sales: 5,
  ebitda: 6,
  evSales: 7,
  evEbitda: 8,
} as const;

export type PrecedentsSheetResult = PrecedentsResult & {
  subjectRevenue?: number | null;
  subjectEbitda?: number | null;
  subjectNetDebt?: number | null;
  subjectShares?: number | null;
  controlPremiumUplift?: number | null;
};

export type PrecedentsSheetLayout = {
  firstDealRow: number;
  lastDealRow: number;
  medianRow: number | null;
  p25Row: number | null;
  p75Row: number | null;
  subjectRevenueRow: number;
  subjectEbitdaRow: number;
  subjectNetDebtRow: number;
  subjectSharesRow: number;
  premiumRow: number;
  impliedStartRow: number | null;
  sandbox: boolean;
};

function finite(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

function mm(n: number | null | undefined): number {
  return finite(n) ? n / M : 0;
}

function recoverMetric(method: ImpliedMethod | undefined, premium: number): number | null {
  if (!method) return null;
  if (finite(method.enterpriseValue) && finite(method.multiple) && method.multiple !== 0) {
    const factor = 1 + premium;
    return factor !== 0 ? method.enterpriseValue / method.multiple / factor : null;
  }
  return null;
}

function recoverNetDebt(result: PrecedentsResult): number | null {
  for (const m of [result.implied.evSales, result.implied.evEbitda]) {
    if (finite(m.enterpriseValue) && finite(m.equityValue)) {
      return m.enterpriseValue - m.equityValue;
    }
  }
  return null;
}

function recoverShares(result: PrecedentsResult): number | null {
  for (const m of [result.implied.evSales, result.implied.evEbitda]) {
    if (finite(m.equityValue) && finite(m.perShare) && m.perShare !== 0) {
      return m.equityValue / m.perShare;
    }
  }
  return null;
}

function writeBanner(ws: ExcelJS.Worksheet, row: number, text: string, span: number) {
  ws.mergeCells(row, 1, row, span);
  const c = ws.getCell(row, 1);
  c.value = text;
  c.font = { bold: true, size: 10, color: { argb: "FFFFFFFF" } };
  c.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: AMBER },
  };
}

function dealLevels(d: PrecedentDeal): {
  ev: number;
  sales: number;
  ebitda: number;
  evSales: number | null;
  evEbitda: number | null;
} {
  const m = dealMultiples(d);
  let ev = finite(d.enterpriseValue) ? d.enterpriseValue : null;
  let sales = finite(d.revenue) ? d.revenue : null;
  let ebitda = finite(d.ebitda) ? d.ebitda : null;
  if (ev == null && finite(m.evSales) && sales != null) ev = m.evSales * sales;
  if (sales == null && finite(m.evSales) && ev != null && m.evSales !== 0) {
    sales = ev / m.evSales;
  }
  if (ev == null && finite(m.evEbitda) && ebitda != null) ev = m.evEbitda * ebitda;
  if (ebitda == null && finite(m.evEbitda) && ev != null && m.evEbitda !== 0) {
    ebitda = ev / m.evEbitda;
  }
  return {
    ev: ev != null ? ev / M : 0,
    sales: sales != null ? sales / M : 0,
    ebitda: ebitda != null ? ebitda / M : 0,
    evSales: m.evSales,
    evEbitda: m.evEbitda,
  };
}

function writeDealRow(ws: ExcelJS.Worksheet, row: number, d: PrecedentDeal) {
  const lv = dealLevels(d);
  ws.getCell(row, 1).value = d.target;
  ws.getCell(row, 1).font = { size: 10 };
  ws.getCell(row, 2).value = d.acquirer ?? "";
  ws.getCell(row, 2).font = { size: 10 };
  if (finite(d.year)) {
    ws.getCell(row, 3).value = d.year;
    ws.getCell(row, 3).numFmt = "0";
  }
  setInput(ws.getCell(row, 4), lv.ev, MONEY_FMT);
  setInput(ws.getCell(row, 5), lv.sales, MONEY_FMT);
  setInput(ws.getCell(row, 6), lv.ebitda, MONEY_FMT);
  setFormula(ws.getCell(row, 7), safeDiv(`D${row}`, `E${row}`), lv.evSales, MULT_FMT);
  setFormula(ws.getCell(row, 8), safeDiv(`D${row}`, `F${row}`), lv.evEbitda, MULT_FMT);
}

export function fillPrecedentsSheet(
  ws: ExcelJS.Worksheet,
  result: PrecedentsSheetResult,
  deals: PrecedentDeal[]
): PrecedentsSheetLayout {
  const actionable = deals.filter((d) => d.illustrative !== true);
  const illustrative = deals.filter((d) => d.illustrative === true);
  const sandbox = !precedentsAreActionable(deals);

  sheetHeader(
    ws,
    "Precedent transactions",
    sandbox
      ? "Sandbox — no actionable (non-illustrative) deals in this export."
      : "Deal EV, sales and EBITDA are inputs; multiples and implied subject value are formulas.",
    "USD in millions unless noted. Blue = editable inputs; black = formulas. Filing-backed subject metrics when supplied; deal marks are only as good as the set you paste.",
    [
      "Acquirer",
      "Year",
      "EV",
      "Sales",
      "EBITDA",
      "EV/Sales",
      "EV/EBITDA",
    ],
    NAVY,
    "Target"
  );

  const subjectRevenueRow = 7;
  const subjectEbitdaRow = 8;
  const subjectNetDebtRow = 9;
  const subjectSharesRow = 10;
  const premiumRow = 11;

  const premium = finite(result.controlPremiumUplift)
    ? result.controlPremiumUplift
    : 0;
  const subjectRevenue =
    result.subjectRevenue ?? recoverMetric(result.implied.evSales, premium);
  const subjectEbitda =
    result.subjectEbitda ?? recoverMetric(result.implied.evEbitda, premium);
  const subjectNetDebt = result.subjectNetDebt ?? recoverNetDebt(result);
  const subjectShares = result.subjectShares ?? recoverShares(result);

  writeBanner(
    ws,
    5,
    sandbox
      ? "SANDBOX  —  templates are not a deal database. Load / paste real transactions before using implied prices."
      : illustrative.length > 0
        ? `Mixed set — ${illustrative.length} illustrative template(s) excluded from medians. Replace templates before relying on PTA.`
        : "Actionable deal set — still not a CapIQ universe. Review each mark.",
    8
  );

  sectionRow(ws, 6, "Subject company (inputs)", 7, NAVY);
  ws.getCell(subjectRevenueRow, 1).value = "Subject revenue";
  ws.getCell(subjectRevenueRow, 1).font = { size: 10 };
  setInput(ws.getCell(subjectRevenueRow, 2), mm(subjectRevenue), MONEY_FMT);
  ws.getCell(subjectEbitdaRow, 1).value = "Subject EBITDA";
  ws.getCell(subjectEbitdaRow, 1).font = { size: 10 };
  setInput(ws.getCell(subjectEbitdaRow, 2), mm(subjectEbitda), MONEY_FMT);
  ws.getCell(subjectNetDebtRow, 1).value = "Subject net debt";
  ws.getCell(subjectNetDebtRow, 1).font = { size: 10 };
  setInput(ws.getCell(subjectNetDebtRow, 2), mm(subjectNetDebt), MONEY_FMT);
  ws.getCell(subjectSharesRow, 1).value = "Subject shares (millions)";
  ws.getCell(subjectSharesRow, 1).font = { size: 10 };
  setInput(ws.getCell(subjectSharesRow, 2), mm(subjectShares), SHARES_FMT);
  ws.getCell(premiumRow, 1).value = "Control premium uplift";
  ws.getCell(premiumRow, 1).font = { size: 10 };
  setInput(ws.getCell(premiumRow, 2), premium, PCT_FMT);

  const revRef = `B${subjectRevenueRow}`;
  const ebitdaRef = `B${subjectEbitdaRow}`;
  const ndRef = `B${subjectNetDebtRow}`;
  const shRef = `B${subjectSharesRow}`;
  const premRef = `B${premiumRow}`;

  const dealHeaderRow = 13;
  const firstDealRow = 14;
  const dealHeaders = ["Target", "Acquirer", "Year", "EV", "Sales", "EBITDA", "EV/Sales", "EV/EBITDA"];
  dealHeaders.forEach((h, i) => {
    const c = ws.getCell(dealHeaderRow, i + 1);
    c.value = h;
    c.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
  });

  if (sandbox) {
    // Empty table: one reserved row so MEDIAN has a range (not self-referential).
    const emptyRow = firstDealRow;
    ws.getCell(emptyRow, 1).value = "—";
    ws.getCell(emptyRow, 1).font = { italic: true, size: 10, color: { argb: GREY } };
    setInput(ws.getCell(emptyRow, 4), 0, MONEY_FMT);
    setInput(ws.getCell(emptyRow, 5), 0, MONEY_FMT);
    setInput(ws.getCell(emptyRow, 6), 0, MONEY_FMT);
    setFormula(ws.getCell(emptyRow, 7), safeDiv(`D${emptyRow}`, `E${emptyRow}`), null, MULT_FMT);
    setFormula(ws.getCell(emptyRow, 8), safeDiv(`D${emptyRow}`, `F${emptyRow}`), null, MULT_FMT);

    const medianRow = emptyRow + 2;
    ws.getCell(medianRow, 1).value = "Median";
    ws.getCell(medianRow, 1).font = { size: 10, bold: true };
    setFormula(
      ws.getCell(medianRow, 7),
      `IFERROR(MEDIAN(G${emptyRow}:G${emptyRow}),"")`,
      null,
      MULT_FMT
    );

    let noteRow = medianRow + 2;
    ws.getCell(noteRow, 1).value = "templates are not a deal database";
    ws.getCell(noteRow, 1).font = { italic: true, size: 10, color: { argb: AMBER } };
    noteRow += 1;
    for (const n of result.notes) {
      ws.mergeCells(noteRow, 1, noteRow, 8);
      ws.getCell(noteRow, 1).value = n;
      ws.getCell(noteRow, 1).font = { italic: true, size: 9, color: { argb: GREY } };
      noteRow += 1;
    }

    sizeColumns(ws, 7, 32, 13);
    return {
      firstDealRow,
      lastDealRow: emptyRow,
      medianRow,
      p25Row: null,
      p75Row: null,
      subjectRevenueRow,
      subjectEbitdaRow,
      subjectNetDebtRow,
      subjectSharesRow,
      premiumRow,
      impliedStartRow: null,
      sandbox: true,
    };
  }

  actionable.forEach((d, i) => writeDealRow(ws, firstDealRow + i, d));
  const lastDealRow = firstDealRow + actionable.length - 1;

  const evSalesVals = actionable.map((d) => dealMultiples(d).evSales).filter(finite);
  const evEbitdaVals = actionable.map((d) => dealMultiples(d).evEbitda).filter(finite);

  const medianRow = lastDealRow + 2;
  const p25Row = medianRow + 1;
  const p75Row = medianRow + 2;

  const rangeSales = `G${firstDealRow}:G${lastDealRow}`;
  const rangeEbitda = `H${firstDealRow}:H${lastDealRow}`;

  ws.getCell(medianRow, 1).value = "Median";
  ws.getCell(medianRow, 1).font = { size: 10, bold: true };
  setFormula(
    ws.getCell(medianRow, 7),
    `IFERROR(MEDIAN(${rangeSales}),"")`,
    statsMedian(evSalesVals),
    MULT_FMT
  );
  setFormula(
    ws.getCell(medianRow, 8),
    `IFERROR(MEDIAN(${rangeEbitda}),"")`,
    statsMedian(evEbitdaVals),
    MULT_FMT
  );
  ws.getCell(p25Row, 1).value = "25th percentile";
  setFormula(
    ws.getCell(p25Row, 7),
    `IFERROR(PERCENTILE.INC(${rangeSales},0.25),"")`,
    percentile(evSalesVals, 25),
    MULT_FMT
  );
  setFormula(
    ws.getCell(p25Row, 8),
    `IFERROR(PERCENTILE.INC(${rangeEbitda},0.25),"")`,
    percentile(evEbitdaVals, 25),
    MULT_FMT
  );
  ws.getCell(p75Row, 1).value = "75th percentile";
  setFormula(
    ws.getCell(p75Row, 7),
    `IFERROR(PERCENTILE.INC(${rangeSales},0.75),"")`,
    percentile(evSalesVals, 75),
    MULT_FMT
  );
  setFormula(
    ws.getCell(p75Row, 8),
    `IFERROR(PERCENTILE.INC(${rangeEbitda},0.75),"")`,
    percentile(evEbitdaVals, 75),
    MULT_FMT
  );

  const impliedStart = p75Row + 2;
  sectionRow(ws, impliedStart, "Implied subject value", 7, NAVY);
  const ih = impliedStart + 1;
  ["Method", "Multiple", "Implied EV", "Implied equity", "Per share"].forEach((h, i) => {
    const c = ws.getCell(ih, i + 1);
    c.value = h;
    c.font = { bold: true, size: 9, color: { argb: GREY } };
  });

  const writeImplied = (
    row: number,
    label: string,
    multRef: string,
    metricRef: string,
    implied: ImpliedMethod
  ) => {
    ws.getCell(row, 1).value = label;
    ws.getCell(row, 1).font = { size: 10 };
    setFormula(ws.getCell(row, 2), multRef, implied.multiple, MULT_FMT);
    const evExpr = `${multRef}*${metricRef}*(1+${premRef})`;
    const evCached =
      finite(implied.enterpriseValue) ? implied.enterpriseValue / M : null;
    setFormula(ws.getCell(row, 3), evExpr, evCached, MONEY_FMT);
    setFormula(
      ws.getCell(row, 4),
      `C${row}-${ndRef}`,
      finite(implied.equityValue) ? implied.equityValue / M : null,
      MONEY_FMT
    );
    setFormula(
      ws.getCell(row, 5),
      safeDiv(`D${row}`, shRef),
      implied.perShare,
      PER_SHARE_FMT
    );
  };

  writeImplied(
    ih + 1,
    "EV / Sales (median)",
    `G${medianRow}`,
    revRef,
    result.implied.evSales
  );
  writeImplied(
    ih + 2,
    "EV / EBITDA (median)",
    `H${medianRow}`,
    ebitdaRef,
    result.implied.evEbitda
  );

  let next = ih + 4;
  if (illustrative.length > 0) {
    sectionRow(
      ws,
      next,
      "Illustrative templates (excluded from stats — not a deal database)",
      7,
      AMBER
    );
    next += 1;
    illustrative.forEach((d, i) => {
      writeDealRow(ws, next + i, d);
      for (let col = 1; col <= 8; col++) {
        ws.getCell(next + i, col).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: LIGHT_BAND },
        };
      }
    });
    next += illustrative.length + 1;
  }

  ws.getCell(next, 1).value = "Notes";
  ws.getCell(next, 1).font = { bold: true, size: 10, color: { argb: NAVY } };
  next += 1;
  for (const n of result.notes) {
    ws.mergeCells(next, 1, next, 8);
    ws.getCell(next, 1).value = n;
    ws.getCell(next, 1).font = { italic: true, size: 9, color: { argb: GREY } };
    next += 1;
  }

  sizeColumns(ws, 7, 32, 13);
  return {
    firstDealRow,
    lastDealRow,
    medianRow,
    p25Row,
    p75Row,
    subjectRevenueRow,
    subjectEbitdaRow,
    subjectNetDebtRow,
    subjectSharesRow,
    premiumRow,
    impliedStartRow: impliedStart,
    sandbox: false,
  };
}
