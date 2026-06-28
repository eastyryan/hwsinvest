// Study content for the members "Academy" — original questions written to
// teach the same concepts covered in the club's resource PDFs (Investment
// Dictionary, Accounting & Financial Statement Analysis, Economic Data
// Releases, Excel guides, and the standard IB/equity-research technical canon).
//
// This is a study tool, not a game. Questions are grouped into tracks →
// lessons. To add content: append a Lesson to a track, or a Track to TRACKS.
// Every question needs an `explain` that teaches the "why".

export type Question =
  | { type: "mc"; q: string; choices: string[]; answer: number; explain: string }
  | { type: "tf"; q: string; answer: boolean; explain: string };

export type Lesson = { id: string; title: string; questions: Question[] };

export type Track = {
  id: string;
  title: string;
  blurb: string;
  source: string; // which club file(s) this is based on
  lessons: Lesson[];
};

export const TRACKS: Track[] = [
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: "dictionary",
    title: "Investment Dictionary",
    blurb: "The vocabulary every investor should know cold.",
    source: "General Knowledge · Investment Dictionary",
    lessons: [
      {
        id: "core-terms",
        title: "Core Terms",
        questions: [
          {
            type: "mc",
            q: "What does “alpha” measure?",
            choices: [
              "Return above what an investment was expected to deliver",
              "The total fees a fund charges per year",
              "How quickly an asset can be sold for cash",
              "A stock's sensitivity to the overall market",
            ],
            answer: 0,
            explain:
              "Alpha is return earned above the benchmark/expected return — value added by a strategy. A stock's sensitivity to the market is beta.",
          },
          {
            type: "mc",
            q: "“Asset allocation” refers to…",
            choices: [
              "Picking a single best-performing stock",
              "Dividing investments across cash, income, and growth to balance risk and reward",
              "Borrowing money to buy more securities",
              "Selling losers to offset taxes",
            ],
            answer: 1,
            explain:
              "Asset allocation spreads money across asset buckets to optimize the risk/reward balance for an investor's needs.",
          },
          {
            type: "mc",
            q: "Which of these is an example of an asset class?",
            choices: ["Apple", "The NYSE", "Bonds", "A 401(k)"],
            answer: 2,
            explain:
              "An asset class is a group of securities with similar features — the big three are stocks, bonds, and cash equivalents.",
          },
          {
            type: "tf",
            q: "“Appreciation” means a financial asset has increased in value.",
            answer: true,
            explain: "Appreciation = a rise in an asset's value. The opposite is depreciation.",
          },
          {
            type: "mc",
            q: "The “annualized rate of return” is also known as the…",
            choices: ["Coupon rate", "Compound growth rate", "Dividend yield", "Expense ratio"],
            answer: 1,
            explain:
              "Annualized return averages performance over multiple years while accounting for compounding — also called the compound growth rate.",
          },
          {
            type: "mc",
            q: "“Diversification” reduces risk by…",
            choices: [
              "Concentrating in your single best idea",
              "Spreading capital across many uncorrelated investments",
              "Using leverage to amplify returns",
              "Timing the market perfectly",
            ],
            answer: 1,
            explain:
              "Holding many investments whose returns don't move together lowers exposure to any single bad outcome.",
          },
        ],
      },
      {
        id: "markets-instruments",
        title: "Markets & Instruments",
        questions: [
          {
            type: "mc",
            q: "A “bond” is best described as…",
            choices: [
              "Ownership in a company",
              "A loan to a company or government that pays interest",
              "A pool of many investors' stocks",
              "A bet that a stock will fall",
            ],
            answer: 1,
            explain:
              "A bond is debt — the issuer borrows and pays the holder interest (coupons), repaying principal at maturity.",
          },
          {
            type: "mc",
            q: "“Liquidity” describes…",
            choices: [
              "How profitable a company is",
              "How easily an asset can be converted to cash without moving its price",
              "How much debt a company carries",
              "How volatile a stock is",
            ],
            answer: 1,
            explain:
              "Liquid assets (large-cap stocks, cash) trade quickly at a fair price; illiquid ones can't be sold without a discount.",
          },
          {
            type: "mc",
            q: "A “dividend” is…",
            choices: [
              "Interest paid on a bond",
              "A portion of profits paid out to shareholders",
              "The fee a broker charges",
              "A company's total revenue",
            ],
            answer: 1,
            explain: "Dividends distribute a slice of company profits to equity holders, usually quarterly.",
          },
          {
            type: "mc",
            q: "A prolonged period of rising prices and optimism is a…",
            choices: ["Bear market", "Bull market", "Correction", "Recession"],
            answer: 1,
            explain:
              "A bull market trends up with optimism; a bear market is a sustained decline (often −20% or more).",
          },
          {
            type: "mc",
            q: "The difference between a stock's highest bid and lowest ask price is the…",
            choices: ["Spread", "Margin", "Yield", "Premium"],
            answer: 0,
            explain:
              "The bid-ask spread is the gap between what buyers will pay and sellers will accept — tighter spreads mean more liquidity.",
          },
          {
            type: "tf",
            q: "An IPO (initial public offering) is the first time a private company sells shares to the public.",
            answer: true,
            explain:
              "An IPO takes a company public, letting it raise capital from public investors and listing its shares on an exchange.",
          },
        ],
      },
      {
        id: "risk-return",
        title: "Risk & Return",
        questions: [
          {
            type: "mc",
            q: "“Beta” measures a stock's…",
            choices: [
              "Total return last year",
              "Sensitivity/volatility relative to the overall market",
              "Dividend payout ratio",
              "Credit quality",
            ],
            answer: 1,
            explain:
              "Beta of 1 moves with the market; >1 is more volatile than the market, <1 is less. It captures systematic (market) risk.",
          },
          {
            type: "mc",
            q: "Which risk can be reduced through diversification?",
            choices: [
              "Systematic (market) risk",
              "Unsystematic (company-specific) risk",
              "Interest-rate risk for all assets",
              "Inflation risk",
            ],
            answer: 1,
            explain:
              "Company-specific (unsystematic) risk can be diversified away. Systematic/market risk affects everything and cannot.",
          },
          {
            type: "mc",
            q: "The Sharpe ratio measures…",
            choices: [
              "Return per unit of risk (volatility)",
              "A company's debt load",
              "Dividend growth",
              "Trading volume",
            ],
            answer: 0,
            explain:
              "Sharpe = (return − risk-free rate) / standard deviation. Higher means better risk-adjusted return.",
          },
          {
            type: "tf",
            q: "Generally, higher expected returns come with higher risk.",
            answer: true,
            explain:
              "The risk-return tradeoff: investors demand higher expected returns to bear more risk (the risk premium).",
          },
          {
            type: "mc",
            q: "Two assets with a correlation of −1 are…",
            choices: [
              "Perfectly positively related",
              "Perfectly inversely related (they move in opposite directions)",
              "Completely unrelated",
              "Identical",
            ],
            answer: 1,
            explain:
              "Correlation of −1 means they move exactly opposite; +1 means in lockstep; 0 means no linear relationship. Low correlation aids diversification.",
          },
          {
            type: "mc",
            q: "“Standard deviation” of returns is commonly used as a measure of…",
            choices: ["Liquidity", "Volatility / risk", "Profitability", "Valuation"],
            answer: 1,
            explain:
              "Standard deviation quantifies how much returns swing around their average — a standard proxy for volatility/risk.",
          },
        ],
      },
      {
        id: "fixed-income",
        title: "Fixed Income Terms",
        questions: [
          {
            type: "tf",
            q: "Bond prices and interest rates (yields) move in opposite directions.",
            answer: true,
            explain:
              "When rates rise, existing bonds paying lower coupons become less attractive, so their prices fall — and vice versa.",
          },
          {
            type: "mc",
            q: "A bond's “coupon” is…",
            choices: [
              "Its current market price",
              "The fixed interest payment it makes to holders",
              "The discount to face value",
              "The issuer's credit rating",
            ],
            answer: 1,
            explain:
              "The coupon is the periodic interest the bond pays, usually a fixed % of face (par) value.",
          },
          {
            type: "mc",
            q: "“Yield to maturity” (YTM) is…",
            choices: [
              "The coupon rate only",
              "The total annualized return if the bond is held to maturity",
              "The bond's face value",
              "The time until the bond matures",
            ],
            answer: 1,
            explain:
              "YTM is the internal rate of return on a bond held to maturity, accounting for coupons plus any gain/loss to par.",
          },
          {
            type: "mc",
            q: "“Duration” primarily measures a bond's…",
            choices: [
              "Years until maturity exactly",
              "Sensitivity of its price to interest-rate changes",
              "Credit risk",
              "Coupon size",
            ],
            answer: 1,
            explain:
              "Higher duration = the price moves more for a given change in rates. Longer-maturity, lower-coupon bonds have higher duration.",
          },
          {
            type: "mc",
            q: "A bond rated below investment grade (e.g., BB or lower) is often called a…",
            choices: ["Treasury", "Junk / high-yield bond", "Municipal bond", "Zero-coupon bond"],
            answer: 1,
            explain:
              "Below-investment-grade bonds carry higher default risk, so they pay higher yields — hence “high-yield” or “junk.”",
          },
          {
            type: "tf",
            q: "All else equal, a bond trading below its par value is said to trade “at a discount.”",
            answer: true,
            explain:
              "Below par = discount (often because its coupon is below current market yields); above par = premium.",
          },
        ],
      },
      {
        id: "funds-portfolio",
        title: "Funds & Portfolio",
        questions: [
          {
            type: "mc",
            q: "An ETF (exchange-traded fund) differs from a mutual fund mainly because it…",
            choices: [
              "Can only be bought once per day at NAV",
              "Trades on an exchange throughout the day like a stock",
              "Never holds more than one security",
              "Is always actively managed",
            ],
            answer: 1,
            explain:
              "ETFs trade intraday on exchanges; traditional mutual funds transact once daily at the closing NAV.",
          },
          {
            type: "mc",
            q: "A fund's “expense ratio” is…",
            choices: [
              "Its annual return",
              "The yearly cost to own it, as a % of assets",
              "The number of holdings",
              "The manager's salary",
            ],
            answer: 1,
            explain:
              "The expense ratio is the annual fee charged as a percentage of assets — lower is better, all else equal.",
          },
          {
            type: "mc",
            q: "“NAV” (net asset value) of a fund equals…",
            choices: [
              "Total assets ÷ shares outstanding",
              "Total revenue ÷ shares",
              "Assets minus liabilities of the company it invests in",
              "The fund's annual dividend",
            ],
            answer: 0,
            explain:
              "NAV per share = (fund assets − liabilities) ÷ shares outstanding — the per-share value of the fund's holdings.",
          },
          {
            type: "mc",
            q: "An “index fund” aims to…",
            choices: [
              "Beat the market through active stock picking",
              "Match the return of a market index like the S&P 500",
              "Invest only in bonds",
              "Use leverage to double returns",
            ],
            answer: 1,
            explain:
              "Index funds passively replicate an index, offering broad, low-cost exposure rather than trying to beat the market.",
          },
          {
            type: "mc",
            q: "“AUM” stands for…",
            choices: [
              "Annual Unit Margin",
              "Assets Under Management",
              "Average Utility Measure",
              "Adjusted Underwriting Multiple",
            ],
            answer: 1,
            explain:
              "AUM is the total market value of investments a firm or fund manages on behalf of clients.",
          },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  {
    id: "accounting",
    title: "Accounting & 3 Statements",
    blurb: "The income statement, balance sheet, and cash flow — and how they connect.",
    source: "General Knowledge · Accounting & Financial Statement Analysis",
    lessons: [
      {
        id: "three-statements",
        title: "The 3 Statements",
        questions: [
          {
            type: "mc",
            q: "Which statement reports revenue and expenses over a period?",
            choices: ["Balance Sheet", "Income Statement", "Cash Flow Statement", "Equity Statement"],
            answer: 1,
            explain:
              "The income statement runs from revenue down through expenses to net income — the “bottom line.”",
          },
          {
            type: "mc",
            q: "The final line of the income statement is…",
            choices: ["Gross Profit", "Operating Income", "Net Income", "EBITDA"],
            answer: 2,
            explain: "Net income is the bottom line — what remains after all expenses, interest, and taxes.",
          },
          {
            type: "mc",
            q: "The balance sheet must always satisfy which equation?",
            choices: [
              "Assets = Liabilities − Equity",
              "Assets = Liabilities + Shareholders' Equity",
              "Revenue = Expenses + Profit",
              "Cash = Assets − Liabilities",
            ],
            answer: 1,
            explain: "Assets = Liabilities + Shareholders' Equity — it must always balance.",
          },
          {
            type: "mc",
            q: "The Cash Flow Statement begins with which figure?",
            choices: ["Revenue", "Net Income", "Total Assets", "Operating Income"],
            answer: 1,
            explain:
              "It starts with net income, then adjusts for non-cash items and working capital, plus investing and financing flows.",
          },
          {
            type: "tf",
            q: "The balance sheet shows performance over a period of time, like a quarter.",
            answer: false,
            explain:
              "The balance sheet is a snapshot at a single point in time. The income and cash flow statements cover a period.",
          },
          {
            type: "mc",
            q: "The three sections of the Cash Flow Statement are operating, investing, and…",
            choices: ["Financing", "Forecasting", "Depreciation", "Equity"],
            answer: 0,
            explain:
              "Cash flow from Operations, Investing (capex, acquisitions), and Financing (debt, equity, dividends).",
          },
        ],
      },
      {
        id: "linking",
        title: "Linking the Statements",
        questions: [
          {
            type: "tf",
            q: "Depreciation is a non-cash expense, so it's added back on the cash flow statement.",
            answer: true,
            explain:
              "Depreciation reduces net income but no cash leaves, so it's added back when computing operating cash flow.",
          },
          {
            type: "mc",
            q: "Net income flows into the balance sheet through…",
            choices: [
              "Accounts Payable",
              "Retained Earnings (within Shareholders' Equity)",
              "Inventory",
              "Goodwill",
            ],
            answer: 1,
            explain:
              "Net income (less dividends) accumulates in retained earnings, linking the income statement to equity.",
          },
          {
            type: "mc",
            q: "Under accrual accounting, revenue is recognized when…",
            choices: [
              "Cash is received",
              "It is earned, regardless of when cash changes hands",
              "The fiscal year ends",
              "Management approves it",
            ],
            answer: 1,
            explain:
              "Accrual accounting records revenue/expenses when earned or incurred — not when cash moves (that's cash-basis).",
          },
          {
            type: "mc",
            q: "“Goodwill” typically arises when a company…",
            choices: [
              "Is very profitable",
              "Pays more than the fair value of another company's net assets in an acquisition",
              "Issues new stock",
              "Writes down inventory",
            ],
            answer: 1,
            explain: "Goodwill captures the premium paid above the acquired company's identifiable net asset value.",
          },
          {
            type: "tf",
            q: "Capitalizing a cost spreads it over time as an asset, while expensing hits the income statement immediately.",
            answer: true,
            explain:
              "Long-lived purchases (equipment) are capitalized and depreciated; routine costs are expensed right away.",
          },
          {
            type: "mc",
            q: "If the three statements are linked, which is the best single measure of how much cash a business actually generates?",
            choices: ["Revenue", "Net Income", "Free Cash Flow", "Gross Profit"],
            answer: 2,
            explain:
              "Free cash flow (operating cash flow minus capex) shows real cash generation — net income includes non-cash items.",
          },
        ],
      },
      {
        id: "depreciation-walk",
        title: "The Classic $10 Depreciation Walk-Through",
        questions: [
          {
            type: "mc",
            q: "Depreciation increases by $10 and the tax rate is 40%. What happens to NET INCOME?",
            choices: ["Falls by $10", "Falls by $6", "Falls by $4", "No change"],
            answer: 1,
            explain:
              "Pre-tax income falls $10; taxes fall $4 (40%), so net income falls $10 − $4 = $6.",
          },
          {
            type: "mc",
            q: "Continuing (Depreciation +$10, 40% tax): what is the effect on CASH at the bottom of the cash flow statement?",
            choices: ["Down $10", "Down $6", "Up $4", "No change"],
            answer: 2,
            explain:
              "Net income −$6, then add back $10 of non-cash depreciation → operating cash flow and cash rise by $4 (the tax savings).",
          },
          {
            type: "mc",
            q: "Continuing: on the balance sheet, what happens to net PP&E (property, plant & equipment)?",
            choices: ["Up $10", "Down $10", "Down $6", "No change"],
            answer: 1,
            explain: "Accumulated depreciation rises $10, so net PP&E falls by $10.",
          },
          {
            type: "tf",
            q: "After this change, the balance sheet still balances: Assets fall $6 (Cash +$4, PP&E −$10) and Equity falls $6 (retained earnings).",
            answer: true,
            explain:
              "Assets: +$4 cash − $10 PP&E = −$6. Equity: net income −$6 into retained earnings. Both sides fall $6 — it balances.",
          },
          {
            type: "mc",
            q: "The reason depreciation can INCREASE a company's cash position is…",
            choices: [
              "It generates revenue",
              "It is tax-deductible, lowering cash taxes paid",
              "It is a financing inflow",
              "It increases inventory",
            ],
            answer: 1,
            explain:
              "Depreciation is a non-cash expense that reduces taxable income — the “depreciation tax shield” saves cash on taxes.",
          },
        ],
      },
      {
        id: "working-capital",
        title: "Working Capital & Cash",
        questions: [
          {
            type: "mc",
            q: "Working capital is usually defined as…",
            choices: [
              "Total assets − total liabilities",
              "Current assets − current liabilities",
              "Cash + inventory",
              "Revenue − expenses",
            ],
            answer: 1,
            explain: "Working capital = current assets − current liabilities, a gauge of short-term operating liquidity.",
          },
          {
            type: "mc",
            q: "An INCREASE in accounts receivable is a ____ of cash.",
            choices: ["Source", "Use", "Neither", "Financing source"],
            answer: 1,
            explain:
              "Higher receivables mean you've booked revenue but not collected cash yet — a use of cash (it reduces operating cash flow).",
          },
          {
            type: "mc",
            q: "An INCREASE in accounts payable is a ____ of cash.",
            choices: ["Use", "Source", "Neither", "Investing use"],
            answer: 1,
            explain:
              "Delaying payment to suppliers conserves cash — rising payables is a source of cash.",
          },
          {
            type: "tf",
            q: "A company that collects from customers before paying suppliers can operate with negative working capital — which can be a good sign of efficiency.",
            answer: true,
            explain:
              "Subscription, retail, and some platform businesses get paid first, financing operations with suppliers' money.",
          },
          {
            type: "mc",
            q: "Buying a new factory for cash shows up in which cash-flow section?",
            choices: ["Operating", "Investing", "Financing", "It doesn't appear"],
            answer: 1,
            explain:
              "Capital expenditures (buying long-term assets) are investing-activity outflows.",
          },
        ],
      },
      {
        id: "margins",
        title: "Margins & Profitability",
        questions: [
          {
            type: "mc",
            q: "Gross profit equals…",
            choices: [
              "Revenue − COGS (cost of goods sold)",
              "Revenue − all expenses",
              "Net income + taxes",
              "Revenue − SG&A",
            ],
            answer: 0,
            explain: "Gross profit = revenue − COGS. Dividing by revenue gives gross margin.",
          },
          {
            type: "mc",
            q: "EBITDA stands for earnings before interest, taxes, depreciation and…",
            choices: ["Amortization", "Acquisitions", "Allocation", "Assets"],
            answer: 0,
            explain:
              "EBITDA adds back D&A to operating earnings — a rough proxy for operating cash flow that's capital-structure neutral.",
          },
          {
            type: "mc",
            q: "The main difference between EBIT and EBITDA is that EBITDA…",
            choices: [
              "Subtracts taxes",
              "Adds back depreciation and amortization",
              "Includes interest expense",
              "Is always smaller",
            ],
            answer: 1,
            explain: "EBIT = operating income; EBITDA = EBIT + D&A. EBITDA is therefore larger (D&A added back).",
          },
          {
            type: "tf",
            q: "Operating margin is operating income divided by revenue.",
            answer: true,
            explain:
              "Operating margin = operating income (EBIT) / revenue — profitability from core operations before interest and taxes.",
          },
          {
            type: "mc",
            q: "Which would generally have the HIGHEST gross margins?",
            choices: ["A grocery chain", "A software company", "An auto manufacturer", "An airline"],
            answer: 1,
            explain:
              "Software has very low cost of goods sold (copies are nearly free), so gross margins are typically very high.",
          },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  {
    id: "valuation",
    title: "Valuation & DCF",
    blurb: "Enterprise vs. equity value, multiples, comparables, and discounted cash flow.",
    source: "Interview Prep · Technicals; Fundamental Edge",
    lessons: [
      {
        id: "ev-equity",
        title: "Enterprise & Equity Value",
        questions: [
          {
            type: "mc",
            q: "Equity Value (market capitalization) equals…",
            choices: [
              "Share price × diluted shares outstanding",
              "Total assets minus total liabilities at book value",
              "Revenue × a growth multiple",
              "EBITDA × shares",
            ],
            answer: 0,
            explain: "Equity value = share price × diluted shares — the market value of all equity.",
          },
          {
            type: "mc",
            q: "A simplified formula for Enterprise Value is…",
            choices: [
              "Equity Value + Cash − Debt",
              "Equity Value + Debt − Cash",
              "Equity Value × (1 + growth)",
              "Net Income + Depreciation",
            ],
            answer: 1,
            explain:
              "EV = Equity Value + Net Debt (Debt − Cash), plus items like preferred stock and minority interest.",
          },
          {
            type: "mc",
            q: "Why is cash subtracted when calculating Enterprise Value?",
            choices: [
              "Cash earns no interest",
              "A buyer can use the target's cash to help fund the purchase, lowering the effective price",
              "Cash is a liability",
              "Tax rules require it",
            ],
            answer: 1,
            explain:
              "EV is the cost to acquire the operating business; the target's cash offsets that cost, so it's netted out.",
          },
          {
            type: "tf",
            q: "EV/EBITDA pairs an enterprise-value metric with a pre-interest profit metric, which is why it's capital-structure neutral.",
            answer: true,
            explain:
              "EBITDA is before interest, so it belongs to all capital providers — matching enterprise value. P/E pairs equity value with net income.",
          },
          {
            type: "mc",
            q: "If a company issues new debt and holds the cash, its Enterprise Value should be roughly…",
            choices: ["Higher", "Lower", "Unchanged", "Doubled"],
            answer: 2,
            explain:
              "Debt up and cash up by the same amount → net debt unchanged → EV unchanged. EV is independent of capital structure.",
          },
        ],
      },
      {
        id: "dcf",
        title: "DCF Basics",
        questions: [
          {
            type: "mc",
            q: "A Discounted Cash Flow (DCF) values a company based on…",
            choices: [
              "Comparable recent deals",
              "The present value of its expected future cash flows",
              "Its book value of equity",
              "Last year's stock price",
            ],
            answer: 1,
            explain: "A DCF projects future free cash flows and discounts them to today using a discount rate.",
          },
          {
            type: "mc",
            q: "Unlevered free cash flow should be discounted using…",
            choices: [
              "The cost of equity",
              "WACC (weighted average cost of capital)",
              "The risk-free rate only",
              "The dividend yield",
            ],
            answer: 1,
            explain:
              "Unlevered FCF is available to all investors, so it's discounted at WACC. Levered FCF uses cost of equity.",
          },
          {
            type: "tf",
            q: "All else equal, a higher discount rate produces a lower present value and valuation.",
            answer: true,
            explain: "Discounting more heavily shrinks the value of future cash flows, lowering the DCF result.",
          },
          {
            type: "mc",
            q: "Two common ways to calculate Terminal Value are…",
            choices: [
              "Book value and liquidation value",
              "Gordon Growth (perpetuity growth) and the Exit Multiple method",
              "P/E and P/B",
              "FIFO and LIFO",
            ],
            answer: 1,
            explain:
              "Terminal value uses a perpetuity growth rate (Gordon Growth) or applies an exit multiple to a final-year metric.",
          },
          {
            type: "mc",
            q: "In a typical DCF, the terminal value often represents…",
            choices: [
              "A tiny fraction of total value",
              "A large majority of the total present value",
              "Exactly half",
              "The discount rate",
            ],
            answer: 1,
            explain:
              "Because explicit forecasts are only ~5–10 years, terminal value commonly makes up 60–80%+ of the DCF — so its assumptions matter enormously.",
          },
        ],
      },
      {
        id: "multiples",
        title: "Valuation Multiples",
        questions: [
          {
            type: "mc",
            q: "The P/E ratio compares price to…",
            choices: ["Revenue", "Earnings per share", "Book value", "EBITDA"],
            answer: 1,
            explain: "P/E = price per share ÷ earnings per share (or equity value ÷ net income). An equity-value multiple.",
          },
          {
            type: "mc",
            q: "Which multiple is NOT distorted by differences in capital structure?",
            choices: ["P/E", "Price / Book", "EV / EBITDA", "Dividend yield"],
            answer: 2,
            explain:
              "EV/EBITDA uses enterprise value and pre-interest earnings, so leverage doesn't distort it. P/E and P/B are equity multiples affected by debt.",
          },
          {
            type: "mc",
            q: "EV/Revenue is most useful for valuing…",
            choices: [
              "Mature, highly profitable banks",
              "High-growth or unprofitable companies with little/no earnings",
              "Bond portfolios",
              "Real estate only",
            ],
            answer: 1,
            explain:
              "When a company has no meaningful earnings yet (early-stage/high-growth), revenue multiples are used since EBITDA or EPS may be negative.",
          },
          {
            type: "tf",
            q: "A lower P/E always means a stock is a better buy.",
            answer: false,
            explain:
              "Not necessarily — a low P/E can signal low growth or high risk (a “value trap”), while a high P/E may reflect strong growth prospects.",
          },
          {
            type: "mc",
            q: "EV/EBITDA should be paired with which numerator-denominator logic?",
            choices: [
              "Enterprise value over a metric available to ALL investors",
              "Equity value over a metric available only to shareholders",
              "Revenue over net income",
              "Price over dividends",
            ],
            answer: 0,
            explain:
              "Consistency rule: EV multiples use pre-interest metrics (EBITDA, EBIT, revenue); equity multiples (P/E) use post-interest metrics (net income, EPS).",
          },
        ],
      },
      {
        id: "comps-precedents",
        title: "Comparables & Precedents",
        questions: [
          {
            type: "mc",
            q: "“Comparable companies” analysis values a business by…",
            choices: [
              "Discounting its future cash flows",
              "Applying valuation multiples of similar public companies",
              "Liquidating its assets",
              "Looking only at its dividend",
            ],
            answer: 1,
            explain:
              "Public comps apply the trading multiples (e.g., EV/EBITDA) of similar listed peers to the target's metrics.",
          },
          {
            type: "mc",
            q: "“Precedent transactions” analysis is based on…",
            choices: [
              "Multiples paid in past M&A deals for similar companies",
              "The current stock price",
              "A DCF",
              "The company's IPO price",
            ],
            answer: 0,
            explain:
              "Precedent (or transaction) comps use the multiples actually paid to acquire comparable companies historically.",
          },
          {
            type: "tf",
            q: "Precedent transactions usually produce higher valuations than public comps because acquisitions include a control premium.",
            answer: true,
            explain:
              "Buyers pay a premium for control (and synergies), so deal multiples typically exceed where peers merely trade.",
          },
          {
            type: "mc",
            q: "A “control premium” is the extra amount paid to…",
            choices: [
              "Minority shareholders only",
              "Acquire a controlling stake and the ability to direct the company",
              "Bondholders",
              "Investment bankers",
            ],
            answer: 1,
            explain: "Acquirers pay above the trading price to gain control and capture synergies — the control premium.",
          },
          {
            type: "mc",
            q: "A drawback of precedent transactions is that…",
            choices: [
              "They are always too low",
              "Market conditions at the time of past deals may differ from today",
              "They ignore the target entirely",
              "They require no data",
            ],
            answer: 1,
            explain:
              "Deals happen in specific market environments; multiples from a hot M&A market may not apply today.",
          },
        ],
      },
      {
        id: "cost-of-capital",
        title: "Cost of Capital (WACC)",
        questions: [
          {
            type: "mc",
            q: "The CAPM formula for cost of equity is…",
            choices: [
              "Risk-free rate + beta × equity risk premium",
              "Dividend ÷ price",
              "Debt ÷ equity",
              "EBITDA × multiple",
            ],
            answer: 0,
            explain:
              "Cost of equity = Rf + β × (market return − Rf). Riskier stocks (higher beta) demand higher returns.",
          },
          {
            type: "tf",
            q: "The cost of debt used in WACC is reduced by the tax rate because interest is tax-deductible.",
            answer: true,
            explain:
              "After-tax cost of debt = rate × (1 − tax rate). The “interest tax shield” lowers the effective cost of debt.",
          },
          {
            type: "mc",
            q: "For most companies, cost of equity is ____ cost of debt.",
            choices: ["Lower than", "Equal to", "Higher than", "Unrelated to"],
            answer: 2,
            explain:
              "Equity is riskier than debt (shareholders are paid last and have no guaranteed return) and lacks a tax shield, so it costs more.",
          },
          {
            type: "mc",
            q: "WACC is a weighted average of the costs of…",
            choices: [
              "Equity and debt, weighted by their share of total capital",
              "Revenue and expenses",
              "Assets and liabilities",
              "Dividends and buybacks",
            ],
            answer: 0,
            explain:
              "WACC = (E/V)·Re + (D/V)·Rd·(1−tax), blending the required returns of each capital source by its weight.",
          },
          {
            type: "mc",
            q: "If a company takes on a lot of cheap debt, its WACC will often initially…",
            choices: [
              "Rise sharply",
              "Decrease (debt is cheaper than equity), up to a point",
              "Stay exactly the same",
              "Become negative",
            ],
            answer: 1,
            explain:
              "Adding cheaper, tax-advantaged debt can lower WACC — but only until rising leverage/risk pushes the cost of debt and equity up.",
          },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  {
    id: "economy",
    title: "Markets & Economy",
    blurb: "How economic data, the Fed, and rates move markets.",
    source: "General Knowledge · Economic Data Releases",
    lessons: [
      {
        id: "soft-hard",
        title: "Soft vs. Hard Data",
        questions: [
          {
            type: "mc",
            q: "Which is an example of “soft” economic data?",
            choices: ["GDP", "Nonfarm payrolls", "Consumer Confidence Index", "CPI"],
            answer: 2,
            explain:
              "Soft data measures sentiment/expectations (surveys like Consumer Confidence and PMI). Hard data measures actual activity.",
          },
          {
            type: "tf",
            q: "Soft data (like surveys) tends to lead hard data as an early indicator.",
            answer: true,
            explain:
              "Sentiment shifts before official statistics catch up, so soft data often moves markets first — but can give false signals.",
          },
          {
            type: "mc",
            q: "GDP, CPI, and payrolls are all examples of…",
            choices: ["Soft data", "Hard data", "Leading sentiment surveys", "Technical indicators"],
            answer: 1,
            explain:
              "These are hard data — official statistics of real economic activity that tend to drive larger, sustained moves.",
          },
          {
            type: "mc",
            q: "The Consumer Price Index (CPI) primarily tracks…",
            choices: ["Employment", "Inflation / consumer prices", "Stock returns", "Manufacturing orders"],
            answer: 1,
            explain: "CPI measures the change in prices of a basket of consumer goods — a key inflation gauge.",
          },
          {
            type: "tf",
            q: "A surprisingly strong jobs report can push bond yields higher.",
            answer: true,
            explain:
              "Strong data can raise expectations of higher rates/inflation, pushing yields up and bond prices down.",
          },
          {
            type: "mc",
            q: "A PMI (Purchasing Managers' Index) reading above 50 generally signals…",
            choices: [
              "Economic contraction",
              "Economic expansion in that sector",
              "Falling prices",
              "A recession",
            ],
            answer: 1,
            explain: "PMI above 50 indicates expansion; below 50 indicates contraction. It's a closely watched soft indicator.",
          },
        ],
      },
      {
        id: "fed-policy",
        title: "The Fed & Monetary Policy",
        questions: [
          {
            type: "mc",
            q: "The Federal Reserve's “dual mandate” is…",
            choices: [
              "Maximum employment and stable prices",
              "Low taxes and high GDP",
              "Strong dollar and trade surplus",
              "Full budget and low deficit",
            ],
            answer: 0,
            explain: "Congress charged the Fed with pursuing maximum employment and price stability (low, stable inflation).",
          },
          {
            type: "mc",
            q: "When the Fed RAISES the federal funds rate, it is generally trying to…",
            choices: [
              "Stimulate growth",
              "Cool the economy and fight inflation",
              "Weaken the dollar",
              "Lower unemployment quickly",
            ],
            answer: 1,
            explain:
              "Higher rates make borrowing costlier, slowing demand and inflation. Cutting rates does the opposite — it stimulates.",
          },
          {
            type: "tf",
            q: "All else equal, higher interest rates tend to pressure stock valuations lower.",
            answer: true,
            explain:
              "Higher rates raise discount rates (lowering the present value of future earnings) and make bonds more competitive with stocks.",
          },
          {
            type: "mc",
            q: "“Quantitative easing” (QE) refers to the Fed…",
            choices: [
              "Selling bonds to drain liquidity",
              "Buying bonds to inject liquidity and lower long-term rates",
              "Raising the funds rate",
              "Printing physical cash for banks",
            ],
            answer: 1,
            explain:
              "QE = large-scale asset purchases that add liquidity and push down longer-term yields. QT (tightening) reverses it.",
          },
          {
            type: "mc",
            q: "The inflation gauge the Fed officially prefers to target is…",
            choices: ["CPI", "PPI", "Core PCE", "The GDP deflator only"],
            answer: 2,
            explain:
              "The Fed targets ~2% on the PCE price index (core PCE excludes food and energy), which it considers broader than CPI.",
          },
        ],
      },
      {
        id: "rates-curve",
        title: "Rates & the Yield Curve",
        questions: [
          {
            type: "tf",
            q: "An “inverted” yield curve, where short-term yields exceed long-term yields, has historically been a recession warning.",
            answer: true,
            explain:
              "Inversion suggests markets expect future rate cuts/slowing growth; it has preceded most modern U.S. recessions.",
          },
          {
            type: "mc",
            q: "A “normal” yield curve slopes…",
            choices: [
              "Downward (long rates below short rates)",
              "Upward (long rates above short rates)",
              "Perfectly flat",
              "Vertically",
            ],
            answer: 1,
            explain:
              "Normally investors demand more yield to lend for longer, so longer maturities yield more — an upward slope.",
          },
          {
            type: "mc",
            q: "The “real” interest rate is approximately the nominal rate minus…",
            choices: ["Taxes", "Inflation", "The risk-free rate", "Beta"],
            answer: 1,
            explain: "Real rate ≈ nominal rate − inflation. It reflects purchasing-power return after inflation.",
          },
          {
            type: "mc",
            q: "Why are long-duration bonds riskier when rates rise?",
            choices: [
              "They pay no coupon",
              "Their prices fall more for a given rise in yields",
              "They mature sooner",
              "They have higher credit risk",
            ],
            answer: 1,
            explain: "Longer duration = greater price sensitivity to rate changes, so they drop more when rates rise.",
          },
          {
            type: "tf",
            q: "U.S. Treasuries are generally considered a “risk-free” benchmark and a safe-haven asset.",
            answer: true,
            explain:
              "Backed by the U.S. government, Treasuries are treated as the risk-free rate proxy and tend to rally in risk-off periods.",
          },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  {
    id: "excel",
    title: "Excel Skills",
    blurb: "The shortcuts and functions that make financial modeling fast.",
    source: "Excel · Basics & Shortcut List",
    lessons: [
      {
        id: "essential-shortcuts",
        title: "Essential Shortcuts",
        questions: [
          {
            type: "mc",
            q: "What does pressing F4 do while editing a formula?",
            choices: [
              "Saves the workbook",
              "Anchors a cell reference (toggles $ absolute/relative)",
              "Deletes the cell",
              "Inserts a comment",
            ],
            answer: 1,
            explain:
              "F4 cycles a reference between relative and absolute ($A$1, A$1, $A1, A1) — essential for dragging formulas.",
          },
          {
            type: "mc",
            q: "Which shortcut opens the Format Cells dialog?",
            choices: ["CTRL + 1", "CTRL + F", "ALT + =", "F2"],
            answer: 0,
            explain: "CTRL + 1 opens Format Cells — number formats, borders, fonts, and more.",
          },
          {
            type: "mc",
            q: "What does F2 do on a selected cell?",
            choices: ["Edits the cell's contents", "Anchors the reference", "Sums the column", "Spell-checks"],
            answer: 0,
            explain: "F2 enters edit mode for the active cell so you can change its formula or text.",
          },
          {
            type: "mc",
            q: "ALT + = (equals) inserts which function?",
            choices: ["AVERAGE", "COUNT", "SUM", "IF"],
            answer: 2,
            explain: "ALT + = drops in the SUM function for the adjacent range — a huge time-saver.",
          },
          {
            type: "mc",
            q: "Holding CTRL while pressing an arrow key will…",
            choices: [
              "Select the whole sheet",
              "Jump to the end of a continuous range of filled cells",
              "Delete a row",
              "Open a new tab",
            ],
            answer: 1,
            explain: "CTRL + arrow jumps to the edge of the current data region. Add SHIFT to select along the way.",
          },
        ],
      },
      {
        id: "formatting-nav",
        title: "Formatting & Navigation",
        questions: [
          {
            type: "mc",
            q: "Which shortcut jumps directly to cell A1?",
            choices: ["CTRL + Home", "CTRL + End", "CTRL + A", "ALT + A1"],
            answer: 0,
            explain: "CTRL + Home returns to A1; CTRL + End jumps to the last used cell.",
          },
          {
            type: "mc",
            q: "CTRL + SHIFT + % applies which number format?",
            choices: ["Currency", "Date", "Percentage", "Scientific"],
            answer: 2,
            explain: "CTRL + SHIFT + % formats the selection as a percentage.",
          },
          {
            type: "mc",
            q: "Flash Fill, which auto-completes a pattern down a column, is triggered by…",
            choices: ["CTRL + E", "CTRL + F", "CTRL + L", "CTRL + P"],
            answer: 0,
            explain: "CTRL + E runs Flash Fill, detecting and extending the pattern you've started.",
          },
          {
            type: "mc",
            q: "CTRL + 9 will…",
            choices: ["Hide the selected row", "Save as", "Insert a row", "Bold the text"],
            answer: 0,
            explain: "CTRL + 9 hides selected row(s); CTRL + SHIFT + 9 unhides them.",
          },
          {
            type: "tf",
            q: "SHIFT + Spacebar selects the entire row, and CTRL + Spacebar selects the entire column.",
            answer: true,
            explain: "Handy pair: SHIFT+Space = whole row, CTRL+Space = whole column.",
          },
        ],
      },
      {
        id: "core-functions",
        title: "Core Functions",
        questions: [
          {
            type: "mc",
            q: "Which function looks up a value in a table by matching the leftmost column?",
            choices: ["SUMIF", "VLOOKUP", "CONCAT", "TODAY"],
            answer: 1,
            explain:
              "VLOOKUP searches the first column of a range and returns a value from another column in the same row. XLOOKUP is the modern, more flexible successor.",
          },
          {
            type: "mc",
            q: "Why do many modelers prefer INDEX/MATCH (or XLOOKUP) over VLOOKUP?",
            choices: [
              "It's the only way to add numbers",
              "It can look left as well as right and doesn't break when columns are inserted",
              "It automatically formats cells",
              "It's required for charts",
            ],
            answer: 1,
            explain:
              "VLOOKUP only looks rightward and references a fixed column number that breaks if columns shift. INDEX/MATCH and XLOOKUP are more robust.",
          },
          {
            type: "mc",
            q: "IFERROR is most useful for…",
            choices: [
              "Speeding up calculations",
              "Replacing error values (like #DIV/0!) with a cleaner output",
              "Sorting data",
              "Locking cells",
            ],
            answer: 1,
            explain:
              "IFERROR(value, alternative) returns your fallback when a formula would otherwise show an error — keeps models clean.",
          },
          {
            type: "tf",
            q: "In a formula like =A1*$B$1, the $B$1 stays fixed when you copy the formula down or across.",
            answer: true,
            explain:
              "Dollar signs lock the reference (absolute). A1 (relative) shifts as you copy; $B$1 (absolute) does not.",
          },
          {
            type: "mc",
            q: "SUMIF is used to…",
            choices: [
              "Sum only the cells that meet a given condition",
              "Count blank cells",
              "Find the maximum",
              "Round numbers",
            ],
            answer: 0,
            explain: "SUMIF(range, criteria, [sum_range]) adds up only the values that satisfy your criteria.",
          },
        ],
      },
      {
        id: "modeling-practices",
        title: "Modeling Best Practices",
        questions: [
          {
            type: "mc",
            q: "By widely-used convention, hardcoded INPUTS in a model are colored…",
            choices: ["Black", "Blue", "Red", "Green"],
            answer: 1,
            explain:
              "Blue = inputs/hardcodes you can change; black = formulas/calculations; green often = links to other sheets. It keeps models auditable.",
          },
          {
            type: "tf",
            q: "It's good practice to avoid typing raw numbers directly inside formulas, using labeled input cells instead.",
            answer: true,
            explain:
              "Hardcoding numbers inside formulas hides assumptions and makes models error-prone. Reference labeled input cells instead.",
          },
          {
            type: "mc",
            q: "A circular reference in a 3-statement model (e.g., interest depends on debt, which depends on cash, which depends on interest) is typically handled by…",
            choices: [
              "Deleting the income statement",
              "Enabling iterative calculation",
              "Converting everything to text",
              "Using more colors",
            ],
            answer: 1,
            explain:
              "Excel's iterative calculation setting lets the model resolve the loop. A “circularity switch” is often added to break it when debugging.",
          },
          {
            type: "mc",
            q: "Pressing F9 on a highlighted part of a formula will…",
            choices: [
              "Delete it",
              "Evaluate just that portion to show its value",
              "Save the file",
              "Insert a chart",
            ],
            answer: 1,
            explain:
              "Selecting part of a formula and pressing F9 evaluates that fragment in place — great for debugging complex formulas.",
          },
          {
            type: "tf",
            q: "Consistent, clearly-labeled assumptions make a model easier for others to audit and trust.",
            answer: true,
            explain:
              "Transparent structure and assumptions are core to good modeling — reviewers must be able to follow your logic quickly.",
          },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  {
    id: "technicals",
    title: "Interview Technicals",
    blurb: "Deal concepts that show up in IB and equity research interviews.",
    source: "Interview Prep · Investment Banking Technicals",
    lessons: [
      {
        id: "accounting-interview",
        title: "Accounting Questions",
        questions: [
          {
            type: "mc",
            q: "Asked to “walk through the 3 statements,” the cleanest one-line summary of the income statement is…",
            choices: [
              "It lists assets, liabilities, and equity",
              "It shows revenue and expenses, ending in net income",
              "It tracks cash in and out",
              "It records only financing activities",
            ],
            answer: 1,
            explain:
              "Income statement = revenue minus expenses → net income. Balance sheet = a snapshot of A=L+E. Cash flow = how net income turns into cash.",
          },
          {
            type: "mc",
            q: "Which statement would you look at FIRST to judge whether a company can survive a cash crunch?",
            choices: ["Income Statement", "Cash Flow Statement", "Equity Statement", "None of these"],
            answer: 1,
            explain:
              "A company can be profitable on the income statement yet run out of cash — the cash flow statement reveals real liquidity.",
          },
          {
            type: "tf",
            q: "It is possible for a company to be profitable (positive net income) yet have negative cash flow.",
            answer: true,
            explain:
              "Booking revenue on credit, heavy capex, or building inventory can consume cash even while the income statement shows profit.",
          },
          {
            type: "mc",
            q: "If inventory is written down by $10 (40% tax), the first-order effect on net income is…",
            choices: ["−$10", "−$6", "+$4", "No change"],
            answer: 1,
            explain:
              "The write-down is a $10 pre-tax expense; with a 40% tax shield, net income falls $6 — same mechanics as the depreciation walk-through.",
          },
          {
            type: "mc",
            q: "“Deferred revenue” is recorded as a ____ on the balance sheet.",
            choices: ["Asset", "Liability", "Equity", "Expense"],
            answer: 1,
            explain:
              "Cash collected before delivering the product/service is an obligation (a liability) until the revenue is earned.",
          },
        ],
      },
      {
        id: "dcf-interview",
        title: "DCF Questions",
        questions: [
          {
            type: "mc",
            q: "What is the correct high-level order of steps in a DCF?",
            choices: [
              "Project FCF → discount at WACC → add terminal value → get enterprise value",
              "Pick a multiple → multiply by EBITDA",
              "Average the last 5 stock prices",
              "Subtract liabilities from assets",
            ],
            answer: 0,
            explain:
              "Forecast unlevered free cash flows, discount them (and the terminal value) at WACC to today, sum to get enterprise value, then bridge to equity value.",
          },
          {
            type: "mc",
            q: "To get from enterprise value to EQUITY value at the end of a DCF, you…",
            choices: [
              "Add net debt",
              "Subtract net debt (subtract debt, add cash)",
              "Multiply by the tax rate",
              "Do nothing",
            ],
            answer: 1,
            explain: "Equity value = enterprise value − debt + cash (i.e., minus net debt) — the reverse of the EV bridge.",
          },
          {
            type: "tf",
            q: "Two of the biggest swing factors in a DCF's output are the discount rate (WACC) and the terminal growth/exit multiple assumptions.",
            answer: true,
            explain:
              "Because terminal value dominates and is highly sensitive to WACC and the growth/exit assumption, small changes move the answer a lot.",
          },
          {
            type: "mc",
            q: "A common CRITIQUE of the DCF is that it…",
            choices: [
              "Ignores cash flows",
              "Is highly sensitive to assumptions far in the future",
              "Never uses a discount rate",
              "Can only value banks",
            ],
            answer: 1,
            explain:
              "Small tweaks to long-dated growth, margins, or WACC dramatically change the result — “garbage in, garbage out.” That's why it's triangulated with comps.",
          },
          {
            type: "mc",
            q: "You'd generally AVOID relying on a DCF for…",
            choices: [
              "A stable, mature consumer-goods company",
              "An early-stage company with deeply uncertain, far-off cash flows",
              "A utility",
              "A company with predictable margins",
            ],
            answer: 1,
            explain:
              "When near-term cash flows are tiny and the value sits almost entirely in a speculative terminal value, a DCF becomes unreliable.",
          },
        ],
      },
      {
        id: "valuation-interview",
        title: "Valuation Questions",
        questions: [
          {
            type: "mc",
            q: "The three core valuation methodologies are comparable companies, precedent transactions, and…",
            choices: ["The DCF", "The P/E ratio", "The balance sheet", "Technical analysis"],
            answer: 0,
            explain:
              "Comps, precedent transactions, and the DCF are the standard trio (an LBO analysis is sometimes added as a “floor” valuation).",
          },
          {
            type: "tf",
            q: "Precedent transactions tend to give higher valuations than public comps because of the control premium.",
            answer: true,
            explain:
              "Acquirers pay a premium for control and synergies, so transaction multiples generally exceed where public peers trade.",
          },
          {
            type: "mc",
            q: "Two companies in the same industry can trade at very different P/E ratios mainly because of differences in…",
            choices: [
              "Their ticker symbols",
              "Expected growth and risk",
              "Their headquarters city",
              "The number of employees",
            ],
            answer: 1,
            explain:
              "Higher expected growth and lower risk justify a higher multiple; the market prices future prospects, not just current earnings.",
          },
          {
            type: "mc",
            q: "Which approach is an INTRINSIC valuation (based on the company's own fundamentals) rather than a relative one?",
            choices: ["Comparable companies", "Precedent transactions", "Discounted cash flow", "52-week high"],
            answer: 2,
            explain:
              "A DCF values a company on its own projected cash flows (intrinsic). Comps and precedents are relative — they price off other companies/deals.",
          },
          {
            type: "mc",
            q: "If you could use only ONE metric to compare leverage-different companies' operating value, a good choice is…",
            choices: ["P/E", "EV/EBITDA", "Dividend yield", "Price/Sales of equity"],
            answer: 1,
            explain:
              "EV/EBITDA strips out capital-structure and D&A differences, making operating comparisons across companies cleaner.",
          },
        ],
      },
      {
        id: "ma-merger",
        title: "M&A & Merger Models",
        questions: [
          {
            type: "mc",
            q: "A deal is “accretive” when…",
            choices: [
              "The acquirer's earnings per share (EPS) rises after the deal",
              "The target's stock falls",
              "The combined company has more employees",
              "Goodwill is written off",
            ],
            answer: 0,
            explain: "Accretive = acquirer's EPS increases post-deal; dilutive = EPS decreases.",
          },
          {
            type: "mc",
            q: "In an ALL-STOCK deal, the transaction is generally accretive when the acquirer's P/E is…",
            choices: [
              "Lower than the target's P/E",
              "Higher than the target's P/E",
              "Exactly equal to the target's",
              "Irrelevant",
            ],
            answer: 1,
            explain:
              "Using higher-P/E (more “expensive”) stock to buy a lower-P/E target adds EPS — accretive. The reverse is dilutive.",
          },
          {
            type: "mc",
            q: "“Synergies” in a merger usually refer to…",
            choices: [
              "Cost savings or added revenue from combining the two companies",
              "Legal fees",
              "The number of shares issued",
              "The discount rate",
            ],
            answer: 0,
            explain: "Synergies are the extra value (cost cuts or revenue gains) the combined firm achieves that the two couldn't alone.",
          },
          {
            type: "tf",
            q: "Financing an acquisition with cash or low-rate debt is often more accretive than using stock, when interest rates are low.",
            answer: true,
            explain:
              "Cheap cash/debt has a low “cost” to EPS; issuing new shares dilutes ownership. So cash/debt deals are frequently more accretive.",
          },
          {
            type: "mc",
            q: "“Goodwill” created in an acquisition equals roughly…",
            choices: [
              "Purchase price − fair value of the target's net identifiable assets",
              "The target's revenue",
              "The acquirer's cash",
              "The synergies",
            ],
            answer: 0,
            explain:
              "Goodwill is the premium over the fair value of identifiable net assets — it plugs the balance sheet in purchase accounting.",
          },
        ],
      },
      {
        id: "lbo-deep",
        title: "LBOs in Depth",
        questions: [
          {
            type: "tf",
            q: "A leveraged buyout (LBO) funds an acquisition primarily with debt, using the target's cash flows to pay it down.",
            answer: true,
            explain:
              "A PE firm buys a company with a large amount of borrowed money, then uses operating cash flow to service and repay the debt.",
          },
          {
            type: "mc",
            q: "Which is NOT a primary driver of LBO returns?",
            choices: [
              "Paying down debt over the hold",
              "Growing EBITDA",
              "Paying large common dividends every quarter",
              "Multiple expansion (exit at a higher multiple than entry)",
            ],
            answer: 2,
            explain:
              "LBO returns come from debt paydown, EBITDA growth, and multiple expansion — not from quarterly common dividends.",
          },
          {
            type: "mc",
            q: "An IDEAL LBO candidate typically has…",
            choices: [
              "Volatile, unpredictable cash flows",
              "Stable, predictable cash flows and low existing debt",
              "No assets and no customers",
              "A falling market and high capex needs",
            ],
            answer: 1,
            explain:
              "Steady cash flows service debt reliably; low existing leverage and strong assets (for collateral) plus cost-cut potential make a good target.",
          },
          {
            type: "mc",
            q: "Private equity firms most often measure an investment's return using…",
            choices: ["P/E ratio", "IRR and MOIC", "Dividend yield", "Beta"],
            answer: 1,
            explain:
              "IRR (internal rate of return, time-weighted) and MOIC (multiple of invested capital) are the standard LBO return metrics.",
          },
          {
            type: "mc",
            q: "Why does using MORE leverage tend to boost equity returns in an LBO (when things go well)?",
            choices: [
              "Less debt means more taxes",
              "A smaller equity check controls the same asset, so gains are spread over less equity",
              "Debt is free",
              "It increases revenue directly",
            ],
            answer: 1,
            explain:
              "Leverage magnifies returns on the smaller equity investment — though it also magnifies losses and risk if cash flows disappoint.",
          },
        ],
      },
    ],
  },
];

export function getTrack(id: string): Track | undefined {
  return TRACKS.find((t) => t.id === id);
}

export function getLesson(trackId: string, lessonId: string): Lesson | undefined {
  return getTrack(trackId)?.lessons.find((l) => l.id === lessonId);
}

export function totalLessonCount(): number {
  return TRACKS.reduce((n, t) => n + t.lessons.length, 0);
}

export function totalQuestionCount(): number {
  return TRACKS.reduce((n, t) => n + t.lessons.reduce((m, l) => m + l.questions.length, 0), 0);
}
