/**
 * 52-week trading-range sheet.
 *
 *   7   52-week low          input
 *   8   52-week high         input
 *   9   last price           input
 *  10   mid-range            = AVERAGE(low, high)
 *  11   position in range    = IF high=low THEN 0.5 ELSE (price−low)/(high−low)
 *  12   % from high
 *  13   % from low
 *
 * Shares + net debt (when recoverable) are blue inputs; implied equity / EV
 * and multiples at the range extremes are formulas.
 */

import type ExcelJS from "exceljs";
import type { TradingRangeResult } from "@/lib/research/valuation/trading-range";
import {
  setFormula,
  setInput,
  sheetHeader,
  sizeColumns,
  sectionRow,
  safeDiv,
  NAVY,
  GREY,
  MONEY_FMT,
  PER_SHARE_FMT,
  SHARES_FMT,
  MULT_FMT,
  PCT_FMT,
} from "@/lib/research/excel-format";

const M = 1e6;
const SC = "B";

export const TRADING_RANGE_SHEET_NAME = "52-Week Range";

export const TRADING_RANGE_ROWS = {
  low: 7,
  high: 8,
  last: 9,
  mid: 10,
  position: 11,
  pctFromHigh: 12,
  pctFromLow: 13,
  windowDays: 14,
  shares: 17,
  netDebt: 18,
  netIncome: 19,
  ebitda: 20,
  revenue: 21,
  levelHeader: 24,
  priceLevel: 25,
  equityLevel: 26,
  evLevel: 27,
  peLevel: 28,
  evEbitdaLevel: 29,
  evSalesLevel: 30,
} as const;

export type TradingRangeSheetLayout = {
  rows: typeof TRADING_RANGE_ROWS;
  valueCol: "B";
  /** C = mid, D = high, E = current on the levels grid */
  levelCols: { low: "B"; mid: "C"; high: "D"; current: "E" };
};

