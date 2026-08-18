/**
 * Football-field sheet — one row per valuation bar.
 *
 *   A  method
 *   B  low          input
 *   C  mid          AVERAGE(low,high) when the engine interpolated the mid
 *                   as (low+high)/2; otherwise an input
 *   D  high         input
 *   E  unit
 *   F  provenance   filing / market / model / illustrative
 *   G  note
 *
 * Current price is a blue input. Central estimate = AVERAGE of non-illustrative
 * mids (illustrative bars are labelled but not averaged). Implied upside =
 * central / price − 1.
 *
 * Layout:
 *   1–4   sheetHeader
 *   6     bar table header
 *   7…    bars
 *   +2    current price (input)
 *   +3    central estimate
 *   +4    implied upside
 */

import type ExcelJS from "exceljs";
import {
  provenanceLabel,
  type FootballBar,
  type FootballFieldResult,
} from "@/lib/research/valuation/football-field";
import { mean } from "@/lib/research/valuation/stats";
import {
  setFormula,
  setInput,
  sheetHeader,
  sizeColumns,
  sectionRow,
  NAVY,
  GREY,
  AMBER,
  LIGHT_BAND,
  PER_SHARE_FMT,
  MONEY_FMT,
  PCT_FMT,
} from "@/lib/research/excel-format";

export const FOOTBALL_SHEET_NAME = "Football Field";

export const FOOTBALL_COL = {
  method: 1,
  low: 2,
  mid: 3,
  high: 4,
  unit: 5,
  provenance: 6,
  note: 7,
} as const;

export const FOOTBALL_FIRST_BAR_ROW = 7;

export type FootballSheetLayout = {
  firstBarRow: number;
  lastBarRow: number;
  currentPriceRow: number;
  centralRow: number;
  upsideRow: number;
  midCellsAveraged: string[];
};

