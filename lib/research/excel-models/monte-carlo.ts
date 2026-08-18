// Monte Carlo DCF sheet.
//
// A thousand shocked paths cannot live cheaply as Excel RAND() formulas — and
// a fake RAND() block would not match the in-app draw. Honesty: summary
// statistics are cached VALUES with a note that they were simulated in-app.
//
// The sheet still has real formulas: a one-path Gordon DCF of the *base* FCF
// at WACC / g (sum of FCF_t / (1+w)^t + TV / (1+w)^n). Effective g is clamped
// below WACC so the terminal value is defined.
//
// Pass `{ ...runMonteCarloDcf(inputs), inputs }` so the base path and shocks
// land as blue cells.

import type ExcelJS from "exceljs";
import type { McDcfInputs, McDcfResult } from "@/lib/research/valuation/monte-carlo-dcf";
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
  PER_SHARE_FMT,
  SHARES_FMT,
} from "@/lib/research/excel-format";

export type McSheetResult = McDcfResult & {
  inputs?: McDcfInputs;
};

export const MC_SHEET_NAME = "Monte Carlo DCF";

export const MC_ROW = {
  inputs: 6,
  wacc: 7,
  growth: 8,
  fcfShock: 9,
  waccShock: 10,
  growthShock: 11,
  sims: 12,
  debt: 13,
  cash: 14,
  shares: 15,
  path: 17,
  fcf: 18,
  df: 19,
  pv: 20,
  gordon: 22,
  gEff: 23,
  tv: 24,
  pvTv: 25,
  ev: 26,
  equity: 27,
  perShare: 28,
  dist: 30,
  mean: 31,
  median: 32,
  p5: 33,
  p95: 34,
  p25: 35,
  p75: 36,
  std: 37,
  notesFirst: 39,
} as const;

export const MC_FIRST_YEAR_COL = 3; // C = Year 1

