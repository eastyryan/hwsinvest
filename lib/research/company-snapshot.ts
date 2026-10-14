// Filing-based company statistics for the overview.
//
// Flows (revenue, margins, multiples that use them) share one basis: trailing
// twelve months when four recent quarters line up, otherwise the latest fiscal
// year. A margin never mixes a TTM numerator with a fiscal-year denominator.
// Balances are the latest quarter that actually reports them, else the latest
// fiscal year. Dividends stay on the fiscal year — a yield is the last year's
// cash distribution, not a quarterly run-rate.

import type { CompanyFinancials, StatementSet } from "./edgar";
import { periodCagr } from "./cagr";
import { buildRatios } from "./ratios";
import { buildEvBridgeFromMetrics } from "./valuation/ev-bridge";
import { companyOperatingMetrics, lastLine } from "./valuation/metrics";

export interface AvgStat {
  /** Null when no year in the window had a meaningful figure. */
  avg: number | null;
  /** How many of the newest five fiscal years went into the average. */
  years: number;
}

export interface CompanySnapshot {
  /** Basis shared by revenue, margins, and the flow legs of valuation. */
  flowBasis: "ttm" | "fy" | "none";
  balanceBasis: "quarter" | "fy" | "none";
  /**
   * False when the live price (or its currency) cannot be combined with the
   * filing currency. Multiples, yield, and enterprise value stay null.
   */
  multiplesOk: boolean;
  marketCap: number | null;
  enterpriseValue: number | null;
  shares: number | null;
  revenue: number | null;
  margins: {
    gross: number | null;
    ebitda: number | null;
    operating: number | null;
    pretax: number | null;
    net: number | null;
    fcf: number | null;
  };
  valuation: {
    pe: number | null;
    pb: number | null;
    evSales: number | null;
    evEbitda: number | null;
    pFcf: number | null;
    evGrossProfit: number | null;
  };
  health: {
    cash: number | null;
    netDebt: number | null;
    debtToEquity: number | null;
    interestCoverage: number | null;
  };
  returns: {
    roa: AvgStat;
    rota: AvgStat;
    roe: AvgStat;
    roce: AvgStat;
    roic: AvgStat;
  };
  growth: {
    revenue3: number | null;
    revenue5: number | null;
    revenue10: number | null;
    eps3: number | null;
    eps5: number | null;
    eps10: number | null;
    fcf5: number | null;
    shares5: number | null;
  };
  dividends: {
    yield: number | null;
    payout: number | null;
    dps: number | null;
    growth3: number | null;
    growth5: number | null;
    growth10: number | null;
  };
}

export interface SnapshotMarket {
  price: number | null;
  priceCurrency: string | null;
  marketCap: number | null;
  marketCapCurrency: string | null;
  filingCurrency: string;
}

const EMPTY_AVG: AvgStat = { avg: null, years: 0 };

function finite(v: number | null | undefined): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function divPositive(a: number | null, b: number | null): number | null {
  if (!finite(a) || !finite(b) || !(b > 0)) return null;
  return a / b;
}

function daysBetween(older: string, newer: string): number {
  return (Date.parse(newer) - Date.parse(older)) / 86_400_000;
}

/** Sum of the newest four quarters when they span about a year and none are missing. */
function ttmSum(set: StatementSet, key: string): number | null {
  if (set.periods.length < 4) return null;
  const newest = set.periods[0];
  const oldest = set.periods[3];
  if (!newest || !oldest) return null;
  const span = daysBetween(oldest.end, newest.end);
  if (!(span >= 240 && span <= 400)) return null;
  let sum = 0;
  for (let i = 0; i < 4; i++) {
    const period = set.periods[i];
    if (!period) return null;
    const value = lastLineAt(set, key, period.key);
    if (!finite(value)) return null;
    sum += value;
  }
  return sum;
}

function lastLineAt(set: StatementSet, key: string, periodKey: string): number | null {
  for (const statement of set.statements) {
    const line = statement.lines.find((l) => l.key === key);
    if (!line) continue;
    const value = line.values[periodKey];
    return finite(value) ? value : null;
  }
  return null;
}

function lineValues(set: StatementSet, key: string): Record<string, number | null> {
  for (const statement of set.statements) {
    const line = statement.lines.find((l) => l.key === key);
    if (line) return line.values;
  }
  return {};
}

function debtOf(set: StatementSet): number | null {
  const st = lastLine(set, "stDebt");
  const lt = lastLine(set, "ltDebt");
  if (st == null && lt == null) return null;
  return (st ?? 0) + (lt ?? 0);
}

function pickBalance(fin: CompanyFinancials): {
  set: StatementSet;
  basis: "quarter" | "fy" | "none";
} {
  const quarterly = fin.quarterly;
  const useful =
    quarterly.periods.length > 0 &&
    (lastLine(quarterly, "equity") != null ||
      lastLine(quarterly, "cash") != null ||
      debtOf(quarterly) != null);
  if (useful) return { set: quarterly, basis: "quarter" };
  if (fin.annual.periods.length > 0) return { set: fin.annual, basis: "fy" };
  return { set: fin.annual, basis: "none" };
}

