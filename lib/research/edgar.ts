// SEC EDGAR XBRL data layer.
// Source of truth: https://data.sec.gov/api/xbrl/companyfacts/CIK{cik}.json
// EDGAR requires a User-Agent identifying the requester.

const UA = "FinanceExplorer/1.0 (easton.ryan@hws.edu)";

export interface Fact {
  start?: string;
  end: string;
  val: number;
  fy: number;
  fp: string;
  form: string;
  filed: string;
  frame?: string;
}

export interface PeriodCol {
  key: string; // ISO end date
  label: string; // "FY2025" or "Q1 '26"
  end: string;
}

export interface LineValues {
  key: string;
  label: string;
  values: Record<string, number | null>; // period key -> value
  yoy: Record<string, number | null>;
  qoq: Record<string, number | null>;
  style: "normal" | "subtotal" | "total";
  indent?: boolean;
  perShare?: boolean;
  shares?: boolean;
}

export interface Statement {
  title: string;
  lines: LineValues[];
}

export interface StatementSet {
  periods: PeriodCol[]; // newest first
  statements: Statement[];
}

export interface CompanyFinancials {
  name: string;
  cik: string;
  ticker: string;
  annual: StatementSet;
  quarterly: StatementSet;
}

type Kind = "flow" | "instant";

interface LineDef {
  key: string;
  label: string;
  tags: string[];
  kind: Kind;
  style?: "subtotal" | "total";
  indent?: boolean;
  perShare?: boolean;
  shares?: boolean;
  derive?: { plus: string[]; minus: string[] }; // fallback derivation from other lines
  flipSign?: boolean; // reported as positive outflow -> show negative
}

const INCOME: LineDef[] = [
  {
    key: "revenue",
    label: "Revenue",
    kind: "flow",
    style: "subtotal",
    tags: [
      "RevenueFromContractWithCustomerExcludingAssessedTax",
      "RevenueFromContractWithCustomerIncludingAssessedTax",
      "Revenues",
      "SalesRevenueNet",
      "SalesRevenueGoodsNet",
      "RevenuesNetOfInterestExpense",
      "RegulatedAndUnregulatedOperatingRevenue",
      "InterestAndDividendIncomeOperating",
      "PremiumsEarnedNet",
    ],
  },
  {
    key: "cogs",
    label: "Cost of Revenue",
    kind: "flow",
    tags: ["CostOfGoodsAndServicesSold", "CostOfRevenue", "CostOfSales", "CostOfGoodsSold"],
  },
  {
    key: "grossProfit",
    label: "Gross Profit",
    kind: "flow",
    style: "subtotal",
    tags: ["GrossProfit"],
    derive: { plus: ["revenue"], minus: ["cogs"] },
  },
  {
    key: "rd",
    label: "Research & Development",
    kind: "flow",
    indent: true,
    tags: ["ResearchAndDevelopmentExpense", "ResearchAndDevelopmentExpenseExcludingAcquiredInProcessCost"],
  },
  {
    key: "sga",
    label: "Selling, General & Admin",
    kind: "flow",
    indent: true,
    tags: ["SellingGeneralAndAdministrativeExpense"],
  },
  {
    key: "salesMarketing",
    label: "Sales & Marketing",
    kind: "flow",
    indent: true,
    tags: ["SellingAndMarketingExpense", "MarketingAndAdvertisingExpense"],
  },
  {
    key: "ga",
    label: "General & Administrative",
    kind: "flow",
    indent: true,
    tags: ["GeneralAndAdministrativeExpense"],
  },
  {
    key: "opex",
    label: "Total Operating Expenses",
    kind: "flow",
    tags: ["OperatingExpenses", "CostsAndExpenses"],
  },
  {
    key: "operatingIncome",
    label: "Operating Income",
    kind: "flow",
    style: "subtotal",
    tags: ["OperatingIncomeLoss"],
  },
  {
    key: "interestExpense",
    label: "Interest Expense",
    kind: "flow",
    tags: ["InterestExpense", "InterestExpenseNonoperating", "InterestAndDebtExpense"],
  },
  {
    key: "pretaxIncome",
    label: "Pre-Tax Income",
    kind: "flow",
    tags: [
      "IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest",
      "IncomeLossFromContinuingOperationsBeforeIncomeTaxesMinorityInterestAndIncomeLossFromEquityMethodInvestments",
      "IncomeLossFromContinuingOperationsBeforeIncomeTaxesDomestic",
    ],
  },
  {
    key: "taxes",
    label: "Income Taxes",
    kind: "flow",
    tags: ["IncomeTaxExpenseBenefit"],
  },
  {
    key: "netIncome",
    label: "Net Income",
    kind: "flow",
    style: "total",
    tags: ["NetIncomeLoss", "ProfitLoss", "NetIncomeLossAvailableToCommonStockholdersBasic"],
  },
  {
    key: "epsBasic",
    label: "EPS (Basic)",
    kind: "flow",
    perShare: true,
    tags: ["EarningsPerShareBasic"],
  },
  {
    key: "epsDiluted",
    label: "EPS (Diluted)",
    kind: "flow",
    perShare: true,
    tags: ["EarningsPerShareDiluted"],
  },
  {
    key: "sharesDiluted",
    label: "Diluted Shares Outstanding",
    kind: "flow",
    shares: true,
    tags: [
      "WeightedAverageNumberOfDilutedSharesOutstanding",
      "WeightedAverageNumberOfSharesOutstandingBasic",
    ],
  },
];

