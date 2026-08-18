// Formula-driven sum-of-the-parts sheet.
//
// Each segment's EV is metric × multiple (or a direct override). Corporate
// overhead and net debt are blue inputs subtracted from the sum. Multiples are
// user / sector assumptions unless a filing-backed override is entered.

import type ExcelJS from "exceljs";
import type { SotPResult } from "@/lib/research/valuation/sotp";
import {
  setFormula,
  setInput,
  sheetHeader,
  sizeColumns,
  sectionRow,
  INPUT_BLUE,
  NAVY,
  GREY,
  MUTED,
  MONEY_FMT,
  MULT_FMT,
  PER_SHARE_FMT,
  SHARES_FMT,
} from "@/lib/research/excel-format";

export type SotPSheetResult = SotPResult & { shares?: number | null };

export const SOTP_SHEET_NAME = "SOTP";

export const SOTP_COL = {
  name: 1,
  revenue: 2,
  ebitda: 3,
  multiple: 4,
  type: 5,
  override: 6,
  ev: 7,
} as const;

export const SOTP_FIXED = {
  section: 6,
  colHeader: 7,
  firstSegment: 8,
} as const;

export function sotpBridgeRows(segmentCount: number) {
  const n = Math.max(segmentCount, 1);
  const first = SOTP_FIXED.firstSegment + n + 1;
  return {
    sumEv: first,
    overhead: first + 1,
    grossEv: first + 2,
    netDebt: first + 3,
    equity: first + 4,
    shares: first + 5,
    perShare: first + 6,
    notesFirst: first + 8,
  };
}

