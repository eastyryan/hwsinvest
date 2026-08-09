// Formatting primitives shared by the statement, ratio, check, and projection
// sheets of the Excel export.
//
// Font colour follows the convention used in financial models: blue is a
// hard-coded input a user may edit, black is a formula.

import type ExcelJS from "exceljs";
import type { LineValues } from "./edgar";

export const NAVY = "FF1F3864";
export const SLATE = "FF475569";
export const TEAL = "FF0F766E";
export const LIGHT_BAND = "FFF2F6FC";
export const INPUT_BLUE = "FF0000CD";
export const GREEN = "FF15803D";
export const AMBER = "FFB45309";
export const RED = "FFB91C1C";
export const MUTED = "FF9CA3AF";
export const GREY = "FF6B7280";

export const MONEY_FMT = "#,##0;(#,##0)";
/**
 * Money for a row that is pinned to a target by construction, a balance-sheet
 * residual, or a cash balance a revolver holds at its floor.
 *
 * Those rows carry IEEE-754 dust: a residual of -3e-11 is arithmetically zero
 * but `#,##0;(#,##0)` renders it "(0)", which reads as a failed check. The
 * conditional sections show anything material and everything inside half a
 * unit as a plain zero.
 */
export const RESIDUAL_FMT = '[>=0.5]#,##0;[<=-0.5](#,##0);"0"';
export const PCT_FMT = "0.0%;[Red]-0.0%";
export const SIGNED_PCT_FMT = "+0.0%;[Red]-0.0%";
export const DAYS_FMT = "#,##0.0";
export const PER_SHARE_FMT = "#,##0.00";
export const SHARES_FMT = "#,##0";
export const MULT_FMT = "0.00\\x";

/**
 * A sheet name as it appears inside a formula.
 *
 * Names here contain spaces and parentheses, so they always need quoting, and a
 * quoted name escapes an apostrophe by doubling it. No sheet carries one today,
 * but a formula that silently terminates its own quoted string is the kind of
 * breakage that only shows up as a file Excel refuses to open.
 */
export const quoteSheet = (name: string) => `'${name.replace(/'/g, "''")}'`;

/**
 * Hand out legal, unique worksheet names.
 *
 * ExcelJS *throws* on a name containing `: \ / ? * [ ]`, on a leading or
 * trailing apostrophe, on the reserved name "History", and on a duplicate,
 * every one of which would surface as a failed export rather than a cosmetic
 * problem. Truncation to Excel's 31-character cap is the sneakier one: two
 * titles that differ only past the 31st character collide, and the collision
 * only appears for a filer whose statements happen to be named that way.
 *
 * The names in play are constants today. This exists so that stops being a fact
 * the export depends on.
 */
export function makeSheetNamer(reserved: string[] = []) {
  const used = new Set(["history", ...reserved.map((r) => r.toLowerCase())]);
  return (raw: string) => {
    const cleaned =
      raw
        .replace(/[:\\/?*[\]]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/^'+|'+$/g, "")
        .trim() || "Sheet";
    let name = cleaned.slice(0, 31);
    for (let i = 2; used.has(name.toLowerCase()); i++) {
      const suffix = ` (${i})`;
      name = cleaned.slice(0, 31 - suffix.length).trim() + suffix;
    }
    used.add(name.toLowerCase());
    return name;
  };
}

/** 1 -> A, 2 -> B, 27 -> AA. */
export function colLetter(n: number): string {
  let s = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/**
 * Write a formula with its computed value cached alongside.
 *
 * Excel recalculates on open, but Numbers, Google Sheets, and most preview
 * panes show a blank cell for a formula with no cached result. Storing a value
 * means the workbook reads correctly everywhere and still recalculates where
 * that's supported.
 */
export function setFormula(
  cell: ExcelJS.Cell,
  formula: string,
  result: number | null,
  numFmt: string
) {
  cell.value = { formula, result: result ?? undefined } as ExcelJS.CellFormulaValue;
  cell.numFmt = numFmt;
}

/**
 * Money and share counts are both written in millions; per-share amounts stay
 * in units.
 *
 * Share counts used to be stored raw and displayed with a `#,##0,,` format that
 * scaled them down by a million for the eye only. The number a reader saw and
 * the number a formula picked up then differed by six orders of magnitude, so
 * net income (millions) over diluted shares (units) came out at 7.5e-6 rather
 * than EPS. Scaling the stored value makes that division give the right answer,
 * and keeps one scale statement true for the whole workbook.
 */
export function moneyFormat(line: LineValues): string {
  return line.perShare ? PER_SHARE_FMT : line.shares ? SHARES_FMT : MONEY_FMT;
}

export const lineScale = (line: LineValues) => (line.perShare ? 1 : 1e6);

/** A hard-coded input cell: blue, so it reads as editable. */
export function setInput(cell: ExcelJS.Cell, value: number, numFmt: string) {
  cell.value = value;
  cell.numFmt = numFmt;
  cell.font = { size: 10, color: { argb: INPUT_BLUE } };
}

/** Guard every division: filings legitimately contain zeros and blanks. */
export const safeDiv = (num: string, den: string) => `IFERROR(${num}/${den},"")`;

export function sheetHeader(
  ws: ExcelJS.Worksheet,
  title: string,
  subtitle: string,
  note: string,
  columnLabels: string[],
  accent: string,
  firstColLabel = "Line item"
) {
  ws.mergeCells(1, 1, 1, Math.max(2, columnLabels.length + 1));
  const t = ws.getCell(1, 1);
  t.value = title;
  t.font = { bold: true, size: 14, color: { argb: accent } };
  ws.getCell(2, 1).value = subtitle;
  ws.getCell(2, 1).font = { italic: true, size: 10, color: { argb: GREY } };
  ws.getCell(3, 1).value = note;
  ws.getCell(3, 1).font = { italic: true, size: 9, color: { argb: GREY } };

  const headerRow = ws.getRow(4);
  headerRow.getCell(1).value = firstColLabel;
  columnLabels.forEach((l, i) => {
    headerRow.getCell(i + 2).value = l;
  });
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: accent } };
    cell.alignment = { horizontal: "right" };
    cell.border = { bottom: { style: "medium", color: { argb: accent } } };
  });
  headerRow.getCell(1).alignment = { horizontal: "left" };
}

export function sizeColumns(
  ws: ExcelJS.Worksheet,
  count: number,
  firstWidth = 34,
  width = 13
) {
  ws.getColumn(1).width = firstWidth;
  for (let c = 2; c <= count + 1; c++) ws.getColumn(c).width = width;
}

/** Section divider row inside a sheet. */
export function sectionRow(
  ws: ExcelJS.Worksheet,
  row: number,
  label: string,
  span: number,
  accent: string
) {
  const r = ws.getRow(row);
  r.getCell(1).value = label;
  r.getCell(1).font = { bold: true, size: 10, color: { argb: accent } };
  for (let c = 1; c <= span + 1; c++) {
    r.getCell(c).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: LIGHT_BAND },
    };
  }
}
