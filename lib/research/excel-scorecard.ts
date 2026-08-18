// A rules-based quality scorecard, computed entirely from the normalized
// statements — no market data, no model, no judgement call that isn't a printed
// threshold. It scores five dimensions an analyst eyeballs first (growth,
// returns, cash conversion, leverage, coverage) on transparent bands, averages
// the ones the filing supports, and grades the result.
//
// It is a heuristic, and it says so: every band is on the sheet, so a reader can
// see exactly why a company landed where it did and disagree by changing their
// own mind, not a hidden weight. Not a rating and not investment advice.

import type ExcelJS from "exceljs";
import type { CompanyFinancials, StatementSet } from "./edgar";
import { periodCagr } from "./cagr";
import {
  sheetHeader,
  sizeColumns,
  sectionRow,
  NAVY,
  GREEN,
  AMBER,
  RED,
  GREY,
  MUTED,
  INPUT_BLUE,
  PCT_FMT,
  MULT_FMT,
} from "./excel-format";
import {
  type SectorMode,
  revenueGrowthLabel,
  revenueGrowthMetricNote,
} from "./sector-mode";

/** Latest annual value for a line, `back` years before the latest. */
function val(set: StatementSet, key: string, back = 0): number | null {
  const p = set.periods[back];
  if (!p) return null;
  for (const st of set.statements) {
    const l = st.lines.find((x) => x.key === key);
    if (l) return l.values[p.key] ?? null;
  }
  return null;
}

function lineValues(set: StatementSet, key: string): Record<string, number | null> | null {
  for (const st of set.statements) {
    const l = st.lines.find((x) => x.key === key);
    if (l) return l.values;
  }
  return null;
}

const num = (x: number | null | undefined) => (x == null ? 0 : x);

export interface ScoreFactor {
  label: string;
  metric: string;
  value: number | null;
  fmt: string;
  score: number | null; // 0–100
  band: string;
}

export interface Scorecard {
  factors: ScoreFactor[];
  composite: number | null;
  grade: string;
}

/**
 * Map a value to a 0–100 score. `bands` is ascending `[threshold, score]`; the
 * score of the highest threshold the value meets wins. `lowerIsBetter` flips it.
 */
function scoreBands(
  value: number,
  bands: [number, number][],
  lowerIsBetter = false
): number {
  if (lowerIsBetter) {
    for (const [t, s] of bands) if (value <= t) return s;
    return bands[bands.length - 1][1];
  }
  let out = bands[0][1];
  for (const [t, s] of bands) if (value >= t) out = s;
  return out;
}

/**
 * Rules-based quality scorecard. For banks/insurers, industrial ROIC, net-debt
 * / EBITDA, and interest coverage are replaced with ROE, ROA, and debt/equity —
 * metrics that exist on the normalized statements and are meaningful for those
 * models. Pass `mode` from detectSectorMode(profile); default is standard.
 */
