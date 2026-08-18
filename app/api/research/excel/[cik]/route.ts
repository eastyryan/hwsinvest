import ExcelJS from "exceljs";
import { getCompanyFinancials, getSecProfile, InvalidCikError, NoFactsError } from "@/lib/research/edgar";
import { sectorBeta } from "@/lib/research/dcf-sector";
import { getLatestQuote } from "@/lib/research/prices";
import type {
  StatementSet,
  Statement,
  CompanyFinancials,
  PeriodCol,
} from "@/lib/research/edgar";
import { buildRatios } from "@/lib/research/ratios";
import { publicErrorMessage } from "@/lib/research/http";
import { isValidCik, isValidTicker, safeFilename } from "@/lib/research/validate";
import { reconcilesExactly } from "@/lib/research/reconcile";
import { createGate } from "@/lib/research/concurrency";
import {
  buildProjection,
  buildRevenueGrowthPath,
  fillAssumptionsSheet,
  fillSchedulesSheet,
  fillProjectionsSheet,
  historicalRevenueGrowth,
  PROJECTION_YEARS,
  type Assumptions,
} from "@/lib/research/excel-projection";
import { buildDcf, fillDcfSheet, type DcfInputs } from "@/lib/research/excel-dcf";
import { getStreetEstimates } from "@/lib/research/street-estimates";
import { fillSourcesSheet } from "@/lib/research/excel-sources";
import { buildScorecard, fillScorecardSheet } from "@/lib/research/excel-scorecard";
import { detectSectorMode, type SectorMode } from "@/lib/research/sector-mode";
import { getPriceSeries } from "@/lib/research/prices";
import {
  fillValuationSuite,
  valuationSheetBlurb,
} from "@/lib/research/excel-models/suite";
import {
  colLetter,
  lineScale,
  makeSheetNamer,
  moneyFormat,
  quoteSheet,
  safeDiv,
  setFormula,
  sheetHeader,
  sizeColumns,
  NAVY,
  LIGHT_BAND,
  SLATE,
  INPUT_BLUE,
  GREEN,
  AMBER,
  RED,
  MUTED,
  GREY,
  MONEY_FMT,
  PCT_FMT,
  SIGNED_PCT_FMT,
  MULT_FMT,
} from "@/lib/research/excel-format";

export const maxDuration = 60;

/**
 * Workbook builds are the heaviest thing this app does: ~17 MB of heap and
 * ~21 MB of RSS each, held for the duration of the build, and Fluid Compute
 * runs concurrent invocations on one shared heap. Unbounded, that reaches an
 * OOM kill at roughly 37 simultaneous builds on a 1 GB function — and an OOM
 * takes down every request the instance is serving, not just the excess.
 *
 * Six keeps peak well inside the smallest plausible instance while still
 * absorbing an ordinary burst. Requests that cannot get a slot within a few
 * seconds are turned away with a 503 and a Retry-After rather than queued into
 * the function's own timeout.
 */
const buildGate = createGate(6);
const GATE_WAIT_MS = 4_000;

/**
 * Columns per statement, unless `?all=1`.
 *
 * The period axis grows forever: every filer since the 2009 XBRL mandate,
 * ~4 more quarterly columns a year, with no ceiling. Apple is already at 72
 * quarterly columns and each one multiplies through 6 statement sheets twice
 * over. Twelve years of history is more than any reader scrolls to, and the
 * cap roughly halves peak memory.
 */
const MAX_ANNUAL_COLS = 12;
const MAX_QUARTERLY_COLS = 40;

/** Trim a statement set to its most recent `n` periods. */
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

// --- formula plumbing -------------------------------------------------------
//
// The workbook used to be a screenshot: every cell a literal number, so nothing
// recalculated and nothing could be audited. Anything that is *derived* rather
// than *reported* is now a real Excel formula pointing at the cells it comes
// from — change a revenue figure and the margins, YoY rows, and ratio sheet all
// follow.
//
// Reported line items stay literal. They are what the company filed; inventing
// a formula for them would imply a relationship the filing doesn't assert.

/** Where a statement line's value row landed, so other cells can reference it. */
interface CellRef {
  sheet: string;
  row: number;
}
type Registry = Map<string, CellRef>;

function ref(cell: CellRef, periodIndex: number, sameSheet: string | null): string {
  const addr = `${colLetter(periodIndex + 2)}${cell.row}`;
  return cell.sheet === sameSheet ? addr : `${quoteSheet(cell.sheet)}!${addr}`;
}

function lookup(
  reg: Registry,
  key: string,
  periodIndex: number,
  sameSheet: string | null
): string | null {
  const c = reg.get(key);
  return c ? ref(c, periodIndex, sameSheet) : null;
}

/**
 * Subtotals that are definitionally the sum of other rows on the same sheet.
 *
 * These are accounting identities, but a filing's reported subtotal only equals
 * the sum of the lines *we capture*. Real statements carry components this line
 * set doesn't model — other current assets, prepaid expenses, non-operating
 * income, deferred taxes, minority interest. Each cell is therefore reconciled
 * against the filed figure before becoming a formula (see the caller); where it
 * doesn't tie, the filed number stays and the Model Checks sheet reports the
 * unexplained residual rather than hiding it.
 */
const DERIVED_LINES: Record<string, { plus: string[]; minus: string[] }> = {
  // Income statement
  grossProfit: { plus: ["revenue"], minus: ["cogs"] },
  opex: { plus: ["rd", "sga", "salesMarketing", "ga"], minus: [] },
  operatingIncome: { plus: ["grossProfit"], minus: ["opex"] },
  pretaxIncome: { plus: ["operatingIncome"], minus: ["interestExpense"] },
  netIncome: { plus: ["pretaxIncome"], minus: ["taxes"] },

  // Balance sheet
  currentAssets: {
    plus: ["cash", "stInvestments", "receivables", "inventory"],
    minus: [],
  },
  totalAssets: {
    plus: ["currentAssets", "ppe", "goodwill", "intangibles"],
    minus: [],
  },
  totalLiabilities: { plus: ["currentLiabilities", "ltDebt"], minus: [] },

  // Cash flow. Capex, buybacks and dividends are stored negative (flipSign),
  // so these are sums rather than differences.
  fcf: { plus: ["ocf", "capex"], minus: [] },
  netChangeInCash: { plus: ["ocf", "icf", "fincf"], minus: [] },
};