const BALANCE: LineDef[] = [
  {
    key: "cash",
    label: "Cash & Equivalents",
    kind: "instant",
    tags: ["CashAndCashEquivalentsAtCarryingValue", "CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents"],
  },
  {
    key: "stInvestments",
    label: "Short-Term Investments",
    kind: "instant",
    tags: ["ShortTermInvestments", "MarketableSecuritiesCurrent", "AvailableForSaleSecuritiesDebtSecuritiesCurrent"],
  },
  {
    key: "receivables",
    label: "Accounts Receivable",
    kind: "instant",
    tags: ["AccountsReceivableNetCurrent", "ReceivablesNetCurrent"],
  },
  { key: "inventory", label: "Inventory", kind: "instant", tags: ["InventoryNet"] },
  {
    key: "currentAssets",
    label: "Total Current Assets",
    kind: "instant",
    style: "subtotal",
    tags: ["AssetsCurrent"],
  },
  {
    key: "ppe",
    label: "Property, Plant & Equipment",
    kind: "instant",
    tags: ["PropertyPlantAndEquipmentNet"],
  },
  { key: "goodwill", label: "Goodwill", kind: "instant", tags: ["Goodwill"] },
  {
    key: "intangibles",
    label: "Intangible Assets",
    kind: "instant",
    tags: ["IntangibleAssetsNetExcludingGoodwill", "FiniteLivedIntangibleAssetsNet"],
  },
  { key: "totalAssets", label: "Total Assets", kind: "instant", style: "total", tags: ["Assets"] },
  {
    key: "payables",
    label: "Accounts Payable",
    kind: "instant",
    tags: ["AccountsPayableCurrent", "AccountsPayableAndAccruedLiabilitiesCurrent"],
  },
  {
    key: "currentLiabilities",
    label: "Total Current Liabilities",
    kind: "instant",
    style: "subtotal",
    tags: ["LiabilitiesCurrent"],
  },
  {
    key: "stDebt",
    label: "Short-Term Debt",
    kind: "instant",
    tags: ["LongTermDebtCurrent", "DebtCurrent", "ShortTermBorrowings", "CommercialPaper"],
  },
  {
    key: "ltDebt",
    label: "Long-Term Debt",
    kind: "instant",
    tags: ["LongTermDebtNoncurrent", "LongTermDebt", "LongTermDebtAndCapitalLeaseObligations"],
  },
  {
    key: "totalLiabilities",
    label: "Total Liabilities",
    kind: "instant",
    style: "total",
    tags: ["Liabilities"],
  },
  {
    key: "equity",
    label: "Shareholders' Equity",
    kind: "instant",
    style: "total",
    tags: [
      "StockholdersEquity",
      "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest",
    ],
  },
];

