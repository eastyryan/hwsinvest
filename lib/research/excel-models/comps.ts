/**
 * Trading-comps sheet — peer inputs in blue, multiples and implied value as
 * Excel formulas (MEDIAN / AVERAGE over peer rows; subject excluded).
 *
 * Column identities (1-indexed):
 *
 *   A  name
 *   B  price            input
 *   C  shares (mm)      input
 *   D  net debt         input
 *   E  revenue          input
 *   F  ebitda           input
 *   G  ebit             input
 *   H  net income       input
 *   I  marketCap        = price × shares
 *   J  EV               = marketCap + netDebt
 *   K  EV/EBITDA        = EV / ebitda
 *   L  EV/Sales         = EV / revenue
 *   M  EV/EBIT          = EV / ebit
 *   N  P/E              = marketCap / NI
 *   O  P/S              = marketCap / revenue
 *
 * Rows: header 4 · honesty 5 · subject 6 · peers 7… · median · average · implied.
 *
 * `evEbit` is optional on older CompsResult types — guarded with
 * `'evEbit' in multiples` / `'evEbit' in implied` / `'evEbit' in peerMultiples`.
 */

import type ExcelJS from "exceljs";
import type {
  CompPeerRow,
  CompsResult,
  ImpliedByMultiple,
  MultipleDist,
} from "@/lib/research/valuation/comps";
import { median as statsMedian } from "@/lib/research/valuation/stats";
import {
  setFormula,
  setInput,
  sheetHeader,
  sizeColumns,
  sectionRow,
  safeDiv,
  colLetter,
  NAVY,
  GREY,
  LIGHT_BAND,
  MONEY_FMT,
  PER_SHARE_FMT,
  SHARES_FMT,
  MULT_FMT,
} from "@/lib/research/excel-format";

const M = 1e6;

export const COMPS_SHEET_NAME = "Trading Comps";

export const COMPS_COL = {
  name: 1,
  price: 2,
  shares: 3,
  netDebt: 4,
  revenue: 5,
  ebitda: 6,
  ebit: 7,
  netIncome: 8,
  marketCap: 9,
  ev: 10,
  evEbitda: 11,
  evSales: 12,
  evEbit: 13,
  pe: 14,
  ps: 15,
} as const;

export const COMPS_HEADER_ROW = 4;
export const COMPS_SUBJECT_ROW = 6;
export const COMPS_FIRST_PEER_ROW = 7;

export type CompsSheetLayout = {
  subjectRow: number;
  firstPeerRow: number;
  lastPeerRow: number;
  medianRow: number | null;
  averageRow: number | null;
  impliedStartRow: number | null;
  cols: typeof COMPS_COL;
};

const COL_COUNT = 14; // value columns after the name