function finite(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

function midIsInterpolated(
  low: number | null,
  mid: number | null,
  high: number | null
): boolean {
  if (!finite(low) || !finite(high) || !finite(mid)) return false;
  const interp = (low + high) / 2;
  const scale = Math.max(1, Math.abs(interp));
  return Math.abs(mid - interp) <= 1e-9 * scale;
}

function fmtForUnit(unit: FootballBar["unit"]): string {
  if (unit === "perShare") return PER_SHARE_FMT;
  return MONEY_FMT;
}

function scaleForUnit(unit: FootballBar["unit"], n: number): number {
  return unit === "perShare" ? n : n / 1e6;
}

export function fillFootballSheet(
  ws: ExcelJS.Worksheet,
  field: FootballFieldResult
): FootballSheetLayout {
  sheetHeader(
    ws,
    "Football field",
    "Low / mid / high by method against the last share price. Illustrative bars are labelled and excluded from the central average.",
    "Blue = editable inputs; black = formulas. Mid is AVERAGE(low,high) when that is how the engine filled it; otherwise mid is an input. Provenance is filing / market / model / illustrative.",
    ["Low", "Mid", "High", "Unit", "Provenance", "Note"],
    NAVY,
    "Method"
  );

  const bars = field.bars;
  const firstBarRow = FOOTBALL_FIRST_BAR_ROW;
  const lastBarRow = bars.length > 0 ? firstBarRow + bars.length - 1 : firstBarRow - 1;

  const midCellsAveraged: string[] = [];
  const midValuesForCentral: number[] = [];

  bars.forEach((bar, i) => {
    const row = firstBarRow + i;
    const fmt = fmtForUnit(bar.unit);
    const low = finite(bar.low) ? scaleForUnit(bar.unit, bar.low) : null;
    const mid = finite(bar.mid) ? scaleForUnit(bar.unit, bar.mid) : null;
    const high = finite(bar.high) ? scaleForUnit(bar.unit, bar.high) : null;
    const interpolated = midIsInterpolated(bar.low, bar.mid, bar.high);
    const illustrative = bar.provenance === "illustrative";

    ws.getCell(row, 1).value = bar.label;
    ws.getCell(row, 1).font = { size: 10, bold: true };

    if (low != null) setInput(ws.getCell(row, 2), low, fmt);
    if (high != null) setInput(ws.getCell(row, 4), high, fmt);

    if (mid != null && interpolated && low != null && high != null) {
      setFormula(ws.getCell(row, 3), `AVERAGE(B${row},D${row})`, mid, fmt);
    } else if (mid != null) {
      setInput(ws.getCell(row, 3), mid, fmt);
    }

    ws.getCell(row, 5).value = bar.unit;
    ws.getCell(row, 5).font = { size: 9, italic: true, color: { argb: GREY } };

    const prov = bar.provenance ? provenanceLabel(bar.provenance) : "";
    ws.getCell(row, 6).value = prov;
    ws.getCell(row, 6).font = {
      size: 9,
      italic: true,
      color: { argb: illustrative ? AMBER : GREY },
    };
    if (bar.note) {
      ws.getCell(row, 7).value = bar.note;
      ws.getCell(row, 7).font = { size: 8, italic: true, color: { argb: GREY } };
    }

    if (illustrative) {
      for (let col = 1; col <= 7; col++) {
        ws.getCell(row, col).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: LIGHT_BAND },
        };
      }
    } else if (mid != null) {
      midCellsAveraged.push(`C${row}`);
      midValuesForCentral.push(mid);
    }
  });

  const summaryRow = (bars.length > 0 ? lastBarRow : 6) + 2;
  sectionRow(ws, summaryRow, "Synthesis (ex-illustrative)", 6, NAVY);

  const currentPriceRow = summaryRow + 1;
  const centralRow = summaryRow + 2;
  const upsideRow = summaryRow + 3;

  const priceIn = finite(field.currentPrice) ? field.currentPrice : 0;
  ws.getCell(currentPriceRow, 1).value = "Current share price";
  ws.getCell(currentPriceRow, 1).font = { size: 10 };
  setInput(ws.getCell(currentPriceRow, 2), priceIn, PER_SHARE_FMT);

  const central = mean(midValuesForCentral);
  ws.getCell(centralRow, 1).value = "Central estimate  (average of non-illustrative mids)";
  ws.getCell(centralRow, 1).font = { size: 10, bold: true };
  if (midCellsAveraged.length > 0) {
    setFormula(
      ws.getCell(centralRow, 2),
      `AVERAGE(${midCellsAveraged.join(",")})`,
      central,
      PER_SHARE_FMT
    );
    ws.getCell(centralRow, 2).font = { size: 10, bold: true, color: { argb: NAVY } };
  }

  const upside =
    central != null && priceIn !== 0 ? central / priceIn - 1 : null;
  ws.getCell(upsideRow, 1).value = "Implied upside  (central ÷ price − 1)";
  ws.getCell(upsideRow, 1).font = { size: 10, bold: true };
  setFormula(
    ws.getCell(upsideRow, 2),
    `IFERROR(B${centralRow}/B${currentPriceRow}-1,"")`,
    upside,
    PCT_FMT
  );
  ws.getCell(upsideRow, 2).font = { size: 10, bold: true };

  let noteRow = upsideRow + 2;
  ws.getCell(noteRow, 1).value = "Notes";
  ws.getCell(noteRow, 1).font = { bold: true, size: 10, color: { argb: NAVY } };
  noteRow += 1;
  const notes = [
    "Illustrative bars (amber provenance) are shown for context and are not averaged into the central estimate.",
    "Units should match across bars (per-share is the IB default). Mixed units are labelled — do not average them blindly.",
    ...field.notes,
  ];
  for (const n of notes) {
    ws.mergeCells(noteRow, 1, noteRow, 7);
    ws.getCell(noteRow, 1).value = n;
    ws.getCell(noteRow, 1).font = { italic: true, size: 9, color: { argb: GREY } };
    noteRow += 1;
  }

  sizeColumns(ws, 6, 48, 14);
  ws.getColumn(7).width = 42;
  return {
    firstBarRow,
    lastBarRow,
    currentPriceRow,
    centralRow,
    upsideRow,
    midCellsAveraged,
  };
}