function finite(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

function mm(n: number | null | undefined): number {
  return finite(n) ? n / M : 0;
}

function recoverShares(r: TradingRangeResult): number | null {
  if (finite(r.equityAtCurrent) && finite(r.current) && r.current !== 0) {
    return r.equityAtCurrent / r.current;
  }
  if (finite(r.equityAtHigh) && finite(r.high52) && r.high52 !== 0) {
    return r.equityAtHigh / r.high52;
  }
  if (finite(r.equityAtLow) && finite(r.low52) && r.low52 !== 0) {
    return r.equityAtLow / r.low52;
  }
  return null;
}

function recoverNetDebt(r: TradingRangeResult): number | null {
  if (finite(r.evAtHigh) && finite(r.equityAtHigh)) return r.evAtHigh - r.equityAtHigh;
  if (finite(r.evAtLow) && finite(r.equityAtLow)) return r.evAtLow - r.equityAtLow;
  return null;
}

function recoverFromMultiple(
  numerator: number | null,
  multiple: number | null
): number | null {
  if (finite(numerator) && finite(multiple) && multiple !== 0) {
    return numerator / multiple;
  }
  return null;
}

export function fillTradingRangeSheet(
  ws: ExcelJS.Worksheet,
  result: TradingRangeResult
): TradingRangeSheetLayout {
  const R = TRADING_RANGE_ROWS;

  sheetHeader(
    ws,
    "52-week trading range",
    "Market price band over the last ~365 days, mapped to equity / EV when shares and net debt are known.",
    "USD in millions unless noted. Blue = editable inputs (market prices; filing-backed shares / net debt when recoverable). Black = formulas. Not a valuation method on its own — context for the football field.",
    ["Value"],
    NAVY,
    "Line item"
  );

  const low = finite(result.low52) ? result.low52 : 0;
  const high = finite(result.high52) ? result.high52 : 0;
  const last = finite(result.current) ? result.current : 0;
  const mid = (low + high) / 2;
  const span = high - low;
  const position =
    span > 0 ? (last - low) / span : high === low && (low !== 0 || last !== 0) ? 0.5 : null;
  const pctFromHigh = high !== 0 ? (last - high) / high : null;
  const pctFromLow = low !== 0 ? (last - low) / low : null;

  const shares = recoverShares(result);
  const netDebt = recoverNetDebt(result);
  const ebitda = recoverFromMultiple(result.evAtHigh, result.multiplesAtHigh.evEbitda);
  const revenue = recoverFromMultiple(result.evAtHigh, result.multiplesAtHigh.evSales);
  const netIncome = recoverFromMultiple(result.equityAtHigh, result.multiplesAtHigh.pe);

  const sharesMm = mm(shares);
  const netDebtMm = mm(netDebt);
  const niMm = mm(netIncome);
  const ebitdaMm = mm(ebitda);
  const revMm = mm(revenue);

  sectionRow(ws, 6, "Market prices", 4, NAVY);
  const label = (row: number, text: string, bold = false) => {
    ws.getCell(row, 1).value = text;
    ws.getCell(row, 1).font = { size: 10, bold };
  };

  label(R.low, "52-week low");
  setInput(ws.getCell(R.low, 2), low, PER_SHARE_FMT);
  label(R.high, "52-week high");
  setInput(ws.getCell(R.high, 2), high, PER_SHARE_FMT);
  label(R.last, "Last price");
  setInput(ws.getCell(R.last, 2), last, PER_SHARE_FMT);

  label(R.mid, "Mid-range");
  setFormula(
    ws.getCell(R.mid, 2),
    `AVERAGE(${SC}${R.low},${SC}${R.high})`,
    mid,
    PER_SHARE_FMT
  );
  label(R.position, "Position in range");
  setFormula(
    ws.getCell(R.position, 2),
    `IF(${SC}${R.high}=${SC}${R.low},0.5,${safeDiv(
      `(${SC}${R.last}-${SC}${R.low})`,
      `(${SC}${R.high}-${SC}${R.low})`
    )})`,
    position,
    PCT_FMT
  );
  label(R.pctFromHigh, "% from 52-week high");
  setFormula(
    ws.getCell(R.pctFromHigh, 2),
    safeDiv(`(${SC}${R.last}-${SC}${R.high})`, `${SC}${R.high}`),
    pctFromHigh,
    PCT_FMT
  );
  label(R.pctFromLow, "% from 52-week low");
  setFormula(
    ws.getCell(R.pctFromLow, 2),
    safeDiv(`(${SC}${R.last}-${SC}${R.low})`, `${SC}${R.low}`),
    pctFromLow,
    PCT_FMT
  );
  label(R.windowDays, "Window (days)");
  ws.getCell(R.windowDays, 2).value = result.windowDays;
  ws.getCell(R.windowDays, 2).numFmt = "0";
  ws.getCell(R.windowDays, 2).font = { size: 10 };

  sectionRow(ws, 16, "Capital (filing-backed when recoverable)", 4, NAVY);
  label(R.shares, "Diluted shares (millions)");
  setInput(ws.getCell(R.shares, 2), sharesMm, SHARES_FMT);
  label(R.netDebt, "Net debt");
  setInput(ws.getCell(R.netDebt, 2), netDebtMm, MONEY_FMT);
  label(R.netIncome, "Net income");
  setInput(ws.getCell(R.netIncome, 2), niMm, MONEY_FMT);
  label(R.ebitda, "EBITDA");
  setInput(ws.getCell(R.ebitda, 2), ebitdaMm, MONEY_FMT);
  label(R.revenue, "Revenue");
  setInput(ws.getCell(R.revenue, 2), revMm, MONEY_FMT);

  sectionRow(ws, 23, "Implied equity / EV at the range", 4, NAVY);
  const hdr = ws.getRow(R.levelHeader);
  ["", "At low", "At mid", "At high", "At last"].forEach((h, i) => {
    const c = hdr.getCell(i + 1);
    c.value = h;
    c.font = { bold: true, size: 9, color: { argb: GREY } };
  });

  // Price row — references the inputs / mid formula.
  label(R.priceLevel, "Price");
  setFormula(ws.getCell(R.priceLevel, 2), `${SC}${R.low}`, low, PER_SHARE_FMT);
  setFormula(ws.getCell(R.priceLevel, 3), `${SC}${R.mid}`, mid, PER_SHARE_FMT);
  setFormula(ws.getCell(R.priceLevel, 4), `${SC}${R.high}`, high, PER_SHARE_FMT);
  setFormula(ws.getCell(R.priceLevel, 5), `${SC}${R.last}`, last, PER_SHARE_FMT);

  const sh = `${SC}${R.shares}`;
  const nd = `${SC}${R.netDebt}`;
  const ni = `${SC}${R.netIncome}`;
  const ebitdaRef = `${SC}${R.ebitda}`;
  const rev = `${SC}${R.revenue}`;

  const equityCached = (price: number) => price * sharesMm;
  const evCached = (price: number) => equityCached(price) + netDebtMm;

  label(R.equityLevel, "Equity value");
  for (let col = 2; col <= 5; col++) {
    const priceCell = `${String.fromCharCode(64 + col)}${R.priceLevel}`;
    const px = col === 2 ? low : col === 3 ? mid : col === 4 ? high : last;
    setFormula(
      ws.getCell(R.equityLevel, col),
      `${priceCell}*${sh}`,
      equityCached(px),
      MONEY_FMT
    );
  }

  label(R.evLevel, "Enterprise value");
  for (let col = 2; col <= 5; col++) {
    const eqCell = `${String.fromCharCode(64 + col)}${R.equityLevel}`;
    const px = col === 2 ? low : col === 3 ? mid : col === 4 ? high : last;
    setFormula(ws.getCell(R.evLevel, col), `${eqCell}+${nd}`, evCached(px), MONEY_FMT);
  }

  label(R.peLevel, "P/E");
  for (let col = 2; col <= 5; col++) {
    const eqCell = `${String.fromCharCode(64 + col)}${R.equityLevel}`;
    const px = col === 2 ? low : col === 3 ? mid : col === 4 ? high : last;
    const pe = niMm !== 0 ? equityCached(px) / niMm : null;
    setFormula(ws.getCell(R.peLevel, col), safeDiv(eqCell, ni), pe, MULT_FMT);
  }

  label(R.evEbitdaLevel, "EV / EBITDA");
  for (let col = 2; col <= 5; col++) {
    const evCell = `${String.fromCharCode(64 + col)}${R.evLevel}`;
    const px = col === 2 ? low : col === 3 ? mid : col === 4 ? high : last;
    const m = ebitdaMm !== 0 ? evCached(px) / ebitdaMm : null;
    setFormula(ws.getCell(R.evEbitdaLevel, col), safeDiv(evCell, ebitdaRef), m, MULT_FMT);
  }

  label(R.evSalesLevel, "EV / Sales");
  for (let col = 2; col <= 5; col++) {
    const evCell = `${String.fromCharCode(64 + col)}${R.evLevel}`;
    const px = col === 2 ? low : col === 3 ? mid : col === 4 ? high : last;
    const m = revMm !== 0 ? evCached(px) / revMm : null;
    setFormula(ws.getCell(R.evSalesLevel, col), safeDiv(evCell, rev), m, MULT_FMT);
  }

  let noteRow = 32;
  ws.getCell(noteRow, 1).value = "Notes";
  ws.getCell(noteRow, 1).font = { bold: true, size: 10, color: { argb: NAVY } };
  noteRow += 1;
  for (const n of result.notes) {
    ws.mergeCells(noteRow, 1, noteRow, 5);
    ws.getCell(noteRow, 1).value = n;
    ws.getCell(noteRow, 1).font = { italic: true, size: 9, color: { argb: GREY } };
    noteRow += 1;
  }

  sizeColumns(ws, 4, 48, 14);
  return {
    rows: R,
    valueCol: "B",
    levelCols: { low: "B", mid: "C", high: "D", current: "E" },
  };
}