function isFiniteNumber(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

function sharesOf(result: SotPSheetResult): number | null {
  if (isFiniteNumber(result.shares) && result.shares > 0) return result.shares;
  if (isFiniteNumber(result.equityValue) && isFiniteNumber(result.perShare) && result.perShare !== 0) {
    return result.equityValue / result.perShare;
  }
  return null;
}

function evFormula(row: number): string {
  const rev = `B${row}`;
  const ebitda = `C${row}`;
  const mult = `D${row}`;
  const typ = `E${row}`;
  const over = `F${row}`;
  return `IF(${over}<>"",${over},IF(${typ}="evSales",IF(${rev}="","",${rev}*${mult}),IF(${typ}="evEbitda",IF(${ebitda}="","",${ebitda}*${mult}),"")))`;
}

export function fillSotpSheet(ws: ExcelJS.Worksheet, result: SotPSheetResult) {
  const segs = result.segments;
  const n = Math.max(segs.length, 1);
  const first = SOTP_FIXED.firstSegment;
  const lastSeg = first + n - 1;
  const br = sotpBridgeRows(segs.length);

  sheetHeader(
    ws,
    "Sum of the Parts",
    "Segment enterprise values at EV/Sales or EV/EBITDA, less corporate overhead and net debt.",
    "$ millions except per-share. Blue = inputs; black = formulas. Multiples are user/sector assumptions unless a filing-backed override is entered.",
    ["Revenue", "EBITDA", "Multiple", "Type", "EV override", "Enterprise value"],
    NAVY,
    "Segment"
  );

  sectionRow(ws, SOTP_FIXED.section, "Segments", 6, NAVY);

  const hdr = ws.getRow(SOTP_FIXED.colHeader);
  ["Segment", "Revenue", "EBITDA", "Multiple", "Multiple type", "EV override", "Enterprise value"].forEach(
    (text, i) => {
      const cell = hdr.getCell(i + 1);
      cell.value = text;
      cell.font = { size: 9, bold: true, color: { argb: GREY } };
    }
  );

  const rows = segs.length > 0 ? segs : [{ segment: null, enterpriseValue: null }];

  rows.forEach((row, i) => {
    const r = first + i;
    const line = ws.getRow(r);
    const seg = row.segment;
    line.getCell(1).value = seg?.name ?? "";
    line.getCell(1).font = { size: 10 };

    if (seg && isFiniteNumber(seg.revenue)) setInput(line.getCell(2), seg.revenue, MONEY_FMT);
    if (seg && isFiniteNumber(seg.ebitda)) setInput(line.getCell(3), seg.ebitda, MONEY_FMT);
    if (seg && isFiniteNumber(seg.multiple)) setInput(line.getCell(4), seg.multiple, MULT_FMT);

    const typeCell = line.getCell(5);
    typeCell.value = seg?.multipleType ?? "evSales";
    typeCell.font = { size: 10, color: { argb: INPUT_BLUE } };

    if (seg && isFiniteNumber(seg.enterpriseValueOverride)) {
      setInput(line.getCell(6), seg.enterpriseValueOverride, MONEY_FMT);
    }

    const ev = row.enterpriseValue;
    const evCell = line.getCell(7);
    setFormula(evCell, evFormula(r), ev, MONEY_FMT);
    evCell.font = { size: 10, bold: true };
  });

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
    opts: { bold?: boolean } = {}
  ) => {
    label(row, text, opts);
    const cell = ws.getRow(row).getCell(2);
    setFormula(cell, formula, value, fmt);
    cell.font = { size: 10, bold: opts.bold, color: opts.bold ? { argb: NAVY } : undefined };
  };

  const overhead = result.corporateOverheadEv;
  const netDebt = result.netDebt;
  const shares = sharesOf(result);
  const sumEv = result.sumSegmentEv;
  const haircut = overhead != null && overhead > 0 ? overhead : 0;
  const grossEv = sumEv != null ? sumEv - haircut : null;
  const equity =
    grossEv != null && netDebt != null
      ? grossEv - netDebt
      : result.equityValue;
  const perShare =
    equity != null && shares != null && shares > 0 ? equity / shares : result.perShare;

  formulaB(
    br.sumEv,
    "Sum of segment EV",
    `SUM(G${first}:G${lastSeg})`,
    sumEv,
    MONEY_FMT,
    { bold: true }
  );
  inputB(br.overhead, "Corporate overhead (EV haircut)", overhead ?? 0, MONEY_FMT);
  formulaB(br.grossEv, "Gross enterprise value", `B${br.sumEv}-B${br.overhead}`, grossEv, MONEY_FMT, {
    bold: true,
  });
  inputB(br.netDebt, "Net debt", netDebt ?? 0, MONEY_FMT);
  formulaB(br.equity, "Equity value", `B${br.grossEv}-B${br.netDebt}`, equity, MONEY_FMT, { bold: true });
  inputB(br.shares, "Diluted shares (millions)", shares, SHARES_FMT);
  formulaB(
    br.perShare,
    "Value per share",
    `IFERROR(IF(B${br.shares}<=0,"",B${br.equity}/B${br.shares}),"")`,
    perShare,
    PER_SHARE_FMT,
    { bold: true }
  );

  const notes = [
    "EV = metric × multiple (Revenue × EV/Sales, or EBITDA × EV/EBITDA). An EV override, if entered, wins.",
    "Multiples are user or sector assumptions unless the override is filing-backed. They are not a market quote.",
    "Corporate overhead is an EV haircut (positive number subtracts). Net debt bridges enterprise to equity.",
    "This is a calculator that reflects the inputs above. It is not a price target or investment advice.",
    ...result.notes,
  ];
  notes.forEach((t, i) => {
    const cell = ws.getCell(br.notesFirst + i, 1);
    cell.value = t;
    cell.font = { size: 9, italic: true, color: { argb: i === 0 ? MUTED : GREY } };
  });

  sizeColumns(ws, 6, 36, 14);
  ws.getColumn(5).width = 16;
  ws.getColumn(6).width = 14;
  ws.getColumn(7).width = 18;
  ws.views = [{ state: "frozen", xSplit: 1, ySplit: 4 }];
}
