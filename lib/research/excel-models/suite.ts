/**
 * Build and fill every valuation tab on an Excel workbook.
 *
 * Units: $ millions and millions of shares (same as the rest of the export).
 * Per-share prices stay in currency units. Each fill is isolated so one
 * missing engine cannot kill the download.
 */

import type ExcelJS from "exceljs";
import type { CompanyFinancials } from "@/lib/research/edgar";
import type { Dcf } from "@/lib/research/excel-dcf";
import { companyOperatingMetrics, lastLine } from "@/lib/research/valuation/metrics";
import { runComps, type CompPeerInput } from "@/lib/research/valuation/comps";
import { runPrecedents } from "@/lib/research/valuation/precedents";
import {
  defaultLboInputsFromMetrics,
  runLbo,
} from "@/lib/research/valuation/lbo";
import { runSotp } from "@/lib/research/valuation/sotp";
import { runMerger, type MergerInputs } from "@/lib/research/valuation/merger";
import { runCreditCapacity } from "@/lib/research/valuation/credit";
import { runMonteCarloDcf, type McDcfInputs } from "@/lib/research/valuation/monte-carlo-dcf";
import { runTradingRange } from "@/lib/research/valuation/trading-range";
import {
  assembleValuationBars,
  buildFootballField,
} from "@/lib/research/valuation/football-field";
import { fillEvBridgeSheet, EV_BRIDGE_SHEET_NAME } from "./ev-bridge";
import { fillCompsSheet, COMPS_SHEET_NAME } from "./comps";
import { fillPrecedentsSheet, PRECEDENTS_SHEET_NAME } from "./precedents";
import { fillFootballSheet, FOOTBALL_SHEET_NAME } from "./football";
import { fillTradingRangeSheet, TRADING_RANGE_SHEET_NAME } from "./trading-range";
import { fillLboSheet, LBO_SHEET_NAME } from "./lbo";
import { fillSotpSheet, SOTP_SHEET_NAME } from "./sotp";
import { fillMergerSheet, MERGER_SHEET_NAME } from "./merger";
import { fillCreditSheet, CREDIT_SHEET_NAME } from "./credit";
import { fillMonteCarloSheet, MC_SHEET_NAME } from "./monte-carlo";

const M = 1e6;

function mm(n: number | null | undefined): number | null {
  return n != null && Number.isFinite(n) ? n / M : null;
}