function flowOn(
  fin: CompanyFinancials,
  key: string,
  basis: "ttm" | "fy" | "none"
): number | null {
  if (basis === "ttm") return ttmSum(fin.quarterly, key);
  if (basis === "fy") return lastLine(fin.annual, key);
  return null;
}

function chooseFlowBasis(fin: CompanyFinancials): "ttm" | "fy" | "none" {
  if (ttmSum(fin.quarterly, "revenue") != null) return "ttm";
  if (lastLine(fin.annual, "revenue") != null) return "fy";
  if (fin.annual.periods.length > 0) return "fy";
  return "none";
}

function averageRecent(
  periodsNewestFirst: { key: string }[],
  valueAt: (periodKey: string) => number | null
): AvgStat {
  const window = periodsNewestFirst.slice(0, 5);
  const values: number[] = [];
  for (const period of window) {
    const value = valueAt(period.key);
    if (finite(value)) values.push(value);
  }
  if (values.length === 0) return EMPTY_AVG;
  const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
  return { avg, years: values.length };
}

function averageRatio(fin: CompanyFinancials, key: string): AvgStat {
  const ratios = buildRatios(fin, "annual");
  const line = ratios.lines.find((l) => l.key === key);
  if (!line) return EMPTY_AVG;
  return averageRecent(ratios.periods, (periodKey) => {
    const value = line.values[periodKey];
    return finite(value) ? value : null;
  });
}

/** Operating income / average assets, one figure per fiscal year, newest first. */
function rotaByYear(fin: CompanyFinancials): AvgStat {
  const set = fin.annual;
  const assets = lineValues(set, "totalAssets");
  return averageRecent(set.periods, (periodKey) => {
    const index = set.periods.findIndex((p) => p.key === periodKey);
    const income = lastLineAt(set, "operatingIncome", periodKey);
    const now = assets[periodKey];
    const prevKey = set.periods[index + 1]?.key;
    const prev = prevKey ? assets[prevKey] : null;
    if (!finite(now)) return null;
    const avg = finite(prev) ? (now + prev) / 2 : now;
    return divPositive(income, avg);
  });
}

/** Operating income / (average equity + average debt). */
function roceByYear(fin: CompanyFinancials): AvgStat {
  const set = fin.annual;
  const equity = lineValues(set, "equity");
  return averageRecent(set.periods, (periodKey) => {
    const index = set.periods.findIndex((p) => p.key === periodKey);
    const prevKey = set.periods[index + 1]?.key;
    const income = lastLineAt(set, "operatingIncome", periodKey);
    const eqNow = equity[periodKey];
    const eqPrev = prevKey ? equity[prevKey] : null;
    const debtNow = debtAt(set, periodKey);
    const debtPrev = prevKey ? debtAt(set, prevKey) : null;
    if (!finite(eqNow)) return null;
    const avgEquity = finite(eqPrev) ? (eqNow + eqPrev) / 2 : eqNow;
    const avgDebt =
      debtNow == null && debtPrev == null
        ? 0
        : ((debtNow ?? debtPrev ?? 0) + (debtPrev ?? debtNow ?? 0)) / 2;
    return divPositive(income, avgEquity + avgDebt);
  });
}

function debtAt(set: StatementSet, periodKey: string): number | null {
  const st = lastLineAt(set, "stDebt", periodKey);
  const lt = lastLineAt(set, "ltDebt", periodKey);
  if (st == null && lt == null) return null;
  return (st ?? 0) + (lt ?? 0);
}

function cagr(
  set: StatementSet,
  key: string,
  years: number
): number | null {
  return periodCagr(lineValues(set, key), set.periods, years);
}

function dpsSeries(set: StatementSet): Record<string, number | null> {
  const dividends = lineValues(set, "dividends");
  const diluted = lineValues(set, "sharesDiluted");
  const basic = lineValues(set, "sharesBasic");
  const out: Record<string, number | null> = {};
  for (const period of set.periods) {
    const raw = dividends[period.key];
    const paid = finite(raw) ? Math.abs(raw) : null;
    const shares = finite(diluted[period.key])
      ? diluted[period.key]
      : basic[period.key];
    out[period.key] =
      paid != null && paid > 0 && finite(shares) && shares > 0 ? paid / shares : null;
  }
  return out;
}

function sameCurrency(market: SnapshotMarket): boolean {
  const filing = market.filingCurrency.toUpperCase();
  const price = market.priceCurrency?.toUpperCase();
  const cap = market.marketCapCurrency?.toUpperCase();
  if (!finite(market.price) || price == null || price !== filing) return false;
  if (cap != null && cap !== filing) return false;
  return true;
}