function daysApart(a: string, b: string): number {
  return Math.abs(
    (new Date(b).getTime() - new Date(a).getTime()) / 86_400_000
  );
}

// --- statement sheets -------------------------------------------------------
//
// Each statement is rendered twice, which is the standard way a financial model
// is laid out:
//
//   Data sheet        Every figure hard-coded exactly as filed, including the
//                     YoY and QoQ percentages. No formulas at all. This is the
//                     source layer, and the only place a number originates.
//
//   Calculation sheet The same statement rebuilt entirely from formulas. Values
//                     link back to the data sheet, subtotals compute from the
//                     lines above them, and every change row is a real
//                     percentage calculation. Nothing on this sheet is typed in.
//
// The split is what makes the workbook auditable: you can see at a glance which
// figures came from the filing and which were computed, and editing a figure on
// a data sheet flows through the calculation sheet, the ratios, and the checks.
//
// Font colour follows the convention used in financial models: blue is a
// hard-coded input, black is a formula.

/** Rows per line item: value, YoY, and QoQ when quarterly. */
const rowsPerLine = (quarterly: boolean) => (quarterly ? 3 : 2);

/**
 * Row positions are deterministic, so they can be computed before a sheet is
 * written. That lets every worksheet be created up front in reading order —
 * calculations first, source data behind them — while still being populated in
 * dependency order.
 */
function statementRowMap(statement: Statement, quarterly: boolean): Map<string, number> {
  const m = new Map<string, number>();
  statement.lines.forEach((line, idx) => {
    m.set(line.key, 5 + idx * rowsPerLine(quarterly));
  });
  return m;
}

const writeHeader = (
  ws: ExcelJS.Worksheet,
  title: string,
  subtitle: string,
  note: string,
  periods: PeriodCol[],
  accent: string
) => sheetHeader(ws, title, subtitle, note, periods.map((p) => p.label), accent);

const sizePeriodColumns = (ws: ExcelJS.Worksheet, periods: PeriodCol[], firstWidth = 34) =>
  sizeColumns(ws, periods.length, firstWidth, 13);

/**
 * A statement with no captured lines, or a filer with no periods of that
 * frequency, still gets its sheet — the workbook's shape is fixed — so say why
 * it is empty instead of leaving a bare header.
 */
function noteIfEmpty(ws: ExcelJS.Worksheet, statement: Statement, periods: PeriodCol[]) {
  if (statement.lines.length > 0 && periods.length > 0) return false;
  const c = ws.getCell(5, 1);
  c.value =
    periods.length === 0
      ? "No periods of this frequency were filed."
      : "No lines from this statement were tagged in a form this workbook recognises.";
  c.font = { italic: true, size: 10, color: { argb: MUTED } };
  return true;
}

/**
 * The source layer: every cell a literal, exactly as filed. No formulas, so
 * nothing here can recalculate into something the filing didn't say.
 */
function fillDataSheet(
  ws: ExcelJS.Worksheet,
  statement: Statement,
  set: StatementSet,
  quarterly: boolean,
  currency: string
) {
  const periods = set.periods;
  writeHeader(
    ws,
    `${statement.title} — source data`,
    quarterly ? "Quarterly · as filed" : "Annual · as filed",
    `${currency} and share counts in millions, except per-share amounts. Every figure on this sheet is hard-coded from SEC filings.`,
    periods,
    SLATE
  );
  if (noteIfEmpty(ws, statement, periods)) {
    sizePeriodColumns(ws, periods);
    return;
  }

  let r = 5;
  for (const line of statement.lines) {
    const fmt = moneyFormat(line);
    const scale = lineScale(line);
    const strong = line.style !== "normal";

    const valRow = ws.getRow(r);
    valRow.getCell(1).value = (line.indent ? "    " : "") + line.label;
    valRow.getCell(1).font = { bold: strong, size: 10 };
    periods.forEach((p, i) => {
      const v = line.values[p.key];
      const cell = valRow.getCell(i + 2);
      if (v != null) {
        cell.value = v / scale;
        cell.numFmt = fmt;
      }
      cell.font = { bold: strong, size: 10, color: { argb: INPUT_BLUE } };
    });
    r++;

    const pctRow = (label: string, stored: Record<string, number | null>) => {
      const row = ws.getRow(r);
      row.getCell(1).value = (line.indent ? "    " : "  ") + label;
      row.getCell(1).font = { italic: true, size: 8, color: { argb: MUTED } };
      periods.forEach((p, i) => {
        const v = stored[p.key];
        const cell = row.getCell(i + 2);
        if (v != null) {
          cell.value = v;
          cell.numFmt = SIGNED_PCT_FMT;
        }
        cell.font = { italic: true, size: 8, color: { argb: INPUT_BLUE } };
      });
      r++;
    };

    pctRow("% change YoY", line.yoy);
    if (quarterly) pctRow("% change QoQ", line.qoq);
  }

  sizePeriodColumns(ws, periods);
}

/**
 * The calculation layer: every cell a formula, nothing typed in.
 *
 * Reported lines link straight to the data sheet — there is nothing to compute
 * for a figure the company stated. Subtotals compute from the lines above them
 * where they reconcile exactly; where they don't, they link to the data sheet
 * instead so the workbook still shows what was filed. Change rows are real
 * percentage calculations off this sheet's own value rows.
 */
