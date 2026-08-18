// XBRL tag maps: the concepts we normalize, and every us-gaap tag each one can
// arrive under.
//
// This is the hard part of consuming SEC data. There is no single tag for
// "revenue" — filers choose from dozens depending on industry, era, and their
// accountant's preference, and they migrate between them over the years. A
// concept resolves by trying every tag listed here and stitching the resulting
// series together (see buildStatementSet in edgar.ts), so order within a list
// does not matter for correctness; coverage does.
//
// Kept dependency-free so scripts/tag-coverage.ts can import it directly to
// measure how much of a real filing this map actually captures.

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
  /**
   * Treat `tags` as a preference ranking rather than era-based synonyms.
   *
   * The default merge lets whichever tag has the most recent data win an
   * overlap, which is right when a filer migrates between equivalent tags. It
   * is wrong when the alternatives measure genuinely different things: Disney
   * reports NetIncomeLoss of 12.40B (attributable to Disney) and ProfitLoss of
   * 13.43B (consolidated, including minority interests), and recency handed us
   * the second — contradicting the EPS on the same statement.
   */
  preferOrder?: boolean;
  /**
   * The line is a cash outflow and must be shown negative.
   *
   * Filers disagree on the sign: GE tags PaymentsForRepurchaseOfCommonStock
   * negative in 18 of its 27 filed years while most filers tag it positive,
   * and NextEra and Duke do the same with dividends. The XBRL US Data Quality
   * Committee treats a negative value on a `Payments...` element as a filer
   * error (rule DQC_0015), so the magnitude is taken as the truth and the sign
   * is imposed. Blindly negating instead turned GE's buybacks into an inflow.
   */
  flipSign?: boolean;
  /**
   * The line is an expense or cost and must be shown positive.
   *
   * Same class of filer error in the other direction: Prologis tags
   * OperatingExpenses negative in 6 of 30 years, which would flow straight into
   * the operating-income derivation with the wrong sign.
   */
  expectPositive?: boolean;
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
      // Insurers: premiums are the dominant revenue line when a filer tags no
      // consolidated total. Investment income (InterestAndDividendIncomeOperating)
      // is deliberately absent — it is a component worth a few percent of an
      // insurer's revenue, and letting it stand in for the total understated
      // Progressive by 24x in years where the total was not tagged.
      "PremiumsEarnedNet",
      "SalesRevenueServicesNet",
      "TotalRevenuesAndOtherIncome",
      "HealthCareOrganizationRevenue",
      "ContractsRevenue",
      "RealEstateRevenueNet",
      "RevenueMineralSales",
    ],
  },
  {
    key: "cogs",
    label: "Cost of Revenue",
    kind: "flow",
    expectPositive: true,
    tags: [
      "CostOfGoodsAndServicesSold",
      "CostOfRevenue",
      "CostOfSales",
      "CostOfGoodsSold",
      "CostOfServices",
      "CostOfGoodsAndServicesSoldExcludingDepreciationDepletionAndAmortization",
      "CostOfGoodsSoldExcludingDepreciationDepletionAndAmortization",
      "DirectOperatingCosts",
      "PolicyholderBenefitsAndClaimsIncurredNet",
    ],
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
    expectPositive: true,
    indent: true,
    tags: [
      "ResearchAndDevelopmentExpense",
      "ResearchAndDevelopmentExpenseExcludingAcquiredInProcessCost",
      "ResearchAndDevelopmentExpenseSoftwareExcludingAcquiredInProcessCost",
    ],
  },
  {
    key: "sga",
    label: "Selling, General & Admin",
    kind: "flow",
    expectPositive: true,
    indent: true,
    tags: [
      "SellingGeneralAndAdministrativeExpense",
      "OtherSellingGeneralAndAdministrativeExpense",
    ],
  },
  {
    key: "salesMarketing",
    label: "Sales & Marketing",
    kind: "flow",
    expectPositive: true,
    indent: true,
    tags: [
      "SellingAndMarketingExpense",
      "MarketingAndAdvertisingExpense",
      "SellingExpense",
      "AdvertisingExpense",
    ],
  },
  {
    key: "ga",
    label: "General & Administrative",
    kind: "flow",
    expectPositive: true,
    indent: true,
    tags: [
      "GeneralAndAdministrativeExpense",
      "OtherGeneralAndAdministrativeExpense",
    ],
  },
  {
    key: "opex",
    label: "Total Operating Expenses",
    kind: "flow",
    expectPositive: true,
    // `CostsAndExpenses` is deliberately NOT listed. It is *total* costs
    // including cost of revenue, so presenting it as operating expenses
    // double-counts COGS — Alphabet tags it that way, which made its operating
    // expenses read as 68% of revenue instead of 27.6%. The derivation below
    // gives the correct figure for every filer that reports the two subtotals.
    tags: ["OperatingExpenses", "OperatingCostsAndExpenses", "NoninterestExpense"],
    derive: { plus: ["grossProfit"], minus: ["operatingIncome"] },
  },
  {
    key: "operatingIncome",
    label: "Operating Income",
    kind: "flow",
    style: "subtotal",
    tags: ["OperatingIncomeLoss"],
  },
  {
    key: "impairment",
    label: "Impairment Charges",
    kind: "flow",
    expectPositive: true,
    tags: [
      "GoodwillImpairmentLoss",
      "ImpairmentOfLongLivedAssetsHeldForUse",
      "ImpairmentOfIntangibleAssetsExcludingGoodwill",
      "AssetImpairmentCharges",
      "ImpairmentOfInvestments",
    ],
  },
  {
    key: "restructuring",
    label: "Restructuring Charges",
    kind: "flow",
    expectPositive: true,
    tags: [
      "RestructuringCharges",
      "RestructuringCostsAndAssetImpairmentCharges",
      "BusinessExitCosts",
      "SeveranceCosts",
    ],
  },
  {
    key: "gainOnSale",
    label: "Gain on Sale",
    kind: "flow",
    tags: [
      "GainLossOnSaleOfBusiness",
      "GainLossOnSaleOfPropertyPlantEquipment",
      "GainLossOnInvestments",
      "DisposalGroupNotDiscontinuedOperationGainLossOnDisposal",
    ],
  },
  {
    // EBIT + D&A. Companies don't tag EBITDA (it isn't a GAAP measure), so it
    // is always derived — and the D&A it adds back comes off the cash flow
    // statement, making this the first genuinely cross-statement line.
    key: "ebitda",
    label: "EBITDA",
    kind: "flow",
    style: "subtotal",
    tags: [],
    derive: { plus: ["operatingIncome", "da"], minus: [] },
  },
  {
    key: "interestExpense",
    label: "Interest Expense",
    kind: "flow",
    tags: [
      "InterestExpense",
      "InterestExpenseNonoperating",
      "InterestAndDebtExpense",
      "InterestExpenseDebt",
      "InterestExpenseBorrowings",
    ],
  },
  {
    key: "netInterestIncome",
    label: "Net Interest Income",
    kind: "flow",
    // RevenuesNetOfInterestExpense already feeds `revenue` for banks — do not
    // claim it here or both lines get the same number.
    tags: ["InterestIncomeExpenseNet"],
  },
  {
    key: "premiumsEarned",
    label: "Premiums Earned",
    kind: "flow",
    // PremiumsEarnedNet already feeds `revenue` for insurers.
    tags: ["PremiumsEarnedNetOfReinsurance"],
  },
  {
    key: "policyBenefits",
    label: "Policyholder Benefits",
    kind: "flow",
    expectPositive: true,
    // PolicyholderBenefitsAndClaimsIncurredNet already feeds `cogs`.
    tags: [
      "PolicyholderBenefitsAndClaimsIncurred",
      "BenefitsLossesAndExpenses",
    ],
  },
  {
    key: "pretaxIncome",
    label: "Pre-Tax Income",
    kind: "flow",
    // ...Domestic is deliberately absent. It is the domestic half of a
    // domestic/foreign split, not consolidated pre-tax income: NVIDIA's FY2019
    // consolidated pre-tax was 3,896 against 1,843 domestic, and in years where
    // only the domestic tag was present it stood in for the whole, understating
    // pre-tax and breaking the reconciliation to net income. Same reasoning as
    // the component debt and revenue tags removed earlier.
    tags: [
      "IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest",
      "IncomeLossFromContinuingOperationsBeforeIncomeTaxesMinorityInterestAndIncomeLossFromEquityMethodInvestments",
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
    // Ranked, not synonymous: NetIncomeLoss is attributable to the parent and
    // is what EPS is computed on. ProfitLoss includes minority interests and is
    // a fallback for filers that tag nothing else.
    preferOrder: true,
    tags: ["NetIncomeLoss", "NetIncomeLossAvailableToCommonStockholdersBasic", "ProfitLoss"],
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
    // Diluted only. Basic weighted-average shares were a fallback here, but
    // basic is a different concept, not an era-synonym — it is always fewer
    // shares — so the recency merge let it stand in for diluted and every
    // per-share figure came out slightly high. NVIDIA showed 24,359M basic
    // where diluted was 24,514M, an implied EPS ~0.6% above the reported
    // diluted figure. A filer that reports only basic now shows no diluted
    // line, which is more honest than mislabelling basic as diluted.
    tags: ["WeightedAverageNumberOfDilutedSharesOutstanding"],
  },
  {
    key: "sharesBasic",
    label: "Basic Shares Outstanding",
    kind: "flow",
    shares: true,
    // Weighted-average basic shares. Kept off the diluted line on purpose —
    // basic is a smaller count, not an era-synonym. A filer that only reports
    // basic now has a basic line instead of a mislabelled diluted one.
    tags: ["WeightedAverageNumberOfSharesOutstandingBasic"],
  },
];

