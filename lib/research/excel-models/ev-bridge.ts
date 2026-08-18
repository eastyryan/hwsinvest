/**
 * EV bridge sheet — market cap → enterprise value, formula-driven.
 *
 * Layout (column B = value). Parent route can pin these row identities.
 *
 *   1–4   sheetHeader
 *   6     section: Market
 *   7     price                         input
 *   8     diluted shares (millions)     input
 *   9     marketCap                     = price × shares
 *   11    section: Capital structure
 *   12    cash                          input
 *   13    restricted cash               input
 *   14    cashForEv                     = cash − restricted
 *   15    ST investments                input (shown; not in EV unless flag)
 *   16    include ST inv (0/1)          input, default 0
 *   17    debt                          input
 *   18    leases                        input
 *   19    pension deficit               input
 *   20    netDebt                       = debt+leases+pension − cashForEv
 *                                       − includeStInv × stInvestments
 *   21    NCI                           input
 *   22    preferred                     input
 *   24    section: Enterprise value
 *   25    EV                            = marketCap + netDebt + NCI + pref
 *   27+   notes
 *
 * Cached results come from companyOperatingMetrics + buildEvBridgeFromMetrics
 * so they stay aligned with the on-page card when include-ST-inv is 0.
 */

import type ExcelJS from "exceljs";
import type { CompanyFinancials } from "@/lib/research/edgar";
import { companyOperatingMetrics } from "@/lib/research/valuation/metrics";
import { buildEvBridgeFromMetrics } from "@/lib/research/valuation/ev-bridge";
import {
  setFormula,
  setInput,
  sheetHeader,
  sizeColumns,
  sectionRow,
  NAVY,
  GREY,
  MONEY_FMT,
  PER_SHARE_FMT,
  SHARES_FMT,
} from "@/lib/research/excel-format";

const M = 1e6;
const SC = "B";

export const EV_BRIDGE_SHEET_NAME = "EV Bridge";

export const EV_BRIDGE_ROWS = {
  price: 7,
  shares: 8,
  marketCap: 9,
  cash: 12,
  restrictedCash: 13,
  cashForEv: 14,
  stInvestments: 15,
  includeStInv: 16,
  debt: 17,
  leases: 18,
  pension: 19,
  netDebt: 20,
  nci: 21,
  pref: 22,
  enterpriseValue: 25,
} as const;

export type EvBridgeSheetArgs = {
  fin: CompanyFinancials;
  price: number | null;
};

export type EvBridgeSheetLayout = {
  rows: typeof EV_BRIDGE_ROWS;
  valueCol: "B";
};

