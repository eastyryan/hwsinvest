// Multi-company side-by-side Excel workbook for the Compare tab.
//
// Layout choice (documented for callers and Cover sheet):
//   - One wide "Annual" sheet: rows = metrics grouped like Compare (Income,
//     Balance, Cash Flow, Margins & Returns via STATEMENT_METRIC_GROUPS).
//   - Columns = company blocks × latest N annual periods (default 5). Each
//     company keeps its own fiscal-year labels — periods are not force-aligned
//     across filers (same as the Compare UI latest-period table).
//   - Values are hard-coded (no cross-sheet formulas). Money and share counts
//     in millions; per-share in units; ratios as decimals/multiples — matching
//     the single-company export scale conventions.
//   - Optional "Quarterly" sheet with the same shape and fewer periods.

import ExcelJS from "exceljs";
import type { CompanyFinancials, PeriodCol, StatementSet } from "./edgar";
import { buildRatios, type RatioSet } from "./ratios";
import {
  STATEMENT_METRIC_GROUPS,
  type MetricDef,
} from "./metric-catalog";
import {
  makeSheetNamer,
  sectionRow,
  sizeColumns,
  NAVY,
  SLATE,
  TEAL,
  GREY,
  MUTED,
  INPUT_BLUE,
  LIGHT_BAND,
  MONEY_FMT,
  PER_SHARE_FMT,
  SHARES_FMT,
  PCT_FMT,
  MULT_FMT,
} from "./excel-format";

/** Default annual history depth per company. */
export const COMPARE_ANNUAL_YEARS = 5;
/** Quarterly columns per company (roughly ~3 years). */
export const COMPARE_QUARTERLY_PERIODS = 12;
/** Hard cap matching Compare UI (base + up to 4 peers). */
export const COMPARE_MAX_COMPANIES = 5;

export interface CompareCompanyRef {
  cik: string;
  ticker: string;
}

function findLine(set: StatementSet, key: string) {
  for (const st of set.statements) {
    const l = st.lines.find((x) => x.key === key);
    if (l) return l;
  }
  return null;
}

function limitPeriods(set: StatementSet, n: number): StatementSet {
  if (set.periods.length <= n) return set;
  const periods = set.periods.slice(0, n);
  const keep = new Set(periods.map((p) => p.key));
  const prune = (r: Record<string, number | null>) =>
    Object.fromEntries(Object.entries(r).filter(([k]) => keep.has(k)));
  return {
    periods,
    statements: set.statements.map((st) => ({
      ...st,
      lines: st.lines.map((l) => ({
        ...l,
        values: prune(l.values),
        yoy: prune(l.yoy),
        qoq: prune(l.qoq),
      })),
    })),
  };
}

function metricNumFmt(m: MetricDef): string {
  if (m.format === "pct") return PCT_FMT;
  if (m.format === "x") return MULT_FMT;
  if (m.format === "perShare") return PER_SHARE_FMT;
  if (m.format === "shares") return SHARES_FMT;
  return MONEY_FMT;
}

/** Scale filed units into the workbook display unit (millions except per-share). */
function scaleValue(raw: number, m: MetricDef): number {
  if (m.format === "perShare" || m.format === "pct" || m.format === "x") return raw;
  return raw / 1e6;
}

function metricValue(
  fin: CompanyFinancials,
  set: StatementSet,
  ratios: RatioSet,
  m: MetricDef,
  period: PeriodCol | undefined
): number | null {
  if (!period) return null;
  if (m.kind === "line") {
    const line = findLine(set, m.key);
    const v = line?.values[period.key];
    return v == null ? null : scaleValue(v, m);
  }
  const line = ratios.lines.find((l) => l.key === m.key);
  const v = line?.values[period.key];
  return v ?? null;
}

interface CompanyBlock {
  fin: CompanyFinancials;
  set: StatementSet;
  ratios: RatioSet;
  periods: PeriodCol[];
  /** First Excel column (1-based) for this company's period block. */
  startCol: number;
}

function buildBlocks(
  companies: CompanyFinancials[],
  freq: "annual" | "quarterly",
  maxPeriods: number
): CompanyBlock[] {
  const blocks: CompanyBlock[] = [];
  let col = 2; // column 1 is the metric label
  for (const fin of companies) {
    const full = freq === "annual" ? fin.annual : fin.quarterly;
    const set = limitPeriods(full, maxPeriods);
    const ratios = buildRatios(
      {
        ...fin,
        annual: freq === "annual" ? set : fin.annual,
        quarterly: freq === "quarterly" ? set : fin.quarterly,
      },
      freq
    );
    // Align ratio periods to the same capped axis (buildRatios uses full set
    // periods when we pass the limited set above).
    blocks.push({
      fin,
      set,
      ratios,
      periods: set.periods,
      startCol: col,
    });
    col += Math.max(1, set.periods.length);
  }
  return blocks;
}