function fillFormulaSheet(
  ws: ExcelJS.Worksheet,
  statement: Statement,
  set: StatementSet,
  quarterly: boolean,
  currency: string,
  dataSheet: string,
  registry: Registry,
  sheetName: string
) {
  const periods = set.periods;
  const rows = statementRowMap(statement, quarterly);

  writeHeader(
    ws,
    statement.title,
    quarterly ? "Quarterly · calculated" : "Annual · calculated",
    `${currency} and share counts in millions, except per-share amounts. Every cell is a formula; source figures live on "${dataSheet}".`,
    periods,
    NAVY
  );
  if (noteIfEmpty(ws, statement, periods)) {
    sizePeriodColumns(ws, periods);
    return;
  }

  let r = 5;
  for (const line of statement.lines) {
    const fmt = moneyFormat(line);
    const scale = lineScale(line);
    const strong = line.style !== "normal";
    const derived = DERIVED_LINES[line.key];

    const valRow = ws.getRow(r);
    valRow.getCell(1).value = (line.indent ? "    " : "") + line.label;
    valRow.getCell(1).font = { bold: strong, size: 10 };

    periods.forEach((p, i) => {
      const v = line.values[p.key];
      const cell = valRow.getCell(i + 2);
      cell.font = { bold: strong, size: 10 };
      if (strong) {
        cell.border = { top: { style: "thin", color: { argb: NAVY } } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: LIGHT_BAND } };
      }
      if (v == null) return;

      const col = colLetter(i + 2);
      const dataRef = `${quoteSheet(dataSheet)}!${col}${rows.get(line.key)}`;

      // A subtotal becomes a computed formula only when its components are
      // present and sum exactly to the filed figure. Excel recalculates on
      // open, so an approximate formula would quietly replace a reported
      // number with a different one.
      let expr = dataRef;
      if (derived) {
        const parts = [
          ...derived.plus.map((k) => ({ sign: "+", k })),
          ...derived.minus.map((k) => ({ sign: "-", k })),
        ];
        const resolvable = parts.every((part) => rows.has(part.k));
        if (resolvable) {
          let sum = 0;
          let complete = true;
          for (const part of parts) {
            const src = statement.lines.find((l) => l.key === part.k)?.values[p.key];
            if (src == null) {
              complete = false;
              break;
            }
            sum += part.sign === "+" ? src : -src;
          }
          if (complete && reconcilesExactly(sum, v)) {
            expr = parts
              .map((part, idx) => {
                const addr = `${col}${rows.get(part.k)}`;
                return idx === 0 ? addr : `${part.sign}${addr}`;
              })
              .join("");
          }
        }
      }

      setFormula(cell, expr, v / scale, fmt);
    });

    registry.set(line.key, { sheet: sheetName, row: r });
    const valueRow = r;
    r++;

    /**
     * Change rows reference this sheet's own value row, so the arithmetic is
     * visible. The comparison column is a fixed offset back and is only used
     * when that column really is one period earlier — the app matches the
     * nearest period within a tolerance, which can pick a different base where
     * a filer's history has gaps. In that case the cell links to the data
     * sheet's stored percentage rather than baking in a misleading reference.
     */
    const changeRow = (
      label: string,
      offset: number,
      minDays: number,
      maxDays: number,
      stored: Record<string, number | null>,
      storedRowOffset: number
    ) => {
      const row = ws.getRow(r);
      row.getCell(1).value = (line.indent ? "    " : "  ") + label;
      row.getCell(1).font = { italic: true, size: 8, color: { argb: MUTED } };
      periods.forEach((p, i) => {
        const cell = row.getCell(i + 2);
        const base = periods[i + offset];
        const curVal = line.values[p.key];
        const baseVal = base ? line.values[base.key] : null;
        const spanOk =
          base != null &&
          daysApart(base.end, p.end) >= minDays &&
          daysApart(base.end, p.end) <= maxDays;

        if (spanOk && curVal != null && baseVal != null && baseVal !== 0) {
          const cur = `${colLetter(i + 2)}${valueRow}`;
          const prev = `${colLetter(i + 2 + offset)}${valueRow}`;
          const shown = (curVal - baseVal) / Math.abs(baseVal);
          setFormula(
            cell,
            `IFERROR((${cur}-${prev})/ABS(${prev}),"")`,
            shown,
            SIGNED_PCT_FMT
          );
          cell.font = {
            italic: true,
            size: 8,
            color: { argb: shown >= 0 ? GREEN : RED },
          };
          return;
        }

        const v = stored[p.key];
        if (v != null) {
          const addr = `${quoteSheet(dataSheet)}!${colLetter(i + 2)}${
            (rows.get(line.key) as number) + storedRowOffset
          }`;
          setFormula(cell, addr, v, SIGNED_PCT_FMT);
          cell.font = {
            italic: true,
            size: 8,
            color: { argb: v >= 0 ? GREEN : RED },
          };
        }
      });
      r++;
    };

    changeRow("% change YoY", quarterly ? 4 : 1, 300, 430, line.yoy, 1);
    if (quarterly) changeRow("% change QoQ", 1, 60, 130, line.qoq, 2);
  }

  ws.getCell(r + 1, 1).value =
    "Every cell above is a formula. Blue figures on the source sheet are the only hard-coded inputs.";
  ws.getCell(r + 1, 1).font = { italic: true, size: 9, color: { argb: GREY } };

  sizePeriodColumns(ws, periods);
}