function finite(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

function mm(n: number | null | undefined): number {
  return finite(n) ? n / M : 0;
}

function priceOf(n: number | null | undefined): number {
  return finite(n) ? n : 0;
}

const C = {
  price: "B",
  shares: "C",
  netDebt: "D",
  revenue: "E",
  ebitda: "F",
  ebit: "G",
  ni: "H",
  mkt: "I",
  ev: "J",
  evEbitda: "K",
  evSales: "L",
  evEbit: "M",
  pe: "N",
  ps: "O",
} as const;

type EvEbitBag = { evEbit?: number | null };

function evEbitFromMultiples(
  multiples: CompPeerRow["multiples"]
): number | null {
  if (typeof multiples === "object" && multiples != null && "evEbit" in multiples) {
    const v = (multiples as EvEbitBag).evEbit;
    return finite(v) ? v : null;
  }
  return null;
}

function impliedEvEbit(result: CompsResult): ImpliedByMultiple | null {
  if (!("evEbit" in result.implied)) return null;
  const v = (result.implied as { evEbit?: ImpliedByMultiple }).evEbit;
  return v ?? null;
}

function peerEvEbitDist(result: CompsResult): MultipleDist | null {
  if (!("evEbit" in result.peerMultiples)) return null;
  const v = (result.peerMultiples as { evEbit?: MultipleDist }).evEbit;
  return v ?? null;
}

function writeName(ws: ExcelJS.Worksheet, row: number, text: string, bold = false) {
  const c = ws.getCell(row, 1);
  c.value = text;
  c.font = { size: 10, bold };
}

function writeCompanyRow(
  ws: ExcelJS.Worksheet,
  row: number,
  peer: CompPeerRow,
  role: "Subject" | "Peer"
) {
  const price = priceOf(peer.price);
  const shares = mm(peer.shares);
  const netDebt = mm(peer.netDebt);
  const revenue = mm(peer.revenue);
  const ebitda = mm(peer.ebitda);
  const ebit = mm(peer.ebit);
  const ni = mm(peer.netIncome);
  const marketCap = price * shares;
  const ev = marketCap + netDebt;
  const evEbitda = ebitda !== 0 ? ev / ebitda : null;
  const evSales = revenue !== 0 ? ev / revenue : null;
  const evEbitCached =
    evEbitFromMultiples(peer.multiples) ?? (ebit !== 0 ? ev / ebit : null);
  const pe = ni !== 0 ? marketCap / ni : null;
  const ps = revenue !== 0 ? marketCap / revenue : null;

  const label = peer.name
    ? `${role === "Subject" ? "■ " : ""}${peer.ticker}  ${peer.name}`
    : `${role === "Subject" ? "■ " : ""}${peer.ticker}`;
  writeName(ws, row, label, role === "Subject");

  setInput(ws.getCell(row, COMPS_COL.price), price, PER_SHARE_FMT);
  setInput(ws.getCell(row, COMPS_COL.shares), shares, SHARES_FMT);
  setInput(ws.getCell(row, COMPS_COL.netDebt), netDebt, MONEY_FMT);
  setInput(ws.getCell(row, COMPS_COL.revenue), revenue, MONEY_FMT);
  setInput(ws.getCell(row, COMPS_COL.ebitda), ebitda, MONEY_FMT);
  setInput(ws.getCell(row, COMPS_COL.ebit), ebit, MONEY_FMT);
  setInput(ws.getCell(row, COMPS_COL.netIncome), ni, MONEY_FMT);

  setFormula(
    ws.getCell(row, COMPS_COL.marketCap),
    `${C.price}${row}*${C.shares}${row}`,
    marketCap,
    MONEY_FMT
  );
  setFormula(
    ws.getCell(row, COMPS_COL.ev),
    `${C.mkt}${row}+${C.netDebt}${row}`,
    ev,
    MONEY_FMT
  );
  setFormula(
    ws.getCell(row, COMPS_COL.evEbitda),
    safeDiv(`${C.ev}${row}`, `${C.ebitda}${row}`),
    evEbitda,
    MULT_FMT
  );
  setFormula(
    ws.getCell(row, COMPS_COL.evSales),
    safeDiv(`${C.ev}${row}`, `${C.revenue}${row}`),
    evSales,
    MULT_FMT
  );
  setFormula(
    ws.getCell(row, COMPS_COL.evEbit),
    safeDiv(`${C.ev}${row}`, `${C.ebit}${row}`),
    evEbitCached,
    MULT_FMT
  );
  setFormula(
    ws.getCell(row, COMPS_COL.pe),
    safeDiv(`${C.mkt}${row}`, `${C.ni}${row}`),
    pe,
    MULT_FMT
  );
  setFormula(
    ws.getCell(row, COMPS_COL.ps),
    safeDiv(`${C.mkt}${row}`, `${C.revenue}${row}`),
    ps,
    MULT_FMT
  );

  if (role === "Subject") {
    for (let col = 1; col <= COMPS_COL.ps; col++) {
      ws.getCell(row, col).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: LIGHT_BAND },
      };
    }
  }
}

function statRange(col: string, first: number, last: number): string {
  return `${col}${first}:${col}${last}`;
}

function writeHonesty(ws: ExcelJS.Worksheet, row: number, text: string) {
  ws.mergeCells(row, 1, row, COMPS_COL.ps);
  const c = ws.getCell(row, 1);
  c.value = text;
  c.font = { italic: true, size: 9, color: { argb: GREY } };
}

function isEmptyComps(result: CompsResult): boolean {
  return result.peers.length === 0;
}