function fillCompareSheet(
  ws: ExcelJS.Worksheet,
  companies: CompanyFinancials[],
  freq: "annual" | "quarterly",
  maxPeriods: number
) {
  const blocks = buildBlocks(companies, freq, maxPeriods);
  const totalDataCols = Math.max(
    1,
    blocks.reduce((n, b) => n + Math.max(1, b.periods.length), 0)
  );
  const freqLabel = freq === "annual" ? "Annual" : "Quarterly";
  const depthNote =
    freq === "annual"
      ? `Latest ${maxPeriods} fiscal years per company`
      : `Latest ${maxPeriods} fiscal quarters per company`;

  const currencies = [...new Set(companies.map((c) => c.currency || "USD"))];
  const mixed = currencies.length > 1;

  // Title band
  ws.mergeCells(1, 1, 1, totalDataCols + 1);
  const t = ws.getCell(1, 1);
  t.value = `Compare — ${freqLabel}`;
  t.font = { bold: true, size: 14, color: { argb: NAVY } };

  ws.getCell(2, 1).value = companies.map((c) => c.ticker).join(" · ");
  ws.getCell(2, 1).font = { italic: true, size: 10, color: { argb: GREY } };

  ws.getCell(3, 1).value =
    `${depthNote}. Money and share counts in millions; per-share in units; ` +
    `margins/returns as % or multiples. ` +
    (mixed
      ? `Mixed reporting currencies (${currencies.join(", ")}) — values as filed, no FX conversion.`
      : `Reporting currency: ${currencies[0]}.`) +
    ` Columns are company blocks × that company's own periods (not calendar-aligned).`;
  ws.getCell(3, 1).font = { italic: true, size: 9, color: { argb: GREY } };

  // Row 4: company tickers (merged across each company's period columns)
  // Row 5: period labels
  const companyRow = ws.getRow(4);
  const periodRow = ws.getRow(5);
  companyRow.getCell(1).value = "Metric";
  periodRow.getCell(1).value = "";
  for (const b of blocks) {
    const span = Math.max(1, b.periods.length);
    const endCol = b.startCol + span - 1;
    if (span > 1) {
      ws.mergeCells(4, b.startCol, 4, endCol);
    }
    const cCell = companyRow.getCell(b.startCol);
    cCell.value = `${b.fin.ticker} (${b.fin.currency || "USD"})`;
    cCell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
    cCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: NAVY },
    };
    cCell.alignment = { horizontal: "center" };
    for (let c = b.startCol; c <= endCol; c++) {
      const cell = companyRow.getCell(c);
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: NAVY },
      };
      cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
      cell.alignment = { horizontal: "center" };
    }

    if (b.periods.length === 0) {
      const pCell = periodRow.getCell(b.startCol);
      pCell.value = "no data";
      pCell.font = { italic: true, size: 9, color: { argb: MUTED } };
      pCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: SLATE },
      };
    } else {
      b.periods.forEach((p, i) => {
        const pCell = periodRow.getCell(b.startCol + i);
        pCell.value = p.label;
        pCell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 9 };
        pCell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: SLATE },
        };
        pCell.alignment = { horizontal: "right" };
      });
    }
  }
  companyRow.getCell(1).font = {
    bold: true,
    color: { argb: "FFFFFFFF" },
    size: 10,
  };
  companyRow.getCell(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: NAVY },
  };
  companyRow.getCell(1).alignment = { horizontal: "left" };
  periodRow.getCell(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: SLATE },
  };

  let row = 6;
  for (const group of STATEMENT_METRIC_GROUPS) {
    sectionRow(ws, row, group.label, totalDataCols, TEAL);
    row++;

    for (const m of group.metrics) {
      const r = ws.getRow(row);
      r.getCell(1).value = m.label;
      r.getCell(1).font = { size: 10 };
      if (row % 2 === 0) {
        r.getCell(1).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: LIGHT_BAND },
        };
      }

      const fmt = metricNumFmt(m);
      for (const b of blocks) {
        const span = Math.max(1, b.periods.length);
        if (b.periods.length === 0) {
          const cell = r.getCell(b.startCol);
          cell.value = "—";
          cell.font = { size: 10, color: { argb: MUTED } };
          if (row % 2 === 0) {
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: LIGHT_BAND },
            };
          }
          continue;
        }
        for (let i = 0; i < span; i++) {
          const p = b.periods[i];
          const cell = r.getCell(b.startCol + i);
          const v = metricValue(b.fin, b.set, b.ratios, m, p);
          if (v != null) {
            cell.value = v;
            cell.numFmt = fmt;
            cell.font = { size: 10, color: { argb: INPUT_BLUE } };
          } else {
            cell.value = null;
            cell.font = { size: 10, color: { argb: MUTED } };
          }
          if (row % 2 === 0) {
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: LIGHT_BAND },
            };
          }
        }
      }
      row++;
    }
  }

  sizeColumns(ws, totalDataCols, 34, 12);
  ws.views = [{ state: "frozen", xSplit: 1, ySplit: 5 }];
}