function fillRatiosSheet(
  ws: ExcelJS.Worksheet,
  fin: CompanyFinancials,
  registry: Registry,
  mode: SectorMode = "standard"
) {
  const ratios = buildRatios(fin, "annual", mode);

  ws.mergeCells(1, 1, 1, Math.max(2, ratios.periods.length + 1));
  ws.getCell(1, 1).value = "Ratios & Returns";
  ws.getCell(1, 1).font = { bold: true, size: 14, color: { argb: NAVY } };
  ws.getCell(2, 1).value = "Annual";
  ws.getCell(2, 1).font = { italic: true, size: 10, color: { argb: GREY } };

  const headerRow = ws.getRow(4);
  headerRow.getCell(1).value = "Ratio";
  ratios.periods.forEach((p, i) => {
    headerRow.getCell(i + 2).value = p.label;
  });
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
    cell.alignment = { horizontal: "right" };
  });
  headerRow.getCell(1).alignment = { horizontal: "left" };

  // Every ratio here is definitionally a calculation, so each one is a formula
  // pointing back at the annual statement sheets. In annual mode buildRatios
  // uses the statement period axis unchanged, so ratio column i and statement
  // column i are the same period.
  //
  // `i` is the period index; `prior` is the same line one year earlier, used by
  // the return ratios, which divide a flow by an average balance.
  const F = (key: string, i: number) => lookup(registry, key, i, null);

  /** Underlying value, used to pick which formula branch to write. */
  const rawAnnual = (key: string, i: number): number | null => {
    const p = ratios.periods[i];
    if (!p) return null;
    for (const st of fin.annual.statements) {
      const l = st.lines.find((x) => x.key === key);
      if (l) return l.values[p.key] ?? null;
    }
    return null;
  };

  /**
   * Only the debt classes this period actually reports.
   *
   * A missing side is a genuine zero — filers omit the line when they carry
   * none of that class — and a reference to the resulting blank cell would
   * evaluate to zero too, so the arithmetic was never wrong. It sent anyone
   * tracing the precedents to an empty cell, though, which is the sort of thing
   * that makes a reader doubt the rest of the sheet.
   */
  const totalDebt = (i: number): string | null => {
    const parts = (["ltDebt", "stDebt"] as const)
      .filter((k) => rawAnnual(k, i) != null)
      .map((k) => F(k, i))
      .filter((x): x is string => x !== null);
    return parts.length ? parts.join("+") : null;
  };

  /**
   * Average of a balance line across this period and the prior one.
   *
   * Mirrors avgGetter in lib/ratios.ts exactly, including its edge case: when
   * the *current* period has no value the average is null (and the caller
   * treats the term as zero), even if the prior period does have one. Excel's
   * AVERAGE ignores blanks, so `AVERAGE(blank, prior)` would instead return the
   * prior value — a divergence that showed up as a wrong ROIC for filers with a
   * gap in their debt lines.
   */
  const avg = (key: string, i: number): string | null => {
    if (rawAnnual(key, i) == null) return null;
    const now = F(key, i);
    if (!now) return null;
    const priorHasValue =
      i + 1 < ratios.periods.length && rawAnnual(key, i + 1) != null;
    return priorHasValue ? `AVERAGE(${now},${F(key, i + 1)})` : now;
  };

  const FORMULAS: Record<string, (i: number) => string | null> = {
    grossMargin: (i) => bin(F("grossProfit", i), F("revenue", i)),
    opMargin: (i) => bin(F("operatingIncome", i), F("revenue", i)),
    netMargin: (i) => bin(F("netIncome", i), F("revenue", i)),
    fcfMargin: (i) => bin(F("fcf", i), F("revenue", i)),
    rdPct: (i) => bin(F("rd", i), F("revenue", i)),
    currentRatio: (i) => bin(F("currentAssets", i), F("currentLiabilities", i)),
    roe: (i) => bin(F("netIncome", i), avg("equity", i)),
    roa: (i) => bin(F("netIncome", i), avg("totalAssets", i)),
    debtToEquity: (i) => {
      const d = totalDebt(i);
      return d ? bin(`(${d})`, F("equity", i)) : null;
    },
    roic: (i) => {
      // NOPAT over invested capital.
      //
      // buildRatios uses an after-tax operating profit when operating income,
      // pre-tax income and taxes are all present and pre-tax is non-zero, and
      // otherwise falls back to net income outright. Which branch applies is
      // decided here from the values, and only that branch's formula is
      // written. Guarding the division alone was not equivalent: where the
      // fallback applied, the formula recalculated to zero (or an error) while
      // the cached value carried the net-income figure.
      const eq = avg("equity", i);
      if (!eq) return null;
      const lt = avg("ltDebt", i);
      const st = avg("stDebt", i);
      const debtParts = [lt, st].filter(Boolean);
      const capital = debtParts.length ? `(${eq}+${debtParts.join("+")})` : eq;

      const opV = rawAnnual("operatingIncome", i);
      const ptV = rawAnnual("pretaxIncome", i);
      const txV = rawAnnual("taxes", i);
      const useNopat = opV != null && ptV != null && txV != null && ptV !== 0;

      if (useNopat) {
        const op = F("operatingIncome", i);
        const pretax = F("pretaxIncome", i);
        const tax = F("taxes", i);
        if (!op || !pretax || !tax) return null;
        return bin(`(${op}*(1-${tax}/${pretax}))`, capital);
      }
      return bin(F("netIncome", i), capital);
    },
  };

  let r = 5;
  let anyFormula = false;
  for (const line of ratios.lines) {
    const row = ws.getRow(r);
    row.getCell(1).value = line.label;
    row.getCell(1).font = { size: 10 };
    const fmt = line.format === "pct" ? PCT_FMT : MULT_FMT;
    ratios.periods.forEach((p, i) => {
      const v = line.values[p.key];
      const cell = row.getCell(i + 2);
      const formula = FORMULAS[line.key]?.(i) ?? null;
      if (formula && v != null) {
        setFormula(cell, formula, v, fmt);
        cell.font = { size: 10 };
        anyFormula = true;
      } else if (v != null) {
        cell.value = v;
        cell.numFmt = fmt;
        cell.font = { size: 10 };
      } else {
        cell.font = { size: 10 };
      }
    });
    r++;
  }

  if (anyFormula) {
    ws.getCell(r + 1, 1).value =
      "Every ratio is a formula referencing the calculated statement sheets.";
    ws.getCell(r + 1, 1).font = { italic: true, size: 9, color: { argb: GREY } };
  }

  ws.getColumn(1).width = 30;
  for (let c = 2; c <= ratios.periods.length + 1; c++) ws.getColumn(c).width = 11;
}

/** Division formula, or null when either side is unavailable. */
function bin(num: string | null, den: string | null): string | null {
  return num && den ? safeDiv(num, den) : null;
}

/**
 * Model Checks — the articulation tests that make this a linked model rather
 * than three separate tables.
 *
 * Each row is a residual: the accounting identity rearranged to equal zero. A
 * residual of zero means the statements tie. A non-zero residual is not
 * necessarily an error — it is the part of the identity that the line items we
 * capture don't explain, and naming that gap is more useful than hiding it.
 *
 * Two distinct causes produce a residual, and they are worth telling apart:
 *
 *   Coverage. This line set models the major captions, not every caption. Real
 *   balance sheets carry prepaid expenses, other current assets, deferred tax
 *   liabilities and more; real cash flow statements carry FX effects,
 *   acquisitions, and deferred taxes. Sums over a subset legitimately fall
 *   short of the reported total.
 *
 *   Timing and definition. Cash on the balance sheet may exclude restricted
 *   cash that the change-in-cash line includes; D&A on the cash flow statement
 *   covers amortization of intangibles that never touched PP&E.
 *
 * Note these are historical identities. The same formulas are also the
 * mechanics of a forecast model, but there they are *drivers* — you assume a
 * capex figure and the roll-forward produces the next PP&E balance. Here the
 * balances are all reported, so the roll-forward is a test, not a projection.
 */