function finite(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

function mm(n: number | null | undefined): number {
  return finite(n) ? n / M : 0;
}

function label(ws: ExcelJS.Worksheet, row: number, text: string, bold = false) {
  const c = ws.getCell(row, 1);
  c.value = text;
  c.font = { size: 10, bold };
}

function input(ws: ExcelJS.Worksheet, row: number, value: number, fmt: string) {
  setInput(ws.getCell(row, 2), value, fmt);
}

function formula(
  ws: ExcelJS.Worksheet,
  row: number,
  expr: string,
  result: number | null,
  fmt: string,
  bold = false
) {
  const c = ws.getCell(row, 2);
  setFormula(c, expr, result, fmt);
  c.font = { size: 10, bold, color: bold ? { argb: NAVY } : undefined };
}

export function fillEvBridgeSheet(
  ws: ExcelJS.Worksheet,
  args: EvBridgeSheetArgs
): EvBridgeSheetLayout {
  const { fin, price } = args;
  const metrics = companyOperatingMetrics(fin);
  const bridge = buildEvBridgeFromMetrics(metrics, price);
  const R = EV_BRIDGE_ROWS;

  const currency = fin.currency || "USD";
  const ticker = fin.ticker || fin.name || "Subject";

  sheetHeader(
    ws,
    `${ticker} — Enterprise value bridge`,
    "Market capitalisation plus net debt, NCI and preferred — IB identity, filing legs when tagged.",
    `${currency} in millions unless noted. Blue = editable inputs; black = formulas. Price is market-sourced; capital-structure legs are filing-backed when tagged. Restricted cash may already sit inside reported cash. ST investments are often operating and stay out of EV unless the include flag is 1.`,
    ["Value"],
    NAVY,
    "Line item"
  );

  const priceIn = finite(price) ? price : 0;
  const sharesIn = mm(metrics.shares);
  const cashIn = mm(metrics.cash);
  const restrictedIn = mm(metrics.restrictedCash);
  const stInvIn = mm(metrics.stInvestments);
  const includeStInv = 0;
  const debtIn = mm(metrics.debt);
  const leasesIn = mm(metrics.leaseLiability);
  const pensionIn = mm(metrics.pensionDeficit);
  const nciIn = mm(metrics.minorityInterest);
  const prefIn = mm(metrics.preferredEquity);

  // Sheet identity (include-ST-inv defaults to 0, matching the engine).
  const cashForEv = cashIn - restrictedIn;
  const netDebt =
    debtIn + leasesIn + pensionIn - cashForEv - includeStInv * stInvIn;
  const marketCap = priceIn * sharesIn;
  const enterpriseValue = marketCap + netDebt + nciIn + prefIn;

  sectionRow(ws, 6, "Market", 1, NAVY);
  label(ws, R.price, "Share price");
  input(ws, R.price, priceIn, PER_SHARE_FMT);
  const shareLabel =
    metrics.sharesSource === "basic"
      ? "Basic shares (millions)"
      : metrics.sharesSource === "derived-diluted"
        ? "Diluted shares (millions, NI ÷ EPS)"
        : "Diluted shares (millions)";
  label(ws, R.shares, shareLabel);
  input(ws, R.shares, sharesIn, SHARES_FMT);
  label(ws, R.marketCap, "Market capitalisation", true);
  formula(
    ws,
    R.marketCap,
    `${SC}${R.price}*${SC}${R.shares}`,
    marketCap,
    MONEY_FMT,
    true
  );

  sectionRow(ws, 11, "Capital structure (filing)", 1, NAVY);
  label(ws, R.cash, "Cash & equivalents");
  input(ws, R.cash, cashIn, MONEY_FMT);
  label(ws, R.restrictedCash, "Restricted cash");
  input(ws, R.restrictedCash, restrictedIn, MONEY_FMT);
  label(ws, R.cashForEv, "Cash for EV  (cash − restricted)");
  formula(
    ws,
    R.cashForEv,
    `${SC}${R.cash}-${SC}${R.restrictedCash}`,
    cashForEv,
    MONEY_FMT
  );
  label(ws, R.stInvestments, "Short-term investments");
  input(ws, R.stInvestments, stInvIn, MONEY_FMT);
  label(ws, R.includeStInv, "Include ST investments in net cash (0/1)");
  input(ws, R.includeStInv, includeStInv, "0");
  label(ws, R.debt, "Total debt");
  input(ws, R.debt, debtIn, MONEY_FMT);
  label(ws, R.leases, "Lease liabilities");
  input(ws, R.leases, leasesIn, MONEY_FMT);
  label(ws, R.pension, "Pension deficit");
  input(ws, R.pension, pensionIn, MONEY_FMT);
  label(ws, R.netDebt, "Net debt", true);
  formula(
    ws,
    R.netDebt,
    `${SC}${R.debt}+${SC}${R.leases}+${SC}${R.pension}-${SC}${R.cashForEv}-${SC}${R.includeStInv}*${SC}${R.stInvestments}`,
    netDebt,
    MONEY_FMT,
    true
  );
  label(ws, R.nci, "Non-controlling interest");
  input(ws, R.nci, nciIn, MONEY_FMT);
  label(ws, R.pref, "Preferred equity");
  input(ws, R.pref, prefIn, MONEY_FMT);

  sectionRow(ws, 24, "Enterprise value", 1, NAVY);
  label(ws, R.enterpriseValue, "Enterprise value", true);
  formula(
    ws,
    R.enterpriseValue,
    `${SC}${R.marketCap}+${SC}${R.netDebt}+${SC}${R.nci}+${SC}${R.pref}`,
    enterpriseValue,
    MONEY_FMT,
    true
  );

  const notes = [
    "Net debt on this sheet includes pension deficit (and ST investments when the include flag is 1).",
    "Restricted cash may already sit inside reported cash — review before treating the carve-out as incremental.",
    "Short-term investments are often operating at financials; they are displayed and only subtracted when Include ST inv = 1.",
    ...bridge.notes,
  ];
  let noteRow = 27;
  ws.getCell(noteRow, 1).value = "Notes";
  ws.getCell(noteRow, 1).font = { bold: true, size: 10, color: { argb: NAVY } };
  noteRow += 1;
  for (const n of notes) {
    ws.getCell(noteRow, 1).value = n;
    ws.getCell(noteRow, 1).font = { italic: true, size: 9, color: { argb: GREY } };
    noteRow += 1;
  }

  sizeColumns(ws, 1, 56, 16);
  return { rows: R, valueCol: "B" };
}