function fillCover(ws: ExcelJS.Worksheet, companies: CompanyFinancials[], retrieved: string) {
  ws.getCell(1, 1).value = "Company comparison";
  ws.getCell(1, 1).font = { bold: true, size: 16, color: { argb: NAVY } };
  ws.getCell(2, 1).value = "Side-by-side annual (and quarterly) metrics";
  ws.getCell(2, 1).font = { italic: true, size: 10, color: { argb: GREY } };
  ws.getCell(3, 1).value = `Retrieved ${retrieved}`;
  ws.getCell(3, 1).font = { size: 9, color: { argb: GREY } };

  ws.getCell(5, 1).value = "Companies";
  ws.getCell(5, 1).font = { bold: true, size: 11, color: { argb: NAVY } };
  ws.getCell(6, 1).value = "Ticker";
  ws.getCell(6, 2).value = "Name";
  ws.getCell(6, 3).value = "CIK";
  ws.getCell(6, 4).value = "Currency";
  ws.getCell(6, 5).value = "Latest annual";
  for (let c = 1; c <= 5; c++) {
    const cell = ws.getCell(6, c);
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: NAVY },
    };
  }
  companies.forEach((fin, i) => {
    const r = 7 + i;
    ws.getCell(r, 1).value = fin.ticker;
    ws.getCell(r, 2).value = fin.name;
    ws.getCell(r, 3).value = fin.cik;
    ws.getCell(r, 4).value = fin.currency || "USD";
    ws.getCell(r, 5).value = fin.annual.periods[0]?.label ?? "—";
  });

  const noteRow = 8 + companies.length;
  ws.getCell(noteRow, 1).value = "Sheet layout";
  ws.getCell(noteRow, 1).font = { bold: true, size: 11, color: { argb: NAVY } };
  ws.getCell(noteRow + 1, 1).value =
    `Annual: metrics as rows (same catalog as Compare — Income, Balance, Cash Flow, Margins & Returns). ` +
    `Columns are company blocks, each with the latest ${COMPARE_ANNUAL_YEARS} fiscal years for that filer. ` +
    `Quarterly uses the same metric rows with the latest ${COMPARE_QUARTERLY_PERIODS} quarters. ` +
    `Ratios use buildRatios (annual / TTM-aware quarterly). Values are as filed with no FX conversion.`;
  ws.getCell(noteRow + 1, 1).font = { size: 9, color: { argb: GREY } };
  ws.mergeCells(noteRow + 1, 1, noteRow + 3, 5);

  sizeColumns(ws, 4, 18, 22);
  ws.getColumn(2).width = 36;
}

/**
 * Build a multi-ticker compare workbook from already-loaded financials.
 */
export function buildCompareWorkbook(companies: CompanyFinancials[]): ExcelJS.Workbook {
  if (companies.length === 0) {
    throw new Error("At least one company is required.");
  }
  if (companies.length > COMPARE_MAX_COMPANIES) {
    throw new Error(`At most ${COMPARE_MAX_COMPANIES} companies per export.`);
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = "Financial Statements";
  wb.created = new Date();

  const sheetName = makeSheetNamer();
  const cover = wb.addWorksheet(sheetName("Cover"));
  const annual = wb.addWorksheet(sheetName("Annual"));
  const quarterly = wb.addWorksheet(sheetName("Quarterly"));

  const retrieved = new Date().toISOString().slice(0, 10);
  fillCover(cover, companies, retrieved);
  fillCompareSheet(annual, companies, "annual", COMPARE_ANNUAL_YEARS);
  fillCompareSheet(quarterly, companies, "quarterly", COMPARE_QUARTERLY_PERIODS);

  for (const ws of wb.worksheets) {
    ws.pageSetup = {
      ...ws.pageSetup,
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: {
        left: 0.4,
        right: 0.4,
        top: 0.6,
        bottom: 0.6,
        header: 0.3,
        footer: 0.3,
      },
      ...(ws.name === cover.name ? {} : { printTitlesRow: "1:5" }),
    };
    ws.headerFooter = { oddFooter: "&L&F&C&A&R&P of &N" };
  }

  return wb;
}