const BALANCE: LineDef[] = [
  {
    key: "cash",
    label: "Cash & Equivalents",
    kind: "instant",
    tags: [
      "CashAndCashEquivalentsAtCarryingValue",
      "CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents",
      "CashAndDueFromBanks",
    ],
  },
  {
    key: "stInvestments",
    label: "Short-Term Investments",
    kind: "instant",
    tags: [
      "ShortTermInvestments",
      "MarketableSecuritiesCurrent",
      "AvailableForSaleSecuritiesDebtSecuritiesCurrent",
      "AvailableForSaleSecurities",
      "OtherShortTermInvestments",
      "DebtSecuritiesAvailableForSaleExcludingAccruedInterest",
    ],
  },
  {
    key: "receivables",
    label: "Accounts Receivable",
    kind: "instant",
    tags: [
      "AccountsReceivableNetCurrent",
      "ReceivablesNetCurrent",
      "AccountsReceivableNet",
      "AccountsAndNotesReceivableNet",
      "NotesAndLoansReceivableNetCurrent",
      "AccountsReceivableGrossCurrent",
      // Banks and insurers: the receivable is a loan book or premiums due.
      "LoansAndLeasesReceivableNetReportedAmount",
      "FinancingReceivableExcludingAccruedInterestAfterAllowanceForCreditLoss",
      "NotesReceivableNet",
      "PremiumsAndOtherReceivablesNet",
    ],
  },
  {
    key: "inventory",
    label: "Inventory",
    kind: "instant",
    tags: ["InventoryNet", "InventoryGross", "RetailRelatedInventory", "InventoryRealEstate"],
  },
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
    tags: [
      "PropertyPlantAndEquipmentNet",
      "PropertyPlantAndEquipmentAndFinanceLeaseRightOfUseAssetAfterAccumulatedDepreciationAndAmortization",
      // Sector-specific captions for the same economic asset.
      "RealEstateInvestmentPropertyNet",
      "PublicUtilitiesPropertyPlantAndEquipmentNet",
      "OilAndGasPropertySuccessfulEffortMethodNet",
      "OilAndGasPropertyFullCostMethodNet",
    ],
  },
  { key: "goodwill", label: "Goodwill", kind: "instant", tags: ["Goodwill"] },
  {
    key: "intangibles",
    label: "Intangible Assets",
    kind: "instant",
    tags: [
      "IntangibleAssetsNetExcludingGoodwill",
      "FiniteLivedIntangibleAssetsNet",
      "IndefiniteLivedIntangibleAssetsExcludingGoodwill",
    ],
  },
  {
    key: "ltInvestments",
    label: "Long-Term Investments",
    kind: "instant",
    // Noncurrent investment securities — the marketable holdings a company
    // parks beyond a year, which for cash-rich filers dwarf most other asset
    // lines (NVIDIA carries tens of billions here that no line surfaced before).
    // Ranked (preferOrder) so a reported total wins over its components: where a
    // filer tags both a LongTermInvestments total and a piece such as
    // EquitySecuritiesFVNINoncurrent, the total must stand, not the part. A
    // filer that only tags the pieces separately surfaces the largest clean
    // piece rather than a guessed sum — NVIDIA tags noncurrent equity securities
    // but folds the noncurrent debt piece into a combined current+noncurrent
    // total with no clean noncurrent tag, so that portion stays uncaptured
    // rather than double-counted. Purely a display line: Total Assets is the
    // reported `Assets` tag, so the balance identity is unaffected either way.
    preferOrder: true,
    tags: [
      "LongTermInvestments",
      "MarketableSecuritiesNoncurrent",
      "AvailableForSaleSecuritiesNoncurrent",
      "AvailableForSaleSecuritiesDebtSecuritiesNoncurrent",
      "EquitySecuritiesFVNINoncurrent",
      "OtherLongTermInvestments",
    ],
  },
  { key: "totalAssets", label: "Total Assets", kind: "instant", style: "total", tags: ["Assets"] },
  {
    key: "payables",
    label: "Accounts Payable",
    kind: "instant",
    tags: [
      "AccountsPayableCurrent",
      "AccountsPayableAndAccruedLiabilitiesCurrent",
      "AccountsPayableAndAccruedLiabilitiesCurrentAndNoncurrent",
      "AccountsPayableTradeCurrent",
      "AccountsPayableAndOtherAccruedLiabilities",
    ],
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
    tags: [
      "LongTermDebtCurrent",
      "DebtCurrent",
      "ShortTermBorrowings",
      "CommercialPaper",
    ],
  },
  {
    key: "ltDebt",
    label: "Long-Term Debt",
    kind: "instant",
    // Ranked, because LongTermDebt is the total including the current portion
    // while LongTermDebtNoncurrent excludes it. Short-term debt already counts
    // the current maturities, so letting the total win double-counts them:
    // NVIDIA's FY2026 showed 999 short-term plus 8,468 long-term when the
    // long-term figure was really 7,469 and the extra 999 was the current
    // portion counted twice. Preferring the noncurrent tag avoids the overlap;
    // the total is a fallback only for filers that don't split it out.
    preferOrder: true,
    tags: [
      "LongTermDebtNoncurrent",
      "LongTermDebtAndCapitalLeaseObligations",
      "LongTermDebt",
    ],
  },
  {
    key: "deposits",
    label: "Deposits",
    kind: "instant",
    tags: [
      "Deposits",
      "InterestBearingDeposits",
      "NoninterestBearingDeposits",
      "DepositsLiabilities",
    ],
  },
  {
    key: "totalLiabilities",
    label: "Total Liabilities",
    kind: "instant",
    style: "total",
    tags: ["Liabilities"],
    // A quarter of large filers never tag `Liabilities` on its own, because the
    // face of the balance sheet only shows total liabilities AND equity. The
    // identity closes the gap without inventing anything.
    derive: { plus: ["totalAssets"], minus: ["equity"] },
  },
  {
    // Needed for the retained-earnings roll-forward, which is the link that
    // ties net income and dividends back to the balance sheet.
    key: "retainedEarnings",
    label: "Retained Earnings",
    kind: "instant",
    tags: [
      "RetainedEarningsAccumulatedDeficit",
      "RetainedEarningsAccumulatedDeficitIncludingPortionAttributableToNoncontrollingInterest",
    ],
  },
  {
    key: "equity",
    label: "Shareholders' Equity",
    kind: "instant",
    style: "total",
    tags: [
      "StockholdersEquity",
      "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest",
      "MembersEquity",
      "PartnersCapital",
      "CommonStockholdersEquity",
    ],
  },
  {
    key: "leaseLiability",
    label: "Lease Liabilities",
    kind: "instant",
    // Operating + finance lease liabilities when tagged separately from
    // interest-bearing debt. Totals and noncurrent pieces are both listed
    // because filers pick one; they are not summed.
    tags: [
      "OperatingLeaseLiability",
      "OperatingLeaseLiabilityNoncurrent",
      "FinanceLeaseLiability",
      "OperatingLeaseAndFinanceLeaseLiability",
    ],
  },
  {
    key: "nci",
    label: "Noncontrolling Interest",
    kind: "instant",
    tags: ["MinorityInterest", "NoncontrollingInterest"],
  },
  {
    key: "preferredEquity",
    label: "Preferred Equity",
    kind: "instant",
    // Redeemable / mezzanine preferred is included — it is capital that sits
    // above common in an EV bridge, whether or not the filer parks it in
    // temporary equity.
    tags: [
      "PreferredStockValue",
      "PreferredStockIncludingAdditionalPaidInCapital",
      "TemporaryEquityCarryingAmountIncludingPortionAttributableToNoncontrollingInterests",
    ],
  },
  {
    key: "pensionLiab",
    label: "Pension Liabilities",
    kind: "instant",
    tags: [
      "PensionAndOtherPostretirementDefinedBenefitPlansLiabilitiesNoncurrent",
      "DefinedBenefitPlanLiabilitiesNoncurrent",
      "PensionAndOtherPostretirementDefinedBenefitPlansCurrentLiabilities",
    ],
  },
  {
    key: "pensionAssets",
    label: "Pension Plan Assets",
    kind: "instant",
    tags: [
      "DefinedBenefitPlanFairValueOfPlanAssets",
      "DefinedBenefitPlanAssetsForPlanBenefitsNoncurrent",
    ],
  },
  {
    key: "restrictedCash",
    label: "Restricted Cash",
    kind: "instant",
    // Additive to `cash`, which still includes the combined cash+restricted
    // tag for coverage. The EV bridge carves this out when both are finite.
    tags: [
      "RestrictedCashAndCashEquivalentsAtCarryingValue",
      "RestrictedCashAndCashEquivalents",
      "RestrictedCashAndCashEquivalentsNoncurrent",
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
      "DepreciationDepletionAndAmortizationPropertyPlantAndEquipment",
    ],
  },
  {
    key: "sbc",
    label: "Stock-Based Compensation",
    kind: "flow",
    indent: true,
    tags: [
      "ShareBasedCompensation",
      "AllocatedShareBasedCompensationExpense",
    ],
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
      "PaymentsToAcquireOtherPropertyPlantAndEquipment",
      // Sector-specific capex captions.
      "PaymentsToAcquireOilAndGasProperty",
      "PaymentsToExploreAndDevelopOilAndGasProperties",
      "PaymentsToAcquireRealEstate",
      "PaymentsToDevelopRealEstateAssets",
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
    tags: [
      "PaymentsForRepurchaseOfCommonStock",
      "PaymentsForRepurchaseOfEquity",
    ],
  },
  {
    key: "dividends",
    label: "Dividends Paid",
    kind: "flow",
    flipSign: true,
    indent: true,
    tags: [
      "PaymentsOfDividends",
      "PaymentsOfDividendsCommonStock",
      "PaymentsOfOrdinaryDividends",
      "PaymentsOfCapitalDistribution",
    ],
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
  {
    // CFO + CFI + CFF. Filers do tag this, but it is also derivable, so the
    // reported figure is preferred and the derivation fills the gaps. This is
    // the line that ties the cash flow statement to the balance sheet's cash.
    key: "netChangeInCash",
    label: "Net Change in Cash",
    kind: "flow",
    style: "total",
    tags: [
      "CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalentsPeriodIncreaseDecreaseIncludingExchangeRateEffect",
      "CashAndCashEquivalentsPeriodIncreaseDecrease",
      "CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalentsPeriodIncreaseDecreaseExcludingExchangeRateEffect",
    ],
    derive: { plus: ["ocf", "icf", "fincf"], minus: [] },
  },
];

const STATEMENT_DEFS: { title: string; lines: LineDef[] }[] = [
  { title: "Income Statement", lines: INCOME },
  { title: "Balance Sheet", lines: BALANCE },
  { title: "Cash Flow Statement", lines: CASHFLOW },
];

export type { LineDef };
export { INCOME, BALANCE, CASHFLOW, STATEMENT_DEFS };
export type { Kind };