function fillChecksSheet(
  ws: ExcelJS.Worksheet,
  fin: CompanyFinancials,
  registry: Registry
) {
  const set = fin.annual;
  const periods = set.periods;

  ws.mergeCells(1, 1, 1, Math.max(2, periods.length + 1));
  ws.getCell(1, 1).value = "Model Checks — statement articulation";
  ws.getCell(1, 1).font = { bold: true, size: 14, color: { argb: NAVY } };
  ws.getCell(2, 1).value =
    `Annual. Each row restates an accounting identity as a residual, in ${fin.currency} millions. Zero means the statements tie.`;
  ws.getCell(2, 1).font = { italic: true, size: 10, color: { argb: GREY } };

  if (periods.length === 0) {
    const c = ws.getCell(4, 1);
    c.value = "No annual periods were filed, so there is nothing to reconcile.";
    c.font = { italic: true, size: 10, color: { argb: MUTED } };
    ws.getColumn(1).width = 60;
    return;
  }

  const headerRow = ws.getRow(4);
  headerRow.getCell(1).value = "Check";
  periods.forEach((p, i) => {
    headerRow.getCell(i + 2).value = p.label;
  });
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
    cell.alignment = { horizontal: "right" };
  });
  headerRow.getCell(1).alignment = { horizontal: "left" };

  // Value lookup mirroring the formula references, so each cell carries a
  // cached result for viewers that don't recalculate.
  const raw = (key: string, i: number): number | null => {
    const p = periods[i];
    if (!p) return null;
    for (const st of set.statements) {
      const l = st.lines.find((x) => x.key === key);
      if (l) return l.values[p.key] ?? null;
    }
    return null;
  };
  const A = (key: string, i: number) => lookup(registry, key, i, null);

  interface Check {
    label: string;
    note: string;
    /** Terms as [sign, lineKey, periodOffset]. Summed to form the residual. */
    terms: [1 | -1, string, number][];
  }

  const CHECKS: Check[] = [
    {
      label: "Assets less Liabilities + Equity",
      note: "The core identity. A residual means captions we don't capture, most often minority interest.",
      terms: [
        [1, "totalAssets", 0],
        [-1, "totalLiabilities", 0],
        [-1, "equity", 0],
      ],
    },
    {
      label: "EBITDA less (Operating Income + D&A)",
      note: "Ties the income statement to the cash flow statement. Zero by construction.",
      terms: [
        [1, "ebitda", 0],
        [-1, "operatingIncome", 0],
        [-1, "da", 0],
      ],
    },
    {
      label: "Cash roll-forward",
      note: "Prior cash + net change less current cash. Residual usually means restricted cash or FX effects.",
      terms: [
        [1, "cash", 1],
        [1, "netChangeInCash", 0],
        [-1, "cash", 0],
      ],
    },
    {
      label: "Retained earnings roll-forward",
      note: "Prior retained earnings + net income - dividends less current. The textbook identity.",
      terms: [
        [1, "retainedEarnings", 1],
        [1, "netIncome", 0],
        // Dividends are stored negative, so this term is additive.
        [1, "dividends", 0],
        [-1, "retainedEarnings", 0],
      ],
    },
    {
      // Where a company charges buybacks against retained earnings rather than
      // to treasury stock or paid-in capital, the row above shows a residual
      // close to the buyback figure and this one lands near zero. Which of the
      // two ties tells you the convention the filer uses, so both are shown
      // rather than picking one and hiding the choice.
      label: "  ...including buybacks",
      note: "Same identity with buybacks deducted. If this ties and the row above doesn't, the company charges repurchases to retained earnings.",
      terms: [
        [1, "retainedEarnings", 1],
        [1, "netIncome", 0],
        [1, "dividends", 0],
        // Buybacks are stored negative, so this term is additive too.
        [1, "buybacks", 0],
        [-1, "retainedEarnings", 0],
      ],
    },
    {
      label: "PP&E roll-forward",
      note: "Prior PP&E + capex - D&A less current. Residual is expected: D&A here includes amortization of intangibles, and acquisitions add PP&E without capex.",
      terms: [
        [1, "ppe", 1],
        // Capex is stored negative; subtracting it adds the spend back.
        [-1, "capex", 0],
        [-1, "da", 0],
        [-1, "ppe", 0],
      ],
    },
    {
      label: "Operating cash flow bridge",
      note: "Net income + D&A + SBC +/- working capital less reported CFO. Residual is the portion of CFO these adjustments don't explain (deferred taxes, other non-cash items).",
      terms: [
        [1, "netIncome", 0],
        [1, "da", 0],
        [1, "sbc", 0],
        // Working capital: an asset increase consumes cash, a liability
        // increase provides it.
        [-1, "receivables", 0],
        [1, "receivables", 1],
        [-1, "inventory", 0],
        [1, "inventory", 1],
        [1, "payables", 0],
        [-1, "payables", 1],
        [-1, "ocf", 0],
      ],
    },
  ];

  let r = 5;
  for (const check of CHECKS) {
    const row = ws.getRow(r);
    row.getCell(1).value = check.label;
    row.getCell(1).font = { size: 10, bold: true };

    let rendered = false;
    periods.forEach((_, i) => {
      const cell = row.getCell(i + 2);
      const addrs = check.terms.map((t) => A(t[1], i + t[2]));
      const vals = check.terms.map((t) => raw(t[1], i + t[2]));
      // Every term must resolve. A partial identity isn't a check, it's noise.
      if (addrs.some((a) => a === null) || vals.some((v) => v === null)) return;

      const expr = check.terms
        .map((t, idx) => `${idx === 0 ? (t[0] === 1 ? "" : "-") : t[0] === 1 ? "+" : "-"}${addrs[idx]}`)
        .join("");
      const residual =
        check.terms.reduce((s, t, idx) => s + t[0] * (vals[idx] as number), 0) / 1e6;

      setFormula(cell, expr, residual, MONEY_FMT);
      // Scaled to the company: a $2M gap is noise for Apple, everything for a
      // small filer. Compared against total assets where available.
      const scale = raw("totalAssets", i) ?? raw("revenue", i);
      const ratio = scale ? Math.abs(residual * 1e6) / Math.abs(scale) : 1;
      cell.font = {
        size: 10,
        color: { argb: ratio < 0.001 ? GREEN : ratio < 0.02 ? AMBER : RED },
      };
      rendered = true;
    });

    r++;
    const noteRow = ws.getRow(r);
    noteRow.getCell(1).value = "  " + check.note;
    noteRow.getCell(1).font = { italic: true, size: 8, color: { argb: MUTED } };
    r++;

    if (!rendered) {
      row.getCell(2).value = "not available";
      row.getCell(2).font = { size: 9, italic: true, color: { argb: MUTED } };
    }
  }

  r++;
  const legend = [
    "Green: residual under 0.1% of total assets. The identity ties.",
    "Amber: under 2%. Explained by captions this line set doesn't model.",
    "Red: over 2%. Worth opening the filing before relying on the affected lines.",
    "",
    "These are historical checks, not forecast drivers. Every balance here is as reported;",
    "the roll-forwards test whether the reported figures are mutually consistent.",
  ];
  legend.forEach((t, i) => {
    const c = ws.getCell(r + i, 1);
    c.value = t;
    c.font = {
      size: 9,
      italic: true,
      color: {
        argb: i === 0 ? GREEN : i === 1 ? AMBER : i === 2 ? RED : GREY,
      },
    };
  });

  ws.getColumn(1).width = 46;
  for (let c = 2; c <= periods.length + 1; c++) ws.getColumn(c).width = 13;
}