function finite(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

export const VALUATION_SHEET_NAMES = [
  EV_BRIDGE_SHEET_NAME,
  COMPS_SHEET_NAME,
  PRECEDENTS_SHEET_NAME,
  LBO_SHEET_NAME,
  SOTP_SHEET_NAME,
  MERGER_SHEET_NAME,
  CREDIT_SHEET_NAME,
  MC_SHEET_NAME,
  FOOTBALL_SHEET_NAME,
  TRADING_RANGE_SHEET_NAME,
] as const;

export function valuationSheetBlurb(name: string): string {
  switch (name) {
    case EV_BRIDGE_SHEET_NAME:
      return "Market cap → EV: debt, leases, NCI, pref, pension, cash";
    case COMPS_SHEET_NAME:
      return "Trading comps — peer multiples; median is the read";
    case PRECEDENTS_SHEET_NAME:
      return "Precedent transactions — empty until you add real deals";
    case LBO_SHEET_NAME:
      return "LBO sources & uses, P&L, debt schedule, MOIC / IRR";
    case SOTP_SHEET_NAME:
      return "Sum-of-the-parts — edit segment multiples";
    case MERGER_SHEET_NAME:
      return "Accretion / dilution — replace the placeholder target";
    case CREDIT_SHEET_NAME:
      return "Debt capacity: leverage vs coverage (binding constraint)";
    case MC_SHEET_NAME:
      return "Monte Carlo summary + live base-case Gordon DCF";
    case FOOTBALL_SHEET_NAME:
      return "Triangulation — do not average the bars";
    case TRADING_RANGE_SHEET_NAME:
      return "52-week range → implied equity / EV / multiples";
    default:
      return "";
  }
}

function addSheet(wb: ExcelJS.Workbook, name: string): ExcelJS.Worksheet {
  return wb.addWorksheet(name, {
    views: [{ state: "frozen", xSplit: 1, ySplit: 4 }],
  });
}

function safeFill(label: string, fn: () => void) {
  try {
    fn();
  } catch (e) {
    console.error(`[excel-models] ${label} failed:`, e);
  }
}

/**
 * Append every valuation model as its own formula-driven worksheet.
 */
export function fillValuationSuite(
  wb: ExcelJS.Workbook,
  args: {
    fin: CompanyFinancials;
    price: number | null;
    dcf: Dcf | null;
    pricePoints?: { t: number; c: number }[];
  }
) {
  const { fin, price, dcf, pricePoints } = args;
  const m = companyOperatingMetrics(fin);
  const sharesMm = mm(m.shares);
  const revMm = mm(m.revenue);
  const ebitdaMm = mm(m.ebitda);
  const ebitMm = mm(m.ebit);
  const niMm = mm(m.netIncome);
  const debtMm = mm(m.debt);
  const netDebtMm = mm(m.netDebt);
  const interestMm = mm(lastLine(fin.annual, "interestExpense"));

  const subject: CompPeerInput = {
    ticker: fin.ticker || "SUBJECT",
    name: fin.name,
    revenue: revMm,
    ebitda: ebitdaMm,
    ebit: ebitMm,
    netIncome: niMm,
    shares: sharesMm,
    netDebt: netDebtMm,
    price,
    periodEnd: fin.annual.periods[0]?.end,
    basis: "fy",
  };
  const comps = runComps(subject, []);

  const precedents = runPrecedents({
    deals: [],
    subjectRevenue: revMm,
    subjectEbitda: ebitdaMm,
    subjectNetDebt: netDebtMm,
    subjectShares: sharesMm,
  });

  const lboInputs = defaultLboInputsFromMetrics({
    ebitda: ebitdaMm,
    netDebt: netDebtMm,
    revenue: revMm,
  });
  const lbo = lboInputs ? runLbo(lboInputs) : null;

  const sotp = runSotp({
    segments:
      finite(revMm) || finite(ebitdaMm)
        ? [
            {
              id: "consolidated",
              name: "Consolidated operations",
              revenue: revMm,
              ebitda: ebitdaMm,
              multiple: finite(ebitdaMm) && ebitdaMm! > 0 ? 10 : 2,
              multipleType:
                finite(ebitdaMm) && ebitdaMm! > 0 ? "evEbitda" : "evSales",
            },
          ]
        : [],
    netDebt: netDebtMm,
    shares: sharesMm,
  });

  const mergerInputs: MergerInputs | null =
    finite(niMm) &&
    finite(sharesMm) &&
    sharesMm! > 0 &&
    finite(price) &&
    price! > 0
      ? {
          acquirerNetIncome: niMm!,
          acquirerShares: sharesMm!,
          acquirerPricePerShare: price!,
          targetNetIncome: niMm! * 0.25,
          targetShares: sharesMm! * 0.25,
          offerPricePerShare: price!,
          targetSharesOutstanding: sharesMm! * 0.25,
          cashPercent: 0.5,
          stockPercent: 0.5,
          newDebtInterestRate: 0.06,
          taxRate: 0.21,
          synergiesPretax: 0,
          dealFees: 0,
        }
      : null;
  const merger = mergerInputs ? runMerger(mergerInputs) : null;

  const creditInputs = finite(ebitdaMm)
    ? {
        ebitda: ebitdaMm!,
        ebit: ebitMm,
        interestExpense: interestMm,
        netDebt: netDebtMm,
        totalDebt: debtMm,
      }
    : null;
  const credit = creditInputs ? runCreditCapacity(creditInputs) : null;

  const mcInputs: McDcfInputs | null =
    dcf && dcf.fcf.length > 0
      ? {
          fcf: dcf.fcf.map((x) => x / M),
          wacc: dcf.wacc,
          terminalGrowth: dcf.inputs.terminalGrowth,
          debt: (dcf.debt ?? 0) / M,
          cash: (dcf.cash ?? 0) / M,
          shares: dcf.shares != null ? dcf.shares / M : null,
          fcfShockStd: 0.15,
          waccShockStd: 0.01,
          growthShockStd: 0.005,
          simulations: 1000,
          seed: 1,
        }
      : null;
  const mc = mcInputs ? runMonteCarloDcf(mcInputs) : null;

  const trading = runTradingRange({
    points: pricePoints ?? [],
    shares: m.shares,
    netDebt: m.netDebt,
    netIncome: m.netIncome,
    ebitda: m.ebitda,
    revenue: m.revenue,
  });

  const lboPerShare =
    lbo && finite(sharesMm) && sharesMm! > 0
      ? {
          entryEquityPerShare: lbo.sourcesAndUses.sponsorEquity / sharesMm!,
          exitEquityPerShare: lbo.exit.equityProceeds / sharesMm!,
          irrMidPerShare: lbo.returns.moic
            ? (lbo.sourcesAndUses.sponsorEquity * lbo.returns.moic) / sharesMm!
            : null,
        }
      : undefined;

  const field = buildFootballField({
    currentPrice: price,
    bars: assembleValuationBars({
      dcf: dcf
        ? { gordonPerShare: dcf.perShare, exitPerShare: dcf.exitPerShare }
        : undefined,
      comps: comps.range,
      precedents: precedents.range,
      lbo: lboPerShare,
      sotp: sotp.perShare != null ? { mid: sotp.perShare } : undefined,
      monteCarlo: mc
        ? { low: mc.p5, mid: mc.medianPerShare, high: mc.p95 }
        : undefined,
      tradingRange: trading.range,
      precedentsIllustrative: true,
    }),
  });

  safeFill("ev-bridge", () =>
    fillEvBridgeSheet(addSheet(wb, EV_BRIDGE_SHEET_NAME), { fin, price })
  );
  safeFill("comps", () => fillCompsSheet(addSheet(wb, COMPS_SHEET_NAME), comps));
  safeFill("precedents", () =>
    fillPrecedentsSheet(addSheet(wb, PRECEDENTS_SHEET_NAME), precedents, [])
  );
  if (lbo) {
    safeFill("lbo", () => fillLboSheet(addSheet(wb, LBO_SHEET_NAME), lbo));
  }
  safeFill("sotp", () =>
    fillSotpSheet(addSheet(wb, SOTP_SHEET_NAME), { ...sotp, shares: sharesMm })
  );
  if (merger && mergerInputs) {
    safeFill("merger", () =>
      fillMergerSheet(addSheet(wb, MERGER_SHEET_NAME), {
        ...merger,
        inputs: mergerInputs,
      })
    );
  }
  if (credit && creditInputs) {
    safeFill("credit", () =>
      fillCreditSheet(addSheet(wb, CREDIT_SHEET_NAME), {
        ...credit,
        inputs: creditInputs,
      })
    );
  }
  if (mc && mcInputs) {
    safeFill("monte-carlo", () =>
      fillMonteCarloSheet(addSheet(wb, MC_SHEET_NAME), { ...mc, inputs: mcInputs })
    );
  }
  safeFill("football", () =>
    fillFootballSheet(addSheet(wb, FOOTBALL_SHEET_NAME), field)
  );
  safeFill("trading-range", () =>
    fillTradingRangeSheet(addSheet(wb, TRADING_RANGE_SHEET_NAME), trading)
  );
}