export function buildScorecard(
  fin: CompanyFinancials,
  mode: SectorMode = "standard"
): Scorecard {
  const a = fin.annual;
  const factors: ScoreFactor[] = [];
  const financial = mode === "bank" || mode === "insurer";

  // 1. Revenue growth — trailing 3-year CAGR (fall back to 1-year).
  // Uses the shared periodCagr helper so scorecard and statement tables agree,
  // and so a scale break in the series (unit/currency discontinuity) yields
  // null rather than a fantasy growth rate.
  const rev0 = val(a, "revenue");
  const rev1 = val(a, "revenue", 1);
  const revValues = lineValues(a, "revenue");
  let cagr: number | null =
    revValues != null ? periodCagr(revValues, a.periods, 3) : null;
  if (cagr == null && rev0 && rev1 && rev1 > 0) cagr = rev0 / rev1 - 1;
  factors.push({
    label: revenueGrowthLabel(mode),
    metric: revenueGrowthMetricNote(mode),
    value: cagr,
    fmt: PCT_FMT,
    score:
      cagr == null
        ? null
        : scoreBands(cagr, [
            [-1, 20],
            [0, 40],
            [0.05, 60],
            [0.1, 80],
            [0.2, 100],
          ]),
    band: "<0% → 20 · 0% → 40 · 5% → 60 · 10% → 80 · ≥20% → 100",
  });

  const ebit = val(a, "operatingIncome");
  const pretax = val(a, "pretaxIncome");
  const taxes = val(a, "taxes");
  const taxRate =
    pretax != null && taxes != null && pretax > 0
      ? Math.min(0.45, Math.max(0, taxes / pretax))
      : 0.21;
  const debt = num(val(a, "ltDebt")) + num(val(a, "stDebt"));
  const equity = val(a, "equity");
  const ni = val(a, "netIncome");
  const assets = val(a, "totalAssets");

  if (financial) {
    // 2. ROE — primary return measure for banks and insurers.
    const roe = ni != null && equity != null && equity > 0 ? ni / equity : null;
    factors.push({
      label: "Return on equity",
      metric: "Net income / shareholders' equity",
      value: roe,
      fmt: PCT_FMT,
      score:
        roe == null
          ? null
          : scoreBands(roe, [
              [-1, 20],
              [0.05, 45],
              [0.1, 65],
              [0.15, 85],
              [0.2, 100],
            ]),
      band: "<5% → 45 · 10% → 65 · 15% → 85 · ≥20% → 100",
    });

    // 3. ROA — capital/asset efficiency proxy (no CET1 without new tags).
    const roa = ni != null && assets != null && assets > 0 ? ni / assets : null;
    factors.push({
      label: "Return on assets",
      metric: "Net income / total assets",
      value: roa,
      fmt: PCT_FMT,
      score:
        roa == null
          ? null
          : scoreBands(roa, [
              [-1, 20],
              [0.005, 45],
              [0.01, 65],
              [0.015, 85],
              [0.025, 100],
            ]),
      band: "<0.5% → 45 · 1% → 65 · 1.5% → 85 · ≥2.5% → 100",
    });
  } else {
    // 2. Returns on capital — NOPAT / (debt + equity).
    const capital = debt + num(equity);
    const roic = ebit != null && capital > 0 ? (ebit * (1 - taxRate)) / capital : null;
    factors.push({
      label: "Return on capital",
      metric: "ROIC = NOPAT / (debt + equity)",
      value: roic,
      fmt: PCT_FMT,
      score:
        roic == null
          ? null
          : scoreBands(roic, [
              [-1, 20],
              [0.05, 45],
              [0.1, 65],
              [0.15, 85],
              [0.25, 100],
            ]),
      band: "<5% → 45 · 10% → 65 · 15% → 85 · ≥25% → 100",
    });
  }

  // Cash conversion — free cash flow / net income (often sparse for banks).
  let fcf = val(a, "fcf");
  if (fcf == null) {
    const ocf = val(a, "ocf");
    const capex = val(a, "capex");
    if (ocf != null) fcf = ocf - Math.abs(num(capex));
  }
  const conversion = fcf != null && ni != null && ni > 0 ? fcf / ni : null;
  factors.push({
    label: "Cash conversion",
    metric: "Free cash flow / net income",
    value: conversion,
    fmt: MULT_FMT,
    score:
      conversion == null
        ? null
        : scoreBands(conversion, [
            [-10, 20],
            [0.4, 50],
            [0.7, 75],
            [0.9, 100],
          ]),
    band: "<0.4× → 50 · 0.7× → 75 · ≥0.9× → 100 (profit years only)",
  });

  if (financial) {
    // Leverage — debt / equity (EBITDA-based leverage is not meaningful).
    // Lower is better; missing debt scores as unlevered (full).
    const de =
      equity != null && equity > 0
        ? debt > 0
          ? debt / equity
          : 0
        : null;
    factors.push({
      label: "Leverage (D/E)",
      metric: "Total debt / shareholders' equity",
      value: de,
      fmt: MULT_FMT,
      score:
        de == null
          ? null
          : scoreBands(
              de,
              [
                [0.25, 100],
                [0.5, 85],
                [1, 70],
                [2, 50],
                [3, 30],
                [Infinity, 15],
              ],
              true
            ),
      band: "≤0.25× → 100 · ≤0.5× → 85 · ≤1× → 70 · ≤2× → 50 · >3× → 15",
    });
  } else {
    // Leverage — net debt / EBITDA (lower is better; net cash scores full).
    const da = num(val(a, "da"));
    const ebitda = ebit != null ? ebit + da : null;
    const cash = num(val(a, "cash"));
    const netDebt = debt - cash;
    const leverage = ebitda != null && ebitda > 0 ? netDebt / ebitda : null;
    factors.push({
      label: "Leverage",
      metric: "Net debt / EBITDA",
      value: leverage,
      fmt: MULT_FMT,
      score:
        leverage == null
          ? null
          : scoreBands(
              leverage,
              [
                [0, 100],
                [1, 90],
                [2, 75],
                [3, 55],
                [4, 35],
                [Infinity, 15],
              ],
              true
            ),
      band: "net cash → 100 · ≤1× → 90 · ≤2× → 75 · ≤3× → 55 · >4× → 15",
    });

    // Interest coverage — EBIT / interest (no interest scores full).
    const interest = Math.abs(num(val(a, "interestExpense")));
    const coverage =
      ebit != null && interest > 0 ? ebit / interest : ebit != null ? Infinity : null;
    factors.push({
      label: "Interest coverage",
      metric: "EBIT / interest expense",
      value:
        coverage != null && Number.isFinite(coverage)
          ? coverage
          : coverage == null
            ? null
            : 99,
      fmt: MULT_FMT,
      score:
        coverage == null
          ? null
          : !Number.isFinite(coverage)
            ? 100
            : scoreBands(coverage, [
                [0, 15],
                [2, 45],
                [4, 70],
                [8, 90],
                [15, 100],
              ]),
      band: "no debt → 100 · <2× → 15 · 4× → 70 · 8× → 90 · ≥15× → 100",
    });
  }

  const scored = factors.map((f) => f.score).filter((s): s is number => s != null);
  const composite = scored.length ? scored.reduce((x, y) => x + y, 0) / scored.length : null;
  const grade =
    composite == null
      ? "—"
      : composite >= 85
        ? "A"
        : composite >= 70
          ? "B"
          : composite >= 55
            ? "C"
            : composite >= 40
              ? "D"
              : "F";

  return { factors, composite, grade };
}