function isFiniteNumber(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

/** Year-end Gordon DCF matching the Monte Carlo engine's evAtRate. */
export function baseCaseGordon(
  fcf: number[],
  wacc: number,
  g: number
): { df: number[]; pv: number[]; gEff: number; tv: number; pvTv: number; ev: number } | null {
  if (!(wacc > 0) || fcf.length === 0 || fcf.some((x) => !Number.isFinite(x))) return null;
  const gEff = Math.min(g, wacc - 0.005);
  if (!(wacc > gEff)) return null;
  const df: number[] = [];
  const pv: number[] = [];
  let factor = 1;
  let sum = 0;
  for (let t = 0; t < fcf.length; t++) {
    factor /= 1 + wacc;
    df.push(factor);
    const p = fcf[t]! * factor;
    pv.push(p);
    sum += p;
  }
  const last = fcf[fcf.length - 1]!;
  const tv = (last * (1 + gEff)) / (wacc - gEff);
  const pvTv = tv * factor;
  return { df, pv, gEff, tv, pvTv, ev: sum + pvTv };
}

export function fillMonteCarloSheet(ws: ExcelJS.Worksheet, result: McSheetResult) {
  const inp = result.inputs;
  const fcf = inp?.fcf ?? [];
  const n = Math.max(fcf.length, 1);
  const wacc = inp && isFiniteNumber(inp.wacc) ? inp.wacc : 0;
  const g = inp && isFiniteNumber(inp.terminalGrowth) ? inp.terminalGrowth : 0;
  const debt = inp && isFiniteNumber(inp.debt) ? inp.debt : 0;
  const cash = inp && isFiniteNumber(inp.cash) ? inp.cash : 0;
  const shares = inp && isFiniteNumber(inp.shares) && inp.shares! > 0 ? inp.shares! : null;
  const gordon = fcf.length > 0 ? baseCaseGordon(fcf, wacc, g) : null;
  const C = (t: number) => colLetter(MC_FIRST_YEAR_COL + t);
  const lastCol = C(Math.max(fcf.length, 1) - 1);
  const firstCol = C(0);
  const R = MC_ROW;
  const B = "B";
  const yearLabels = Array.from({ length: n }, (_, i) => `Year ${i + 1}`);

  sheetHeader(
    ws,
    "Monte Carlo DCF",
    "Base-case Gordon DCF (live formulas) plus in-app simulation summary statistics.",
    "$ millions except per-share. Blue = inputs. Simulated distribution is cached — not live RAND().",
    ["Scalar", ...yearLabels],
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

  const valueB = (row: number, text: string, value: number | null, fmt: string) => {
    label(row, text);
    const cell = ws.getRow(row).getCell(2);
    if (value != null && isFiniteNumber(value)) {
      cell.value = value;
      cell.numFmt = fmt;
      cell.font = { size: 10 };
    } else {
      cell.value = "—";
      cell.font = { size: 10, italic: true, color: { argb: GREY } };
    }
  };

  sectionRow(ws, R.inputs, "Simulation inputs", n + 1, NAVY);
  inputB(R.wacc, "WACC", wacc, PCT_FMT);
  inputB(R.growth, "Terminal growth", g, PCT_FMT);
  inputB(R.fcfShock, "FCF shock σ  (multiplicative, per year)", inp?.fcfShockStd ?? 0.15, PCT_FMT);
  inputB(R.waccShock, "WACC shock σ  (absolute)", inp?.waccShockStd ?? 0.01, PCT_FMT);
  inputB(R.growthShock, "Growth shock σ  (absolute)", inp?.growthShockStd ?? 0.005, PCT_FMT);
  inputB(R.sims, "Simulations (in-app)", inp?.simulations ?? result.simulations, "0");
  inputB(R.debt, "Debt", debt, MONEY_FMT);
  inputB(R.cash, "Cash", cash, MONEY_FMT);
  inputB(R.shares, "Diluted shares (millions)", shares, SHARES_FMT);

  sectionRow(ws, R.path, "Base FCF path (one-path Gordon DCF)", n + 1, NAVY);

  label(R.fcf, "Base unlevered FCF", { bold: true });
  const fcfVals = fcf.length > 0 ? fcf : [0];
  fcfVals.forEach((v, t) => {
    setInput(ws.getRow(R.fcf).getCell(MC_FIRST_YEAR_COL + t), v, MONEY_FMT);
  });

  label(R.df, "Discount factor @ WACC", { indent: true });
  fcfVals.forEach((_, t) => {
    const cell = ws.getRow(R.df).getCell(MC_FIRST_YEAR_COL + t);
    const formula =
      t === 0 ? `1/(1+$${B}$${R.wacc})` : `${C(t - 1)}${R.df}/(1+$${B}$${R.wacc})`;
    setFormula(cell, formula, gordon?.df[t] ?? null, "0.000");
    cell.font = { size: 10 };
  });

  label(R.pv, "PV of FCF", { bold: true });
  fcfVals.forEach((_, t) => {
    const cell = ws.getRow(R.pv).getCell(MC_FIRST_YEAR_COL + t);
    setFormula(cell, `${C(t)}${R.fcf}*${C(t)}${R.df}`, gordon?.pv[t] ?? null, MONEY_FMT);
    cell.font = { size: 10, bold: true };
  });

  sectionRow(ws, R.gordon, "Base-case enterprise value", n + 1, NAVY);
  formulaB(
    R.gEff,
    "Effective g  (clamped below WACC − 50 bp)",
    `MIN(${B}${R.growth},${B}${R.wacc}-0.005)`,
    gordon?.gEff ?? null,
    PCT_FMT
  );
  formulaB(
    R.tv,
    "Terminal value  (FCFₙ × (1+g) / (WACC − g))",
    `IFERROR(${lastCol}${R.fcf}*(1+${B}${R.gEff})/(${B}${R.wacc}-${B}${R.gEff}),"")`,
    gordon?.tv ?? null,
    MONEY_FMT
  );
  formulaB(
    R.pvTv,
    "PV of terminal value",
    `IFERROR(${B}${R.tv}*${lastCol}${R.df},"")`,
    gordon?.pvTv ?? null,
    MONEY_FMT,
    { indent: true }
  );
  formulaB(
    R.ev,
    "Enterprise value",
    `IFERROR(SUM(${firstCol}${R.pv}:${lastCol}${R.pv})+${B}${R.pvTv},"")`,
    gordon?.ev ?? null,
    MONEY_FMT,
    { bold: true }
  );
  const equity = gordon ? gordon.ev - debt + cash : null;
  formulaB(
    R.equity,
    "Equity value  (EV − debt + cash)",
    `${B}${R.ev}-${B}${R.debt}+${B}${R.cash}`,
    equity,
    MONEY_FMT,
    { bold: true }
  );
  const perShare = equity != null && shares != null && shares > 0 ? equity / shares : equity;
  formulaB(
    R.perShare,
    "Base-case value per share",
    `IFERROR(IF(OR(${B}${R.shares}="",${B}${R.shares}<=0),${B}${R.equity},${B}${R.equity}/${B}${R.shares}),"")`,
    perShare,
    PER_SHARE_FMT,
    { bold: true }
  );

  sectionRow(ws, R.dist, "Simulated distribution (values — not RAND())", n + 1, NAVY);
  valueB(R.mean, "Mean per share", result.meanPerShare, PER_SHARE_FMT);
  valueB(R.median, "Median per share", result.medianPerShare, PER_SHARE_FMT);
  valueB(R.p5, "5th percentile", result.p5, PER_SHARE_FMT);
  valueB(R.p95, "95th percentile", result.p95, PER_SHARE_FMT);
  valueB(R.p25, "25th percentile", result.p25, PER_SHARE_FMT);
  valueB(R.p75, "75th percentile", result.p75, PER_SHARE_FMT);
  valueB(R.std, "Std. dev. per share", result.stdPerShare, PER_SHARE_FMT);

  const notes = [
    "Simulated in-app; Excel shows summary statistics, not live RAND(). A RAND() block would not match the",
    "in-app draw (seeded mulberry32 + Box–Muller) and would recalculate on every open.",
    "Shocks are independent: each year's FCF is multiplied by (1 + σZ), and WACC / g are shifted by their own",
    "draws. Terminal growth is clamped below WACC − 50 bp so Gordon TV stays defined.",
    "The base-case block above is a live Gordon DCF of the unshocked FCF path. Edit blue FCF / WACC / g and it",
    "recomputes; the distribution rows will not, until you re-run the simulation in the app.",
    "This is a calculator that reflects the inputs above. It is not a price target or investment advice.",
    ...result.notes,
  ];
  notes.forEach((t, i) => {
    const cell = ws.getCell(R.notesFirst + i, 1);
    cell.value = t;
    cell.font = { size: 9, italic: true, color: { argb: i === 0 ? INPUT_BLUE : GREY } };
  });

  sizeColumns(ws, n + 1, 52, 13);
  ws.views = [{ state: "frozen", xSplit: 1, ySplit: 4 }];
}