const CASHFLOW: LineDef[] = [
  {
    key: "ocf",
    label: "Operating Cash Flow",
    kind: "flow",
    style: "subtotal",
    tags: [
      "NetCashProvidedByUsedInOperatingActivities",
      "NetCashProvidedByUsedInOperatingActivitiesContinuingOperations",
    ],
  },
  {
    key: "da",
    label: "Depreciation & Amortization",
    kind: "flow",
    indent: true,
    tags: [
      "DepreciationDepletionAndAmortization",
      "DepreciationAmortizationAndAccretionNet",
      "DepreciationAndAmortization",
      "Depreciation",
    ],
  },
  {
    key: "sbc",
    label: "Stock-Based Compensation",
    kind: "flow",
    indent: true,
    tags: ["ShareBasedCompensation", "AllocatedShareBasedCompensationExpense"],
  },
  {
    key: "capex",
    label: "Capital Expenditures",
    kind: "flow",
    flipSign: true,
    tags: [
      "PaymentsToAcquirePropertyPlantAndEquipment",
      "PaymentsToAcquireProductiveAssets",
      "PaymentsForCapitalImprovements",
    ],
  },
  {
    key: "fcf",
    label: "Free Cash Flow",
    kind: "flow",
    style: "total",
    tags: [],
    derive: { plus: ["ocf", "capex"], minus: [] }, // capex already negative via flipSign
  },
  {
    key: "icf",
    label: "Investing Cash Flow",
    kind: "flow",
    style: "subtotal",
    tags: [
      "NetCashProvidedByUsedInInvestingActivities",
      "NetCashProvidedByUsedInInvestingActivitiesContinuingOperations",
    ],
  },
  {
    key: "buybacks",
    label: "Share Buybacks",
    kind: "flow",
    flipSign: true,
    indent: true,
    tags: ["PaymentsForRepurchaseOfCommonStock"],
  },
  {
    key: "dividends",
    label: "Dividends Paid",
    kind: "flow",
    flipSign: true,
    indent: true,
    tags: ["PaymentsOfDividends", "PaymentsOfDividendsCommonStock", "PaymentsOfOrdinaryDividends"],
  },
  {
    key: "fincf",
    label: "Financing Cash Flow",
    kind: "flow",
    style: "subtotal",
    tags: [
      "NetCashProvidedByUsedInFinancingActivities",
      "NetCashProvidedByUsedInFinancingActivitiesContinuingOperations",
    ],
  },
];

const STATEMENT_DEFS: { title: string; lines: LineDef[] }[] = [
  { title: "Income Statement", lines: INCOME },
  { title: "Balance Sheet", lines: BALANCE },
  { title: "Cash Flow Statement", lines: CASHFLOW },
];

// ---------------------------------------------------------------------------

function daysBetween(a: string, b: string): number {
  return (new Date(b).getTime() - new Date(a).getTime()) / 86400000;
}

function pickUnit(units: Record<string, Fact[]>): Fact[] | null {
  for (const u of ["USD", "USD/shares", "shares", "pure"]) {
    if (units[u]) return units[u];
  }
  const first = Object.keys(units)[0];
  return first ? units[first] : null;
}

/** Dedupe facts by end date, preferring the most recently filed value. */
function latestByEnd(facts: Fact[]): Map<string, Fact> {
  const m = new Map<string, Fact>();
  for (const f of facts) {
    const prev = m.get(f.end);
    if (!prev || f.filed >= prev.filed) m.set(f.end, f);
  }
  return m;
}

interface TagSeries {
  annual: Map<string, number>; // end date -> value
  quarterly: Map<string, number>;
}

/** Split a tag's facts into annual and quarterly series keyed by period end. */
function buildSeries(facts: Fact[], kind: Kind, q4Mode: "subtract" | "average" = "subtract"): TagSeries {
  const annual = new Map<string, number>();
  const quarterly = new Map<string, number>();

  if (kind === "instant") {
    // Instant facts: quarterly = every reported balance date; annual = 10-K dates.
    const byEnd = latestByEnd(facts);
    const annualEnds = new Set(
      facts.filter((f) => f.form === "10-K" || f.fp === "FY").map((f) => f.end)
    );
    for (const [end, f] of byEnd) {
      quarterly.set(end, f.val);
      if (annualEnds.has(end)) annual.set(end, f.val);
    }
    return { annual, quarterly };
  }

  // Flow facts: classify by duration.
  const annualFacts: Fact[] = [];
  const quarterlyFacts: Fact[] = [];
  for (const f of facts) {
    if (!f.start) continue;
    const d = daysBetween(f.start, f.end);
    if (d >= 340 && d <= 380) annualFacts.push(f);
    else if (d >= 75 && d <= 105) quarterlyFacts.push(f);
  }
  for (const [end, f] of latestByEnd(annualFacts)) annual.set(end, f.val);
  for (const [end, f] of latestByEnd(quarterlyFacts)) quarterly.set(end, f.val);

  // Derive Q4 (or any missing final quarter): annual minus the 3 quarters inside it.
  for (const [end, fyVal] of annual) {
    if (quarterly.has(end)) continue;
    const endT = new Date(end).getTime();
    const inside = [...quarterly.entries()].filter(([qEnd]) => {
      const t = new Date(qEnd).getTime();
      return t < endT && t > endT - 360 * 86400000;
    });
    if (inside.length === 3) {
      const sum = inside.reduce((s, [, v]) => s + v, 0);
      // Flow items sum to the annual total; averages (share counts) do not —
      // there Q4 is backed out from the annual average instead.
      quarterly.set(end, q4Mode === "average" ? 4 * fyVal - sum : fyVal - sum);
    }
  }
  return { annual, quarterly };
}

