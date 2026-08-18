// IFRS-full → statement line bridge for SEC companyfacts.
//
// Foreign private issuers (20-F / 40-F) often tag under the `ifrs-full`
// taxonomy instead of `us-gaap`. Tag names are verified against live
// companyfacts (e.g. Novartis / NVS) and the IFRS taxonomy common practice set.
//
// Line keys match STATEMENT_DEFS in line-defs.ts. When us-gaap is present for a
// concept, us-gaap wins. IFRS fills gaps only.
//
// Not every IFRS line exists for every filer — coverage is opportunistic.

/**
 * IFRS-full concept local names for each normalized line key.
 *
 * Order is preference (first available tag wins when injecting). Prefer
 * consolidated / parent-attributable / contracts-with-customers variants.
 */
export const IFRS_LINE_TAGS: Record<string, string[]> = {
  // ── Income statement ──────────────────────────────────────────────
  revenue: [
    "RevenueFromContractsWithCustomers",
    "Revenue",
    "RevenueFromSaleOfGoods",
    "RevenueFromRenderingOfServices",
    "RevenueFromConstructionContracts",
  ],
  cogs: [
    "CostOfSales",
    "CostOfGoodsSold",
    "CostOfMerchandiseSold",
    "CostOfInventoriesRecognisedAsExpenseDuringPeriod",
  ],
  grossProfit: ["GrossProfit"],
  rd: ["ResearchAndDevelopmentExpense"],
  sga: [
    "SellingGeneralAndAdministrativeExpense",
    "SellingAndAdministrativeExpense",
  ],
  salesMarketing: [
    "SalesAndMarketingExpense",
    "SellingExpense",
    "MarketingExpense",
    "DistributionCosts",
  ],
  ga: ["AdministrativeExpense", "GeneralAndAdministrativeExpense"],
  // Total opex is often derived (grossProfit − operatingIncome); tag when present.
  opex: [
    "OperatingExpense",
    "OperatingExpenses",
    "DistributionCosts",
  ],
  operatingIncome: ["ProfitLossFromOperatingActivities"],
  impairment: [
    "ImpairmentLossRecognisedInProfitOrLoss",
    "ImpairmentLossRecognisedInProfitOrLossGoodwill",
    "ImpairmentLossRecognisedInProfitOrLossPropertyPlantAndEquipment",
    "ImpairmentLossRecognisedInProfitOrLossIntangibleAssetsOtherThanGoodwill",
    "ImpairmentLossReversalOfImpairmentLossRecognisedInProfitOrLoss",
  ],
  restructuring: ["ExpenseOfRestructuringActivities", "RestructuringCosts"],
  gainOnSale: [
    "GainsOnDisposalsOfPropertyPlantAndEquipment",
    "GainsOnDisposalsOfInvestmentProperties",
    "GainsOnDisposalsOfInvestments",
    "GainsLossesOnDisposalsOfNoncurrentAssets",
  ],
  // EBITDA is derived (operatingIncome + da) — no native IFRS tag required.
  // Finance costs / interest. No separate STATEMENT_DEFS host for finance
  // income — FinanceIncome is intentionally unmapped (would need its own line).
  interestExpense: [
    "FinanceCosts",
    "InterestExpense",
    "InterestExpenseOnBankOverdraftsAndLoans",
    "InterestExpenseOnBorrowings",
    "InterestExpenseOnLeaseLiabilities",
    "OtherFinanceCost",
  ],
  netInterestIncome: [
    "InterestRevenueExpense",
    "InterestRevenueCalculatedUsingEffectiveInterestMethod",
    "InterestRevenue",
    "InterestIncome",
  ],
  premiumsEarned: [
    "InsuranceRevenue",
    "InsuranceRevenueFromInsuranceContractsIssued",
  ],
  policyBenefits: [
    "InsuranceServiceExpense",
    "InsuranceServiceExpensesFromInsuranceContractsIssued",
    "ClaimsAndBenefitsPaidNetOfReinsuranceRecoveries",
  ],
  pretaxIncome: ["ProfitLossBeforeTax", "AccountingProfit"],
  taxes: [
    "IncomeTaxExpenseContinuingOperations",
    "IncomeTaxExpenseIncome",
    "CurrentTaxExpenseIncome",
  ],
  netIncome: [
    "ProfitLossAttributableToOwnersOfParent",
    "ProfitLossAttributableToOrdinaryEquityHoldersOfParentEntity",
    "ProfitLoss",
  ],
  epsBasic: [
    "BasicEarningsLossPerShare",
    "BasicEarningsLossPerShareFromContinuingOperations",
  ],
  epsDiluted: [
    "DilutedEarningsLossPerShare",
    "DilutedEarningsLossPerShareFromContinuingOperations",
  ],
  sharesDiluted: [
    "DilutedWeightedAverageShares",
    "AdjustedWeightedAverageShares",
    "WeightedAverageShares",
    "WeightedAverageNumberOfOrdinarySharesOutstandingDiluted",
  ],
  sharesBasic: [
    "WeightedAverageShares",
    "WeightedAverageNumberOfOrdinarySharesOutstanding",
    "BasicWeightedAverageShares",
  ],

  // ── Balance sheet ─────────────────────────────────────────────────
  cash: [
    "CashAndCashEquivalents",
    "Cash",
    "CashEquivalents",
  ],
  stInvestments: [
    "CurrentFinancialAssets",
    "CurrentFinancialAssetsAvailableforsale",
    "CurrentInvestments",
    "OtherCurrentFinancialAssets",
  ],
  receivables: [
    "CurrentTradeReceivables",
    "TradeAndOtherCurrentReceivables",
    "TradeReceivables",
    "TradeAndOtherReceivables",
  ],
  inventory: ["Inventories", "InventoriesTotal"],
  currentAssets: ["CurrentAssets"],
  // PPE + IFRS 16 right-of-use when filers combine or only tag ROU.
  ppe: [
    "PropertyPlantAndEquipment",
    "PropertyPlantAndEquipmentIncludingRightofuseAssets",
    "RightofuseAssets",
  ],
  goodwill: ["Goodwill"],
  intangibles: [
    "IntangibleAssetsOtherThanGoodwill",
    "IntangibleAssetsAndGoodwill",
  ],
  ltInvestments: [
    "NoncurrentFinancialAssets",
    "NoncurrentFinancialAssetsAvailableforsale",
    "InvestmentsInAssociates",
    "InvestmentsInJointVentures",
    "OtherNoncurrentFinancialAssets",
  ],
  totalAssets: ["Assets"],
  payables: [
    "TradeAndOtherPayablesToTradeSuppliers",
    "TradeAndOtherCurrentPayables",
    "CurrentTradePayables",
    "TradeAndOtherPayables",
  ],
  currentLiabilities: ["CurrentLiabilities"],
  // Borrowings first; IFRS 16 lease liabilities only as gap-fill so we never
  // replace true debt with lease-only figures when both exist (us-gaap wins
  // anyway; within IFRS the first tag with units wins).
  stDebt: [
    "CurrentBorrowings",
    "CurrentPortionOfLongtermBorrowings",
    "ShorttermBorrowings",
    "CurrentLoansReceivedAndCurrentPortionOfNoncurrentLoansReceived",
    "CurrentLeaseLiabilities",
  ],
  ltDebt: [
    "NoncurrentBorrowings",
    "LongtermBorrowings",
    "NoncurrentLoansReceived",
    // Total borrowings — last resort (may include current portion).
    "Borrowings",
    // Lease liability companions (IFRS 16) — after borrowings only.
    "NoncurrentLeaseLiabilities",
    "LeaseLiabilities",
    "FinanceLeaseLiabilities",
  ],
  deposits: ["DepositsFromCustomers", "DepositsFromBanks"],
  totalLiabilities: ["Liabilities"],
  retainedEarnings: [
    "RetainedEarnings",
    "RetainedEarningsProfitLossForPeriod",
  ],
  equity: [
    "EquityAttributableToOwnersOfParent",
    "Equity",
  ],
  leaseLiability: [
    "LeaseLiabilities",
    "NoncurrentLeaseLiabilities",
    "CurrentLeaseLiabilities",
  ],
  nci: [
    "NoncontrollingInterests",
    "EquityAttributableToNoncontrollingInterests",
  ],
  preferredEquity: [
    "IssuedCapitalPreferenceShares",
    "PreferenceShares",
  ],
  pensionLiab: [
    "NoncurrentRecognisedLiabilitiesDefinedBenefitPlan",
    "CurrentRecognisedLiabilitiesDefinedBenefitPlan",
    "DefinedBenefitObligationAtPresentValue",
  ],
  pensionAssets: [
    "NoncurrentRecognisedAssetsDefinedBenefitPlan",
    "PlanAssetsAtFairValue",
    "CurrentRecognisedAssetsDefinedBenefitPlan",
  ],
  restrictedCash: [
    "RestrictedCashAndCashEquivalents",
    "NoncurrentRestrictedCashAndCashEquivalents",
  ],

  // ── Cash flow ─────────────────────────────────────────────────────
  ocf: [
    "CashFlowsFromUsedInOperatingActivities",
    "CashFlowsFromUsedInOperatingActivitiesContinuingOperations",
    "CashFlowsFromUsedInOperations",
  ],
  da: [
    "DepreciationAmortisationAndImpairmentLossReversalOfImpairmentLossRecognisedInProfitOrLoss",
    "AdjustmentsForDepreciationAndAmortisationExpenseAndImpairmentLossReversalOfImpairmentLossRecognisedInProfitOrLoss",
    "DepreciationAndAmortisationExpense",
    "DepreciationPropertyPlantAndEquipment",
    "DepreciationAmortisationAndImpairmentLossReversalOfImpairmentLossRecognisedInProfitOrLossPropertyPlantAndEquipment",
  ],
  sbc: [
    "ExpenseFromSharebasedPaymentTransactionsWithEmployees",
    "AdjustmentsForSharebasedPayments",
    "ExpenseFromEquitysettledSharebasedPaymentTransactionsInWhichGoodsOrServicesReceivedDidNotQualifyForRecognitionAsAssets",
  ],
  // Positive purchase amounts — host under a flipSign US-GAAP tag so sign flips.
  capex: [
    "PurchaseOfPropertyPlantAndEquipmentClassifiedAsInvestingActivities",
    "PurchaseOfPropertyPlantAndEquipmentIntangibleAssetsOtherThanGoodwillInvestmentPropertyAndOtherNoncurrentAssets",
    "PurchaseOfIntangibleAssetsClassifiedAsInvestingActivities",
    "PurchaseOfPropertyPlantAndEquipment",
  ],
  // fcf is derived from ocf + capex — no direct tag.
  icf: [
    "CashFlowsFromUsedInInvestingActivities",
    "CashFlowsFromUsedInInvestingActivitiesContinuingOperations",
  ],
  buybacks: [
    "PaymentsToAcquireOrRedeemEntitysShares",
    "PurchaseOfTreasuryShares",
  ],
  dividends: [
    "DividendsPaid",
    "DividendsPaidToEquityHoldersOfParentClassifiedAsFinancingActivities",
    "DividendsPaidClassifiedAsFinancingActivities",
  ],
  fincf: [
    "CashFlowsFromUsedInFinancingActivities",
    "CashFlowsFromUsedInFinancingActivitiesContinuingOperations",
  ],
  netChangeInCash: [
    "IncreaseDecreaseInCashAndCashEquivalents",
    "IncreaseDecreaseInCashAndCashEquivalentsBeforeEffectOfExchangeRateChanges",
    "IncreaseDecreaseInCashAndCashEquivalentsBeforeEffectOfExchangeRateChange",
  ],
};