// --- workbook assembly ------------------------------------------------------

function writeCover(
  cover: ExcelJS.Worksheet,
  fin: CompanyFinancials,
  ticker: string,
  hasProjection: boolean,
  webPreset: string | null = null,
  hasWebOverrides = false
) {
  cover.getCell("B2").value = fin.name;
  cover.getCell("B2").font = { bold: true, size: 20, color: { argb: NAVY } };
  cover.getCell("B3").value = `${ticker || fin.ticker} - Historical Financial Statements`;
  cover.getCell("B3").font = { size: 12, color: { argb: GREY } };
  cover.getCell("B5").value = "Source: SEC EDGAR company filings (10-K, 10-Q)";
  cover.getCell("B6").value = `Generated: ${new Date().toISOString().slice(0, 10)}`;
  cover.getCell("B7").value = `Reporting currency: ${fin.currency}`;
  if (hasWebOverrides || webPreset) {
    const label =
      webPreset === "street"
        ? "Web valuation preset: street consensus (EPS growth seed)"
        : webPreset === "history"
          ? "Web valuation preset: company history"
          : "Web valuation: custom assumption overrides from the site";
    cover.getCell("B8").value = label;
    cover.getCell("B8").font = { size: 10, italic: true, color: { argb: INPUT_BLUE } };
  }

  cover.getCell("B9").value = "How to read this workbook";
  cover.getCell("B9").font = { bold: true, size: 12 };
  const legend = [
    "This workbook is laid out as a model, in two layers.",
    "",
    "Source data sheets (at the back) hold every figure exactly as filed, including",
    "the YoY and QoQ percentages. They contain no formulas. Figures are blue.",
    "",
    "Calculated sheets (at the front) rebuild the same statements entirely from",
    "formulas. Reported lines link to the source sheet; subtotals compute from the",
    "lines above them; change rows are real percentage calculations. Figures are black.",
    "",
    "Blue means a hard-coded input. Black means a formula. Edit a blue figure and it",
    "flows through the calculated sheets, the Ratios, and the Model Checks.",
    "",
    "A subtotal only computes where its parts sum exactly to the filed figure. Where",
    "they don't, it links to the source instead, and Model Checks reports the gap.",
    `Money and share counts are in ${fin.currency} millions and millions of shares.`,
    "Per-share amounts are in units, so net income divided by diluted shares is EPS.",
  ];
  let row = 10;
  legend.forEach((t) => {
    const c = cover.getCell(row++, 2);
    c.value = t;
    c.font = { size: 10, color: { argb: /blue/i.test(t) ? INPUT_BLUE : "FF3F3F46" } };
  });

  row++;
  cover.getCell(row, 2).value = "Contents";
  cover.getCell(row, 2).font = { bold: true, size: 12 };
  row++;

  // A clickable table of contents built from the sheets that were actually
  // produced, so it can never promise a tab the workbook doesn't have. Each row
  // is an internal hyperlink that jumps to the sheet's top-left cell.
  const blurb = (name: string): string => {
    if (/Data \((A|Q)\)$/.test(name)) return "Source data, exactly as filed";
    if (/\(A\)$/.test(name)) return "Calculated — annual";
    if (/\(Q\)$/.test(name)) return "Calculated — quarterly";
    if (name === "Ratios") return "Every ratio, a formula into the annual sheets";
    if (name === "Model Checks") return "Accounting identities as residuals";
    if (name === "Sources") return "Each line traced to its SEC concept";
    if (name === "Scorecard") return "Rules-based quality score across five dimensions";
    if (name === "Assumptions") return "Forward model — the drivers you edit";
    if (name === "Schedules") return "Forward model — supporting schedules";
    if (name === "Projections") return "Forward model — three projected statements";
    if (name === "DCF Valuation") return "DCF off the model — a calculator, not advice";
    const valuation = valuationSheetBlurb(name);
    if (valuation) return valuation;
    return "";
  };
  for (const ws of cover.workbook.worksheets) {
    if (ws.name === cover.name) continue;
    const link = cover.getCell(row, 2);
    link.value = { text: ws.name, hyperlink: `#${quoteSheet(ws.name)}!A1` };
    link.font = { size: 10, color: { argb: INPUT_BLUE }, underline: true };
    const b = cover.getCell(row, 3);
    b.value = blurb(ws.name);
    b.font = { size: 10, italic: true, color: { argb: GREY } };
    row++;
  }
  if (!hasProjection) {
    // Saying nothing left the reader hunting for tabs the workbook didn't have.
    row++;
    for (const t of [
      "No forward model or DCF for this filer. Both need a revenue base, a gross-profit and",
      "operating-income structure, and a balance sheet that ties. Banks, insurers and REITs report",
      "none of those, and a margin-driven forecast forced onto them would balance without meaning anything.",
    ]) {
      const c = cover.getCell(row++, 2);
      c.value = t;
      c.font = { size: 9, italic: true, color: { argb: GREY } };
    }
  }
  cover.getColumn(2).width = 46;
  cover.getColumn(3).width = 56;
}