function fmtQuarterLabel(end: string): string {
  const d = new Date(end + "T00:00:00Z");
  const month = d.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
  return `${month} '${String(d.getUTCFullYear()).slice(2)}`;
}

function nearestKey(keys: string[], target: number, tolDays: number): string | null {
  let best: string | null = null;
  let bestDiff = Infinity;
  for (const k of keys) {
    const diff = Math.abs(new Date(k).getTime() - target);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = k;
    }
  }
  return bestDiff <= tolDays * 86400000 ? best : null;
}

function pctChange(cur: number | null, prev: number | null): number | null {
  if (cur == null || prev == null || prev === 0) return null;
  return (cur - prev) / Math.abs(prev);
}

function buildStatementSet(
  gaap: Record<string, { units: Record<string, Fact[]> }>,
  freq: "annual" | "quarterly"
): StatementSet {
  // Resolve each line's series first.
  const seriesByLine = new Map<string, Map<string, number>>();
  const defsByKey = new Map<string, LineDef>();

  for (const { lines } of STATEMENT_DEFS) {
    for (const def of lines) {
      defsByKey.set(def.key, def);
      // Consider every fallback tag; prefer the series with the freshest data,
      // then the deepest history (companies switch tags over the years, and a
      // stale tag can otherwise shadow the live one — e.g. JPM's Revenues vs
      // RevenuesNetOfInterestExpense).
      let series = new Map<string, number>();
      let bestLatest = "";
      for (const tag of def.tags) {
        const entry = gaap[tag];
        if (!entry) continue;
        const facts = pickUnit(entry.units);
        if (!facts || facts.length === 0) continue;
        const s = buildSeries(facts, def.kind, def.shares ? "average" : "subtract")[freq];
        if (s.size === 0) continue;
        const latest = [...s.keys()].sort().pop()!;
        if (latest > bestLatest || (latest === bestLatest && s.size > series.size)) {
          series = s;
          bestLatest = latest;
        }
      }
      if (def.flipSign) {
        const flipped = new Map<string, number>();
        for (const [k, v] of series) flipped.set(k, -v);
        series = flipped;
      }
      seriesByLine.set(def.key, series);
    }
  }

  // Derived lines (gross profit fallback, FCF).
  for (const [key, def] of defsByKey) {
    if (!def.derive) continue;
    const existing = seriesByLine.get(key)!;
    const sources = [...def.derive.plus, ...def.derive.minus].map(
      (k) => seriesByLine.get(k) ?? new Map<string, number>()
    );
    if (sources.some((s) => s.size === 0)) continue;
    const base = seriesByLine.get(def.derive.plus[0])!;
    for (const end of base.keys()) {
      if (existing.has(end)) continue;
      let val = 0;
      let ok = true;
      for (const k of def.derive.plus) {
        const v = seriesByLine.get(k)?.get(end);
        if (v == null) { ok = false; break; }
        val += v;
      }
      if (ok) {
        for (const k of def.derive.minus) {
          const v = seriesByLine.get(k)?.get(end);
          if (v == null) { ok = false; break; }
          val -= v;
        }
      }
      if (ok) existing.set(end, val);
    }
  }

  // Build the unified period axis from anchor lines.
  const anchorKeys = ["revenue", "netIncome", "totalAssets", "ocf"];
  const allEnds = new Set<string>();
  for (const k of anchorKeys) {
    for (const end of seriesByLine.get(k)?.keys() ?? []) allEnds.add(end);
  }
  const sorted = [...allEnds].sort().reverse(); // newest first
  const periods: PeriodCol[] = sorted.map((end) => ({
    key: end,
    end,
    label:
      freq === "annual"
        ? `FY${new Date(end).getUTCFullYear()}`
        : fmtQuarterLabel(end),
  }));

  // Assemble statements with YoY/QoQ.
  const yearMs = 365 * 86400000;
  const quarterMs = 91 * 86400000;
  const statements: Statement[] = STATEMENT_DEFS.map(({ title, lines }) => ({
    title,
    lines: lines
      .map((def) => {
        const series = seriesByLine.get(def.key)!;
        if (series.size === 0) return null;
        const keys = [...series.keys()];
        const values: Record<string, number | null> = {};
        const yoy: Record<string, number | null> = {};
        const qoq: Record<string, number | null> = {};
        for (const p of periods) {
          const cur = series.get(p.key) ?? null;
          values[p.key] = cur;
          const t = new Date(p.key).getTime();
          const yoyKey = nearestKey(keys.filter((k) => k !== p.key), t - yearMs, 20);
          yoy[p.key] = pctChange(cur, yoyKey ? series.get(yoyKey)! : null);
          if (freq === "quarterly") {
            const qoqKey = nearestKey(keys.filter((k) => k !== p.key), t - quarterMs, 20);
            qoq[p.key] = pctChange(cur, qoqKey ? series.get(qoqKey)! : null);
          }
        }
        return {
          key: def.key,
          label: def.label,
          values,
          yoy,
          qoq,
          style: def.style ?? "normal",
          indent: def.indent,
          perShare: def.perShare,
          shares: def.shares,
        } as LineValues;
      })
      .filter((l): l is LineValues => l !== null),
  }));

  return { periods, statements };
}