/** Line keys we attempt to fill from ifrs-full (stable list for docs/tests). */
export const IFRS_MAPPED_LINE_KEYS = Object.keys(IFRS_LINE_TAGS);

/** Concept bag shape shared by us-gaap and ifrs-full namespaces. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type FactsBag = Record<string, { units: Record<string, any[]> }>;

export interface IfrsMergeResult {
  bag: FactsBag;
  usedIfrs: boolean;
  taxonomy: "us-gaap" | "ifrs-full" | "mixed";
  /** Line keys successfully filled from ifrs-full. */
  linesFromIfrs: string[];
}

function factHasUnits(entry: FactsBag[string] | undefined): boolean {
  if (!entry?.units) return false;
  return Object.values(entry.units).some((arr) => Array.isArray(arr) && arr.length > 0);
}

/**
 * Prefer us-gaap concepts; inject IFRS facts under the first us-gaap tag name
 * for each mapped line so the existing STATEMENT_DEFS resolver finds them.
 */
export function mergeUsGaapWithIfrs(
  usGaap: FactsBag | undefined,
  ifrsFull: FactsBag | undefined,
  /** us-gaap tag lists keyed by line key (from STATEMENT_DEFS). */
  usGaapTagsByLine: Record<string, string[]>
): IfrsMergeResult {
  const bag: FactsBag = usGaap ? { ...usGaap } : {};
  const linesFromIfrs: string[] = [];

  if (!ifrsFull) {
    return { bag, usedIfrs: false, taxonomy: "us-gaap", linesFromIfrs };
  }

  for (const [lineKey, ifrsTags] of Object.entries(IFRS_LINE_TAGS)) {
    const usTags = usGaapTagsByLine[lineKey] ?? [];
    const hasUs = usTags.some((t) => factHasUnits(bag[t]));
    if (hasUs) continue;

    let injected: FactsBag[string] | null = null;
    for (const tag of ifrsTags) {
      const entry = ifrsFull[tag];
      if (factHasUnits(entry)) {
        injected = entry!;
        break;
      }
    }
    if (!injected) continue;

    // Host under a known us-gaap local name so STATEMENT_DEFS.tags resolve it.
    // Prefer a non-empty us-gaap host; fall back to the IFRS tag name itself
    // (buildSeries still sees it if STATEMENT_DEFS lists a matching tag — rare —
    // so we always also need a host that STATEMENT_DEFS knows).
    const host = usTags.find((t) => t.length > 0);
    if (!host) {
      // Derived-only lines (fcf, ebitda) have empty tags — skip host injection.
      continue;
    }
    if (!bag[host]) {
      bag[host] = injected;
      linesFromIfrs.push(lineKey);
    }
  }

  const usedIfrs = linesFromIfrs.length > 0;
  const hasUsBag = Boolean(usGaap && Object.keys(usGaap).length > 0);
  let taxonomy: "us-gaap" | "ifrs-full" | "mixed" = "us-gaap";
  if (usedIfrs && hasUsBag) taxonomy = "mixed";
  else if (usedIfrs && !hasUsBag) taxonomy = "ifrs-full";
  else if (hasUsBag) taxonomy = "us-gaap";

  return { bag, usedIfrs, taxonomy, linesFromIfrs };
}