// --- sheet writer -----------------------------------------------------------

const scoreColor = (s: number) => (s >= 70 ? GREEN : s >= 45 ? AMBER : RED);

export function fillScorecardSheet(ws: ExcelJS.Worksheet, fin: CompanyFinancials, sc: Scorecard) {
  sheetHeader(
    ws,
    "Quality Scorecard",
    "Five dimensions an analyst reads first, scored on printed thresholds and averaged.",
    "A rules-based heuristic computed only from the statements — every band is shown. Not a rating and not investment advice.",
    ["Metric", "Value", "Score", "Bands"],
    NAVY,
    "Dimension"
  );

  let row = 6;
  const period = fin.annual.periods[0]?.label ?? "";
  ws.getCell(row, 1).value = `Latest fiscal year: ${period}`;
  ws.getCell(row, 1).font = { size: 10, italic: true, color: { argb: GREY } };
  row += 2;

  sectionRow(ws, row, "Factors", 4, NAVY);
  row++;
  for (const f of sc.factors) {
    const r = ws.getRow(row);
    r.getCell(1).value = f.label;
    r.getCell(1).font = { size: 10, bold: true };
    r.getCell(2).value = f.metric;
    r.getCell(2).font = { size: 9, color: { argb: MUTED } };
    const vc = r.getCell(3);
    if (f.value == null) {
      vc.value = "n/a";
      vc.font = { size: 10, color: { argb: MUTED }, italic: true };
    } else {
      vc.value = f.value;
      vc.numFmt = f.fmt;
      vc.font = { size: 10 };
    }
    const scCell = r.getCell(4);
    if (f.score == null) {
      scCell.value = "—";
      scCell.font = { size: 10, color: { argb: MUTED } };
    } else {
      scCell.value = f.score;
      scCell.numFmt = "0";
      scCell.font = { size: 10, bold: true, color: { argb: scoreColor(f.score) } };
    }
    r.getCell(5).value = f.band;
    r.getCell(5).font = { size: 8, italic: true, color: { argb: GREY } };
    row++;
  }

  // Data bar on the score column makes the profile scannable at a glance.
  const firstScoreRow = 10;
  const lastScoreRow = firstScoreRow + sc.factors.length - 1;
  ws.addConditionalFormatting({
    ref: `D${firstScoreRow}:D${lastScoreRow}`,
    rules: [
      {
        type: "dataBar",
        priority: 1,
        cfvo: [
          { type: "num", value: 0 },
          { type: "num", value: 100 },
        ],
        color: { argb: "FF93C5FD" },
      } as unknown as ExcelJS.ConditionalFormattingRule,
    ],
  });

  row++;
  sectionRow(ws, row, "Composite", 4, NAVY);
  row++;
  const cr = ws.getRow(row);
  cr.getCell(1).value = "Composite score (equal-weight average)";
  cr.getCell(1).font = { size: 10, bold: true };
  const cc = cr.getCell(4);
  if (sc.composite != null) {
    cc.value = Math.round(sc.composite);
    cc.numFmt = "0";
    cc.font = { size: 12, bold: true, color: { argb: scoreColor(sc.composite) } };
  } else {
    cc.value = "—";
  }
  row++;
  const gr = ws.getRow(row);
  gr.getCell(1).value = "Grade";
  gr.getCell(1).font = { size: 10, bold: true };
  const gc = gr.getCell(4);
  gc.value = sc.grade;
  gc.font = {
    size: 14,
    bold: true,
    color: { argb: sc.composite == null ? MUTED : scoreColor(sc.composite) },
  };
  row += 2;

  for (const t of [
    "Grade bands: A ≥ 85 · B ≥ 70 · C ≥ 55 · D ≥ 40 · F < 40, on the equal-weight average of the",
    "dimensions the filing supports (a missing factor is skipped, not scored zero).",
    "This is a transparent heuristic, not a rating or a recommendation. Read each band and form your own view.",
  ]) {
    const c = ws.getCell(row++, 1);
    c.value = t;
    c.font = { size: 9, italic: true, color: { argb: t.startsWith("This") ? INPUT_BLUE : GREY } };
  }

  sizeColumns(ws, 4, 34, 16);
  ws.getColumn(2).width = 34;
  ws.getColumn(5).width = 52;
}