/** Parse optional web-DCF assumption overrides from the query string. */
function parseWebAssumptions(url: URL): {
  projection?: Partial<Assumptions>;
  dcf?: Partial<DcfInputs>;
  preset: string | null;
} {
  const num = (k: string): number | null => {
    const raw = url.searchParams.get(k);
    if (raw == null || raw === "") return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  };
  // Percent fields arrive as decimals (0.12) from the valuation panel.
  const y1g = num("g");
  const gm = num("gm");
  const opex = num("opex");
  const beta = num("beta");
  const rf = num("rf");
  const erp = num("erp");
  const tg = num("tg");
  const preset = url.searchParams.get("preset");
  // Optional multi-year growth path: g0,g1,g2… as comma-separated decimals.
  const gPathRaw = url.searchParams.get("gpath");
  const gPath =
    gPathRaw && gPathRaw.trim()
      ? gPathRaw
          .split(",")
          .map((s) => Number(s.trim()))
          .filter((n) => Number.isFinite(n))
      : null;

  const years = PROJECTION_YEARS;
  const fill = (v: number) => Array.from({ length: years }, () => v);

  const projection: Partial<Assumptions> = {};
  if (gPath && gPath.length > 0) {
    const path: number[] = [];
    for (let i = 0; i < years; i++) {
      path.push(i < gPath.length ? gPath[i]! : path[path.length - 1]!);
    }
    projection.revenueGrowth = path;
  } else if (y1g != null) {
    // Mild reversion — do not slam every filer to a hard 3% by year 5.
    const end = y1g > 0.03 ? 0.03 + (y1g - 0.03) * 0.4 : y1g;
    projection.revenueGrowth = Array.from({ length: years }, (_, i) =>
      years <= 1 ? y1g : y1g + (end - y1g) * (i / (years - 1))
    );
  }
  if (gm != null) projection.grossMargin = fill(gm);
  if (opex != null) projection.opexPctRevenue = fill(opex);

  const dcf: Partial<DcfInputs> = {};
  if (beta != null) dcf.beta = beta;
  if (rf != null) dcf.riskFree = rf;
  if (erp != null) dcf.equityRiskPremium = erp;
  if (tg != null) dcf.terminalGrowth = tg;

  return {
    projection: Object.keys(projection).length ? projection : undefined,
    dcf: Object.keys(dcf).length ? dcf : undefined,
    preset,
  };
}