/** Human-readable coverage summary for UI badges. */
export function ifrsCoverageLabel(linesFromIfrs: string[] | undefined | null): string {
  const n = linesFromIfrs?.length ?? 0;
  if (n <= 0) return "IFRS-tagged facts";
  return `IFRS · ${n} line${n === 1 ? "" : "s"}`;
}

/**
 * High-value statement lines analysts expect first. Used by the Overview
 * coverage meter to surface gaps when taxonomy is ifrs-full or mixed.
 * Subset of STATEMENT_DEFS keys that also appear in IFRS_LINE_TAGS (except
 * derived-only hosts like fcf/ebitda which are never directly IFRS-injected).
 */
export const IFRS_HIGH_VALUE_LINE_KEYS = [
  "revenue",
  "operatingIncome",
  "netIncome",
  "epsDiluted",
  "cash",
  "totalAssets",
  "equity",
  "ltDebt",
  "ocf",
  "capex",
  "dividends",
  "buybacks",
] as const;

export interface IfrsCoverageLine {
  key: string;
  label: string;
}

export interface IfrsCoverageReport {
  taxonomy: "us-gaap" | "ifrs-full" | "mixed" | undefined;
  /** Lines successfully filled from ifrs-full (labels from STATEMENT_DEFS). */
  mapped: IfrsCoverageLine[];
  /** High-value lines we attempt via IFRS tags but did not fill. */
  missingHighValue: IfrsCoverageLine[];
  mappedCount: number;
  /** How many IFRS-mappable STATEMENT_DEFS keys exist. */
  attemptedCount: number;
}