export function buildCompanySnapshot(
  fin: CompanyFinancials,
  market: SnapshotMarket
): CompanySnapshot {
  const flowBasis = chooseFlowBasis(fin);
  const balance = pickBalance(fin);
  const multiplesOk = sameCurrency(market);
  const revenue = flowOn(fin, "revenue", flowBasis);
  const gross = flowOn(fin, "grossProfit", flowBasis);
  const ebitda = flowOn(fin, "ebitda", flowBasis);
  const operating = flowOn(fin, "operatingIncome", flowBasis);
  const pretax = flowOn(fin, "pretaxIncome", flowBasis);
  const net = flowOn(fin, "netIncome", flowBasis);
  const fcf = flowOn(fin, "fcf", flowBasis);
  const eps = flowOn(fin, "epsDiluted", flowBasis);
  const interest = flowOn(fin, "interestExpense", flowBasis);

  const equity = lastLine(balance.set, "equity");
  const cash = lastLine(balance.set, "cash");
  const stInvestments = lastLine(balance.set, "stInvestments");
  const debt = debtOf(balance.set);
  const liquid = finite(stInvestments) && stInvestments > 0 ? stInvestments : 0;
  const netDebt =
    debt == null && cash == null && liquid === 0
      ? null
      : (debt ?? 0) - (cash ?? 0) - liquid;

  const operatingMetrics = companyOperatingMetrics(fin);
  const bridge = multiplesOk
    ? buildEvBridgeFromMetrics(operatingMetrics, market.price)
    : null;
  const enterpriseValue =
    bridge?.complete && finite(bridge.enterpriseValue) ? bridge.enterpriseValue : null;

  const marketCap = finite(market.marketCap) ? market.marketCap : null;
  const capForMultiples = multiplesOk ? marketCap : null;
  const price = multiplesOk ? market.price : null;

  const annual = fin.annual;
  const dividends = lastLine(annual, "dividends");
  const annualNet = lastLine(annual, "netIncome");
  const annualShares =
    lastLine(annual, "sharesDiluted") ??
    lastLine(annual, "sharesBasic") ??
    (finite(fin.sharesOutstanding) ? fin.sharesOutstanding : null);
  // Filings store dividends as a cash outflow, so the line is negative.
  const paid = finite(dividends) ? Math.abs(dividends) : null;
  const dpsMap = dpsSeries(annual);

  const coverShares =
    finite(fin.sharesOutstanding) && fin.sharesOutstanding > 0
      ? fin.sharesOutstanding
      : operatingMetrics.shares;

  return {
    flowBasis,
    balanceBasis: balance.basis,
    multiplesOk,
    marketCap,
    enterpriseValue,
    shares: finite(coverShares) && coverShares > 0 ? coverShares : null,
    revenue,
    margins: {
      gross: divPositive(gross, revenue),
      ebitda: divPositive(ebitda, revenue),
      operating: divPositive(operating, revenue),
      pretax: divPositive(pretax, revenue),
      net: divPositive(net, revenue),
      fcf: divPositive(fcf, revenue),
    },
    valuation: {
      pe: divPositive(price, eps),
      pb: divPositive(capForMultiples, equity),
      evSales: divPositive(enterpriseValue, revenue),
      evEbitda: divPositive(enterpriseValue, ebitda),
      pFcf: divPositive(capForMultiples, fcf),
      evGrossProfit: divPositive(enterpriseValue, gross),
    },
    health: {
      cash,
      netDebt,
      debtToEquity: divPositive(debt, equity),
      interestCoverage:
        operating != null && operating > 0 ? divPositive(operating, interest) : null,
    },
    returns: {
      roa: averageRatio(fin, "roa"),
      rota: rotaByYear(fin),
      roe: averageRatio(fin, "roe"),
      roce: roceByYear(fin),
      roic: averageRatio(fin, "roic"),
    },
    growth: {
      revenue3: cagr(annual, "revenue", 3),
      revenue5: cagr(annual, "revenue", 5),
      revenue10: cagr(annual, "revenue", 10),
      eps3: cagr(annual, "epsDiluted", 3),
      eps5: cagr(annual, "epsDiluted", 5),
      eps10: cagr(annual, "epsDiluted", 10),
      fcf5: cagr(annual, "fcf", 5),
      shares5: cagr(annual, "sharesDiluted", 5),
    },
    dividends: {
      yield: paid == null ? null : divPositive(paid, capForMultiples),
      payout: paid == null ? null : divPositive(paid, annualNet),
      dps:
        paid == null
          ? null
          : paid === 0
            ? 0
            : divPositive(paid, annualShares),
      growth3: periodCagr(dpsMap, annual.periods, 3),
      growth5: periodCagr(dpsMap, annual.periods, 5),
      growth10: periodCagr(dpsMap, annual.periods, 10),
    },
  };
}