export async function GET(
  req: Request,
  { params }: { params: {  cik: string  } }
) {
  const { cik  } = params;
  const reqUrl = new URL(req.url);
  const ticker = (reqUrl.searchParams.get("ticker") ?? "").toUpperCase();
  const webAssumptions = parseWebAssumptions(reqUrl);

  if (!isValidCik(cik)) {
    return Response.json({ error: "Invalid company id." }, { status: 400 });
  }
  if (ticker && !isValidTicker(ticker)) {
    return Response.json({ error: "Invalid ticker." }, { status: 400 });
  }

  const release = await buildGate.acquire(GATE_WAIT_MS);
  if (!release) {
    return Response.json(
      { error: "Too many workbooks are being generated right now. Try again shortly." },
      { status: 503, headers: { "Retry-After": "10" } }
    );
  }

  try {
    const full = await getCompanyFinancials(cik, ticker);
    // Trimmed before anything is written, so the cap bounds the whole build
    // rather than just the output.
    const wantsAll = reqUrl.searchParams.get("all") === "1";
    const fin: CompanyFinancials = wantsAll
      ? full
      : {
          ...full,
          annual: limitPeriods(full.annual, MAX_ANNUAL_COLS),
          quarterly: limitPeriods(full.quarterly, MAX_QUARTERLY_COLS),
        };
    const wb = new ExcelJS.Workbook();
    wb.creator = "Financial Statements";
    wb.created = new Date();

    // Cover sheet. Created first so it sits at the front, filled last so its
    // contents list can name the sheets that were actually produced.
    const cover = wb.addWorksheet("Cover");

    // Sheet names come from the statement's own title rather than a positional
    // lookup, which produced "undefined (Annual)" for any statement beyond the
    // three that were hardcoded.
    const shortName = (st: Statement) =>
      st.title.replace(/ Statement$/, "").replace(/^Balance Sheet$/, "Balance");

    interface Plan {
      st: Statement;
      set: StatementSet;
      quarterly: boolean;
      calcName: string;
      dataName: string;
      calc: ExcelJS.Worksheet;
      data: ExcelJS.Worksheet;
    }

    // Worksheets are created up front in the order a reader wants them —
    // calculations first, source data behind — but populated in dependency
    // order, since a calculation sheet's formulas reference rows on its data
    // sheet. Row positions are computed rather than observed, so the two orders
    // don't have to agree.
    const frozen = { views: [{ state: "frozen" as const, xSplit: 1, ySplit: 4 }] };
    const sheetName = makeSheetNamer(["Cover"]);
    const plans: Plan[] = [];
    for (const [set, quarterly] of [
      [fin.annual, false],
      [fin.quarterly, true],
    ] as const) {
      for (const st of set.statements) {
        // Both names are claimed here and then reused, because the namer is
        // stateful: asking it twice for "Income (A)" would hand back
        // "Income (A)" and then "Income (2)".
        const calcName = sheetName(`${shortName(st)} (${quarterly ? "Q" : "A"})`);
        const dataName = sheetName(`${shortName(st)} Data (${quarterly ? "Q" : "A"})`);
        plans.push({
          st,
          set,
          quarterly,
          calcName,
          dataName,
          calc: wb.addWorksheet(calcName, frozen),
          data: null as unknown as ExcelJS.Worksheet,
        });
      }
    }
    const ratiosWs = wb.addWorksheet(sheetName("Ratios"), frozen);
    const checksWs = wb.addWorksheet(sheetName("Model Checks"), frozen);
    // Provenance applies to every filer, projection or not: it documents where
    // each statement line comes from.
    const sourcesWs = wb.addWorksheet(sheetName("Sources"), frozen);
    // The scorecard is computed from the statements, so it too exists for every
    // filer — a bank still has leverage and coverage even without a projection.
    const scorecardWs = wb.addWorksheet(sheetName("Scorecard"), frozen);

    // The forward model. Skipped entirely for filers without a revenue base and
    // a balancing balance sheet — banks and trusts commonly land there, and a
    // projection built on missing anchors would be fiction. The three sheet
    // names are fixed because lib/excel-projection.ts writes formulas against
    // them; nothing else can claim them because the namer saw them first.
    // Optional overrides from the web Valuation tab so Excel matches what the
    // user was looking at (growth, margins, WACC inputs, preset label).
    // When the UI did not send a growth path, seed from free street consensus
    // (EPS growth hops as the best free proxy for rev growth) so every filer
    // is not forced onto a 3% tail.
    let projectionOverrides = webAssumptions.projection
      ? { ...webAssumptions.projection }
      : ({} as Partial<Assumptions>);
    if (!projectionOverrides.revenueGrowth && ticker) {
      const street = await getStreetEstimates(ticker).catch(() => null);
      if (street) {
        const { path } = buildRevenueGrowthPath({
          years: PROJECTION_YEARS,
          historical: historicalRevenueGrowth(fin.annual),
          streetPath: street.epsGrowthPath,
          streetYear1: street.year1EpsGrowth,
        });
        projectionOverrides = { ...projectionOverrides, revenueGrowth: path };
      }
    }
    const projection = buildProjection(
      fin,
      PROJECTION_YEARS,
      Object.keys(projectionOverrides).length ? projectionOverrides : undefined
    );
    const projectionNames = ["Assumptions", "Schedules", "Projections"].map(sheetName);
    const assumptionsWs = projection ? wb.addWorksheet(projectionNames[0], frozen) : null;
    const schedulesWs = projection ? wb.addWorksheet(projectionNames[1], frozen) : null;
    const projectionsWs = projection ? wb.addWorksheet(projectionNames[2], frozen) : null;
    // The DCF sits on top of the projection: it discounts the projection's own
    // free cash flow, so it exists exactly when the projection does. Named after
    // the three projection sheets it references by their fixed names. Seed its
    // beta from the filer's SIC industry where we can; the profile is cached and
    // decorative, so a miss just falls back to the neutral default.
    // The current price drives the reverse DCF; both it and the profile are
    // cached, decorative fetches, so a miss just drops the feature it feeds.
    // SIC for DCF beta and bank/insurer scorecard/ratio modes — always useful,
    // not only when a projection is built.
    const [profile, quote, priceSeries] = await Promise.all([
      getSecProfile(cik).catch(() => null),
      ticker ? getLatestQuote(ticker).catch(() => null) : Promise.resolve(null),
      ticker ? getPriceSeries(ticker, "1y").catch(() => null) : Promise.resolve(null),
    ]);
    const sectorMode = detectSectorMode({
      sic: profile?.sic,
      sicDescription: profile?.sicDescription,
    });
    const dcf = buildDcf(
      fin,
      projection,
      sectorBeta(profile?.sic),
      quote?.price ?? null,
      webAssumptions.dcf
    );
    const dcfWs = dcf ? wb.addWorksheet(sheetName("DCF Valuation"), frozen) : null;
    for (const plan of plans) {
      plan.data = wb.addWorksheet(plan.dataName, frozen);
    }

    // Annual and quarterly keep separate registries so a ratio can never
    // accidentally mix a quarterly balance with an annual flow.
    const annualRegistry: Registry = new Map();
    const quarterlyRegistry: Registry = new Map();

    for (const plan of plans) {
      fillDataSheet(plan.data, plan.st, plan.set, plan.quarterly, fin.currency);
    }
    for (const plan of plans) {
      fillFormulaSheet(
        plan.calc,
        plan.st,
        plan.set,
        plan.quarterly,
        fin.currency,
        plan.dataName,
        plan.quarterly ? quarterlyRegistry : annualRegistry,
        plan.calcName
      );
    }

    fillRatiosSheet(ratiosWs, fin, annualRegistry, sectorMode);
    fillChecksSheet(checksWs, fin, annualRegistry);
    fillSourcesSheet(sourcesWs, fin, new Date().toISOString().slice(0, 10));
    fillScorecardSheet(scorecardWs, fin, buildScorecard(fin, sectorMode));
    if (projection && assumptionsWs && schedulesWs && projectionsWs) {
      fillAssumptionsSheet(assumptionsWs, fin, projection);
      fillSchedulesSheet(schedulesWs, fin, projection);
      fillProjectionsSheet(projectionsWs, fin, projection);
    }
    if (dcf && dcfWs) {
      fillDcfSheet(dcfWs, fin, dcf);
    }

    fillValuationSuite(wb, {
      fin,
      price: quote?.price ?? null,
      dcf,
      pricePoints: priceSeries?.points,
    });

    writeCover(
      cover,
      fin,
      ticker,
      projection != null,
      webAssumptions.preset,
      !!(webAssumptions.projection || webAssumptions.dcf)
    );

    // Print-ready: fit each sheet to one page wide, repeat the four-row header
    // band on every printed page, and footer each page with the file name, the
    // sheet name, and page numbers. Landscape suits the years-across-columns
    // layout every sheet uses.
    for (const ws of wb.worksheets) {
      ws.pageSetup = {
        ...ws.pageSetup,
        orientation: "landscape",
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        margins: { left: 0.4, right: 0.4, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 },
        ...(ws.name === cover.name ? {} : { printTitlesRow: "1:4" }),
      };
      ws.headerFooter = { oddFooter: "&L&F&C&A&R&P of &N" };
    }

    const buffer = await wb.xlsx.writeBuffer();
    return new Response(buffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        // safeFilename strips quotes, which could otherwise break out of the
        // quoted filename and let a caller control the suggested download name.
        "Content-Disposition": `attachment; filename="${safeFilename(
          `${ticker || cik}_financials`
        )}.xlsx"`,
      },
    });
  } catch (e) {
    if (e instanceof InvalidCikError) {
      return Response.json({ error: "Invalid company id." }, { status: 400 });
    }
    if (e instanceof NoFactsError) {
      return Response.json(
        {
          error:
            "No structured XBRL financials (US-GAAP or IFRS companyfacts) for this company.",
          code: "NO_FACTS",
        },
        { status: 404 }
      );
    }
    console.error(`[excel] failed for cik=${cik}:`, e);
    return Response.json(
      { error: publicErrorMessage(e, "Failed to build workbook.") },
      { status: 502 }
    );
  } finally {
    release();
  }
}