function statementLabelByKey(): Map<string, string> {
  // Lazy import shape: STATEMENT_DEFS is co-located and dependency-free both ways.
  // Inline labels for high-value keys + fall back to key for anything else so
  // this module stays free of a hard line-defs import cycle risk in scripts.
  const labels = new Map<string, string>([
    ["revenue", "Revenue"],
    ["cogs", "Cost of Revenue"],
    ["grossProfit", "Gross Profit"],
    ["rd", "Research & Development"],
    ["sga", "Selling, General & Admin"],
    ["salesMarketing", "Sales & Marketing"],
    ["ga", "General & Administrative"],
    ["opex", "Total Operating Expenses"],
    ["operatingIncome", "Operating Income"],
    ["impairment", "Impairment Charges"],
    ["restructuring", "Restructuring Charges"],
    ["gainOnSale", "Gain on Sale"],
    ["interestExpense", "Interest Expense"],
    ["netInterestIncome", "Net Interest Income"],
    ["premiumsEarned", "Premiums Earned"],
    ["policyBenefits", "Policyholder Benefits"],
    ["pretaxIncome", "Pre-Tax Income"],
    ["taxes", "Income Taxes"],
    ["netIncome", "Net Income"],
    ["epsBasic", "EPS (Basic)"],
    ["epsDiluted", "EPS (Diluted)"],
    ["sharesDiluted", "Diluted Shares Outstanding"],
    ["sharesBasic", "Basic Shares Outstanding"],
    ["cash", "Cash & Equivalents"],
    ["stInvestments", "Short-Term Investments"],
    ["receivables", "Accounts Receivable"],
    ["inventory", "Inventory"],
    ["currentAssets", "Total Current Assets"],
    ["ppe", "Property, Plant & Equipment"],
    ["goodwill", "Goodwill"],
    ["intangibles", "Intangible Assets"],
    ["ltInvestments", "Long-Term Investments"],
    ["totalAssets", "Total Assets"],
    ["payables", "Accounts Payable"],
    ["currentLiabilities", "Total Current Liabilities"],
    ["stDebt", "Short-Term Debt"],
    ["ltDebt", "Long-Term Debt"],
    ["deposits", "Deposits"],
    ["totalLiabilities", "Total Liabilities"],
    ["retainedEarnings", "Retained Earnings"],
    ["equity", "Shareholders' Equity"],
    ["leaseLiability", "Lease Liabilities"],
    ["nci", "Noncontrolling Interest"],
    ["preferredEquity", "Preferred Equity"],
    ["pensionLiab", "Pension Liabilities"],
    ["pensionAssets", "Pension Plan Assets"],
    ["restrictedCash", "Restricted Cash"],
    ["ocf", "Operating Cash Flow"],
    ["da", "Depreciation & Amortization"],
    ["sbc", "Stock-Based Compensation"],
    ["capex", "Capital Expenditures"],
    ["icf", "Investing Cash Flow"],
    ["buybacks", "Share Repurchases"],
    ["dividends", "Dividends Paid"],
    ["fincf", "Financing Cash Flow"],
    ["netChangeInCash", "Net Change in Cash"],
  ]);
  return labels;
}

/**
 * Coverage report for Overview: which statement lines came from IFRS vs which
 * high-value lines are still missing. Pure — no network.
 */
export function buildIfrsCoverageReport(
  ifrsLineKeys: string[] | undefined | null,
  taxonomy?: "us-gaap" | "ifrs-full" | "mixed"
): IfrsCoverageReport {
  const labels = statementLabelByKey();
  const mappedSet = new Set(
    (ifrsLineKeys ?? []).filter((k) => typeof k === "string" && k.length > 0)
  );
  const mapped: IfrsCoverageLine[] = [...mappedSet]
    .map((key) => ({ key, label: labels.get(key) ?? key }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const missingHighValue: IfrsCoverageLine[] = [];
  for (const key of IFRS_HIGH_VALUE_LINE_KEYS) {
    if (mappedSet.has(key)) continue;
    // Only report as missing if we have an IFRS tag attempt for this key.
    if (!IFRS_LINE_TAGS[key]?.length) continue;
    missingHighValue.push({ key, label: labels.get(key) ?? key });
  }

  return {
    taxonomy,
    mapped,
    missingHighValue,
    mappedCount: mapped.length,
    attemptedCount: IFRS_MAPPED_LINE_KEYS.length,
  };
}