export function fillCompsSheet(
  ws: ExcelJS.Worksheet,
  result: CompsResult
): CompsSheetLayout {
  sheetHeader(
    ws,
    "Trading comparable companies",
    "Peer trading multiples applied to the subject — median is the primary read.",
    "Blue = editable inputs (seeded from filings / last price). Black = formulas. Curated liquid US map; TTM when available; not a Street universe.",
    [
      "Price",
      "Shares (mm)",
      "Net debt",
      "Revenue",
      "EBITDA",
      "EBIT",
      "Net income",
      "Market cap",
      "EV",
      "EV/EBITDA",
      "EV/Sales",
      "EV/EBIT",
      "P/E",
      "P/S",
    ],
    NAVY,
    "Company"
  );

  const empty = isEmptyComps(result);
  writeHonesty(
    ws,
    5,
    empty
      ? "No peer companies in this export. The peer set is a curated liquid US large-cap map, not a formal competitor set or Street universe. TTM used when available."
      : "Subject highlighted. Peer medians exclude the subject row. Edit blue cells — multiples and implied values recalculate."
  );

  const subjectRow = COMPS_SUBJECT_ROW;
  writeCompanyRow(ws, subjectRow, result.subject, "Subject");

  if (empty) {
    sizeColumns(ws, COL_COUNT, 28, 12);
    return {
      subjectRow,
      firstPeerRow: COMPS_FIRST_PEER_ROW,
      lastPeerRow: COMPS_FIRST_PEER_ROW - 1,
      medianRow: null,
      averageRow: null,
      impliedStartRow: null,
      cols: COMPS_COL,
    };
  }

  const firstPeerRow = COMPS_FIRST_PEER_ROW;
  result.peers.forEach((p, i) => {
    writeCompanyRow(ws, firstPeerRow + i, p, "Peer");
  });
  const lastPeerRow = firstPeerRow + result.peers.length - 1;

  const medianRow = lastPeerRow + 2;
  const averageRow = medianRow + 1;

  const peerMult = (key: "evEbitda" | "evSales" | "pe" | "ps"): number | null =>
    result.peerMultiples[key]?.median ?? null;
  const peerMean = (key: "evEbitda" | "evSales" | "pe" | "ps"): number | null =>
    result.peerMultiples[key]?.mean ?? null;

  const evEbitValues = result.peers
    .map((p) => {
      const tagged = evEbitFromMultiples(p.multiples);
      if (tagged != null) return tagged;
      if (finite(p.enterpriseValue) && finite(p.ebit) && p.ebit > 0) {
        return p.enterpriseValue / p.ebit;
      }
      return null;
    })
    .filter(finite);
  const evEbitMedianCached =
    peerEvEbitDist(result)?.median ?? statsMedian(evEbitValues);
  const evEbitMeanCached = peerEvEbitDist(result)?.mean ?? null;

  writeName(ws, medianRow, "Peer median", true);
  writeName(ws, averageRow, "Peer average");

  const statCols: Array<{
    col: number;
    letter: string;
    median: number | null;
    mean: number | null;
  }> = [
    {
      col: COMPS_COL.evEbitda,
      letter: C.evEbitda,
      median: peerMult("evEbitda"),
      mean: peerMean("evEbitda"),
    },
    {
      col: COMPS_COL.evSales,
      letter: C.evSales,
      median: peerMult("evSales"),
      mean: peerMean("evSales"),
    },
    {
      col: COMPS_COL.evEbit,
      letter: C.evEbit,
      median: evEbitMedianCached,
      mean: evEbitMeanCached,
    },
    {
      col: COMPS_COL.pe,
      letter: C.pe,
      median: peerMult("pe"),
      mean: peerMean("pe"),
    },
    {
      col: COMPS_COL.ps,
      letter: C.ps,
      median: peerMult("ps"),
      mean: peerMean("ps"),
    },
  ];

  for (const s of statCols) {
    const range = statRange(s.letter, firstPeerRow, lastPeerRow);
    setFormula(
      ws.getCell(medianRow, s.col),
      `IFERROR(MEDIAN(${range}),"")`,
      s.median,
      MULT_FMT
    );
    ws.getCell(medianRow, s.col).font = { size: 10, bold: true };
    setFormula(
      ws.getCell(averageRow, s.col),
      `IFERROR(AVERAGE(${range}),"")`,
      s.mean,
      MULT_FMT
    );
  }

  const impliedStart = averageRow + 2;
  sectionRow(ws, impliedStart, "Implied subject value at peer median", COL_COUNT, NAVY);

  const hdr = impliedStart + 1;
  const headers = ["Method", "Median multiple", "Implied EV", "Implied equity", "Per share"];
  headers.forEach((h, i) => {
    const c = ws.getCell(hdr, i + 1);
    c.value = h;
    c.font = { bold: true, size: 9, color: { argb: GREY } };
  });

  type MethodSpec = {
    label: string;
    medianCol: string;
    kind: "ev" | "equity";
    subjectRef: string;
    implied: ImpliedByMultiple | null;
  };

  const evEbitImp = impliedEvEbit(result);
  const methods: MethodSpec[] = [
    {
      label: "EV / EBITDA",
      medianCol: `${C.evEbitda}${medianRow}`,
      kind: "ev",
      subjectRef: `${C.ebitda}${subjectRow}`,
      implied: result.implied.evEbitda,
    },
    {
      label: "EV / Sales",
      medianCol: `${C.evSales}${medianRow}`,
      kind: "ev",
      subjectRef: `${C.revenue}${subjectRow}`,
      implied: result.implied.evSales,
    },
    {
      label: "EV / EBIT",
      medianCol: `${C.evEbit}${medianRow}`,
      kind: "ev",
      subjectRef: `${C.ebit}${subjectRow}`,
      implied: evEbitImp,
    },
    {
      label: "P / E",
      medianCol: `${C.pe}${medianRow}`,
      kind: "equity",
      subjectRef: `${C.ni}${subjectRow}`,
      implied: result.implied.pe,
    },
    {
      label: "P / S",
      medianCol: `${C.ps}${medianRow}`,
      kind: "equity",
      subjectRef: `${C.revenue}${subjectRow}`,
      implied: result.implied.ps,
    },
  ];

  const ndRef = `${C.netDebt}${subjectRow}`;
  const shRef = `${C.shares}${subjectRow}`;

  methods.forEach((m, i) => {
    const r = hdr + 1 + i;
    writeName(ws, r, m.label);
    setFormula(
      ws.getCell(r, 2),
      m.medianCol,
      m.implied?.multiple ?? null,
      MULT_FMT
    );

    if (m.kind === "ev") {
      const evExpr = `${m.medianCol}*${m.subjectRef}`;
      const metric =
        m.label === "EV / EBITDA"
          ? mm(result.subject.ebitda)
          : m.label === "EV / Sales"
            ? mm(result.subject.revenue)
            : mm(result.subject.ebit);
      const fallbackMult =
        m.implied?.multiple ??
        (m.label === "EV / EBIT" ? evEbitMedianCached : null);
      const evResult =
        m.implied?.enterpriseValue != null
          ? m.implied.enterpriseValue / M
          : finite(fallbackMult)
            ? fallbackMult * metric
            : null;
      setFormula(ws.getCell(r, 3), evExpr, evResult, MONEY_FMT);
      const eqExpr = `${colLetter(3)}${r}-${ndRef}`;
      const eqCached =
        m.implied?.equityValue != null
          ? m.implied.equityValue / M
          : evResult != null
            ? evResult - mm(result.subject.netDebt)
            : null;
      setFormula(ws.getCell(r, 4), eqExpr, eqCached, MONEY_FMT);
      setFormula(
        ws.getCell(r, 5),
        safeDiv(`${colLetter(4)}${r}`, shRef),
        m.implied?.perShare ??
          (eqCached != null && mm(result.subject.shares) !== 0
            ? eqCached / mm(result.subject.shares)
            : null),
        PER_SHARE_FMT
      );
    } else {
      ws.getCell(r, 3).value = "—";
      ws.getCell(r, 3).font = { size: 10, color: { argb: GREY } };
      const eqExpr = `${m.medianCol}*${m.subjectRef}`;
      const eqCached =
        m.implied?.equityValue != null ? m.implied.equityValue / M : null;
      setFormula(ws.getCell(r, 4), eqExpr, eqCached, MONEY_FMT);
      setFormula(
        ws.getCell(r, 5),
        safeDiv(`${colLetter(4)}${r}`, shRef),
        m.implied?.perShare ?? null,
        PER_SHARE_FMT
      );
    }
  });

  let noteRow = hdr + 1 + methods.length + 2;
  ws.getCell(noteRow, 1).value = "Notes";
  ws.getCell(noteRow, 1).font = { bold: true, size: 10, color: { argb: NAVY } };
  noteRow += 1;
  const footer = [
    "Curated liquid US map; TTM when available; not a Street universe.",
    ...result.notes,
  ];
  for (const n of footer) {
    ws.mergeCells(noteRow, 1, noteRow, COMPS_COL.ps);
    ws.getCell(noteRow, 1).value = n;
    ws.getCell(noteRow, 1).font = { italic: true, size: 9, color: { argb: GREY } };
    noteRow += 1;
  }

  sizeColumns(ws, COL_COUNT, 28, 12);
  return {
    subjectRow,
    firstPeerRow,
    lastPeerRow,
    medianRow,
    averageRow,
    impliedStartRow: impliedStart,
    cols: COMPS_COL,
  };
}