// ---------------------------------------------------------------------------

export async function fetchCompanyFacts(cik: string): Promise<unknown> {
  const padded = cik.padStart(10, "0");
  const res = await fetch(
    `https://data.sec.gov/api/xbrl/companyfacts/CIK${padded}.json`,
    { headers: { "User-Agent": UA }, next: { revalidate: 21600 } }
  );
  if (!res.ok) throw new Error(`EDGAR responded ${res.status}`);
  return res.json();
}

export async function getCompanyFinancials(
  cik: string,
  ticker: string
): Promise<CompanyFinancials> {
  const raw = (await fetchCompanyFacts(cik)) as {
    entityName: string;
    facts: { "us-gaap"?: Record<string, { units: Record<string, Fact[]> }> };
  };
  const gaap = raw.facts["us-gaap"];
  if (!gaap) throw new Error("No US-GAAP facts available for this company");
  return {
    name: raw.entityName,
    cik,
    ticker,
    annual: buildStatementSet(gaap, "annual"),
    quarterly: buildStatementSet(gaap, "quarterly"),
  };
}

/** Company profile facts from the SEC submissions API (free, reliable). */
export interface SecProfile {
  name: string;
  sicDescription: string | null;
  stateOfIncorporation: string | null;
  fiscalYearEnd: string | null;
  website: string | null;
}

export async function getSecProfile(cik: string): Promise<SecProfile | null> {
  try {
    const padded = cik.padStart(10, "0");
    const res = await fetch(`https://data.sec.gov/submissions/CIK${padded}.json`, {
      headers: { "User-Agent": UA },
      next: { revalidate: 86400 },
    });
    if (!res.ok) return null;
    const d = await res.json();
    return {
      name: d.name,
      sicDescription: d.sicDescription || null,
      stateOfIncorporation: d.stateOfIncorporation || null,
      fiscalYearEnd: d.fiscalYearEnd || null,
      website: d.website || null,
    };
  } catch {
    return null;
  }
}

// --- Ticker directory -------------------------------------------------------

export interface TickerEntry {
  cik: string;
  ticker: string;
  name: string;
}

let tickerCache: { at: number; list: TickerEntry[] } | null = null;

export async function getTickerDirectory(): Promise<TickerEntry[]> {
  if (tickerCache && Date.now() - tickerCache.at < 86400000) return tickerCache.list;
  const res = await fetch("https://www.sec.gov/files/company_tickers.json", {
    headers: { "User-Agent": UA },
    next: { revalidate: 86400 },
  });
  if (!res.ok) throw new Error(`SEC ticker list responded ${res.status}`);
  const data = (await res.json()) as Record<
    string,
    { cik_str: number; ticker: string; title: string }
  >;
  const list = Object.values(data).map((e) => ({
    cik: String(e.cik_str),
    ticker: e.ticker,
    name: e.title,
  }));
  tickerCache = { at: Date.now(), list };
  return list;
}

export async function searchTickers(query: string, limit = 8): Promise<TickerEntry[]> {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const list = await getTickerDirectory();
  const scored: { score: number; e: TickerEntry }[] = [];
  for (const e of list) {
    const t = e.ticker.toLowerCase();
    const n = e.name.toLowerCase();
    let score = 0;
    if (t === q) score = 100;
    else if (t.startsWith(q)) score = 80 - t.length;
    else if (n.startsWith(q)) score = 60;
    else if (n.includes(q)) score = 40;
    if (score > 0) scored.push({ score, e });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.e);
}
