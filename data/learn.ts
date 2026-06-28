// Learning content for the members "Academy" — original questions written to
// teach the same concepts covered in the club's resource PDFs (Investment
// Dictionary, Accounting & Financial Statement Analysis, Economic Data
// Releases, Excel guides, and the IB technical-interview canon).
//
// To add content: append a Lesson to a track's `lessons`, or a new Track to
// TRACKS. Keep ~4-6 questions per lesson. Every question needs an `explain`.

export type Question =
  | { type: "mc"; q: string; choices: string[]; answer: number; explain: string }
  | { type: "tf"; q: string; answer: boolean; explain: string };

export type Lesson = { id: string; title: string; questions: Question[] };

export type Track = {
  id: string;
  title: string;
  icon: string; // emoji
  accent: string; // hex used for the track's color accent
  blurb: string;
  source: string; // which club file(s) this is based on
  lessons: Lesson[];
};

export const TRACKS: Track[] = [
  // ─────────────────────────────────────────────────────────────────────
  {
    id: "dictionary",
    title: "Investment Dictionary",
    icon: "📖",
    accent: "#4b2e83",
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
              "Alpha is the return earned above the benchmark/expected return — a measure of value added. (A stock's sensitivity to the market is beta.)",
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
            explain:
              "Appreciation = a rise in an asset's value over time. The opposite is depreciation.",
          },
          {
            type: "mc",
            q: "The “annualized rate of return” is also known as the…",
            choices: [
              "Coupon rate",
              "Compound growth rate",
              "Dividend yield",
              "Expense ratio",
            ],
            answer: 1,
            explain:
              "Annualized return averages performance over multiple years while accounting for compounding — also called the compound growth rate.",
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
              "A bond is debt — the issuer borrows money and pays the holder interest (coupons), repaying principal at maturity.",
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
              "Liquid assets (like large-cap stocks or cash) can be bought/sold quickly at a fair price; illiquid ones can't.",
          },
          {
            type: "tf",
            q: "Diversification reduces risk by spreading money across many different investments.",
            answer: true,
            explain:
              "Diversification lowers exposure to any single investment's bad outcome — “don't put all your eggs in one basket.”",
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
            explain:
              "Dividends distribute a slice of company profits to equity holders, usually quarterly.",
          },
          {
            type: "mc",
            q: "A prolonged period of rising prices and optimism is called a…",
            choices: ["Bear market", "Bull market", "Correction", "Recession"],
            answer: 1,
            explain:
              "A bull market trends upward with optimism; a bear market is a sustained decline (often defined as −20% or more).",
          },
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────
  {
    id: "accounting",
    title: "Accounting & 3 Statements",
    icon: "📊",
    accent: "#1f7a4d",
    blurb: "The income statement, balance sheet, and cash flow — and how they link.",
    source: "General Knowledge · Accounting & Financial Statement Analysis",
    lessons: [
      {
        id: "three-statements",
        title: "The 3 Statements",
        questions: [
          {
            type: "mc",
            q: "Which statement reports a company's revenue and expenses over a period?",
            choices: [
              "Balance Sheet",
              "Income Statement",
              "Cash Flow Statement",
              "Statement of Shareholders' Equity",
            ],
            answer: 1,
            explain:
              "The income statement runs from revenue down through expenses to net income — the “bottom line.”",
          },
          {
            type: "mc",
            q: "The final line of the income statement is…",
            choices: ["Gross Profit", "Operating Income", "Net Income", "EBITDA"],
            answer: 2,
            explain:
              "Net income is the bottom line — what's left after all expenses, interest, and taxes.",
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
            explain:
              "Assets = Liabilities + Shareholders' Equity. It must always balance — that's why it's called a balance sheet.",
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
              "Depreciation reduces net income but no cash leaves the business, so it's added back when computing cash flow.",
          },
          {
            type: "mc",
            q: "Net income from the income statement flows into the balance sheet through…",
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
              "The CEO approves it",
            ],
            answer: 1,
            explain:
              "Accrual accounting records revenue/expenses when earned or incurred — not when cash moves (that's cash-basis).",
          },
          {
            type: "mc",
            q: "“Goodwill” on the balance sheet typically arises when…",
            choices: [
              "A company is very profitable",
              "A company pays more than the fair value of another company's net assets in an acquisition",
              "A company issues new stock",
              "Inventory is written down",
            ],
            answer: 1,
            explain:
              "Goodwill captures the premium paid above the acquired company's identifiable net asset value.",
          },
          {
            type: "tf",
            q: "Capitalizing a cost means spreading it over time as an asset, while expensing hits the income statement immediately.",
            answer: true,
            explain:
              "Big long-lived purchases (like equipment) are capitalized and depreciated; routine costs are expensed right away.",
          },
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────
  {
    id: "valuation",
    title: "Valuation & DCF",
    icon: "💵",
    accent: "#b1560f",
    blurb: "Enterprise vs. equity value, multiples, and discounted cash flow.",
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
              "EBITDA × number of shares",
            ],
            answer: 0,
            explain:
              "Equity value = share price × diluted shares — the market value of all equity.",
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
              "Accounting rules require it for taxes",
            ],
            answer: 1,
            explain:
              "EV reflects the cost to acquire the operating business; the target's cash offsets that cost, so it's netted out.",
          },
          {
            type: "tf",
            q: "EV/EBITDA pairs an enterprise-value metric with a pre-interest profit metric, which is why it's capital-structure neutral.",
            answer: true,
            explain:
              "EBITDA is before interest, so it belongs to all capital providers — matching enterprise value. P/E pairs equity value with net income.",
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
              "The price of comparable recent deals",
              "The present value of its expected future cash flows",
              "Its book value of equity",
              "Last year's stock price",
            ],
            answer: 1,
            explain:
              "A DCF projects future free cash flows and discounts them to today using a discount rate.",
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
            q: "All else equal, a higher discount rate produces a lower present value (and valuation).",
            answer: true,
            explain:
              "Discounting more heavily shrinks the value of future cash flows, lowering the DCF result.",
          },
          {
            type: "mc",
            q: "Two common ways to calculate Terminal Value in a DCF are…",
            choices: [
              "Book value and liquidation value",
              "Gordon Growth (perpetuity growth) and the Exit Multiple method",
              "P/E and P/B",
              "FIFO and LIFO",
            ],
            answer: 1,
            explain:
              "Terminal value is estimated via a perpetuity growth rate (Gordon Growth) or by applying an exit multiple to a final-year metric.",
          },
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────
  {
    id: "economy",
    title: "Markets & Economy",
    icon: "📈",
    accent: "#0e6b8c",
    blurb: "How economic data moves markets — soft vs. hard indicators.",
    source: "General Knowledge · Economic Data Releases",
    lessons: [
      {
        id: "soft-hard",
        title: "Soft vs. Hard Data",
        questions: [
          {
            type: "mc",
            q: "Which is an example of “soft” economic data?",
            choices: [
              "Gross Domestic Product (GDP)",
              "Nonfarm payrolls",
              "Consumer Confidence Index",
              "Consumer Price Index (CPI)",
            ],
            answer: 2,
            explain:
              "Soft data measures sentiment and expectations (surveys like Consumer Confidence and PMI). Hard data measures actual activity.",
          },
          {
            type: "tf",
            q: "Soft data (like surveys) tends to lead hard data as an early indicator.",
            answer: true,
            explain:
              "Sentiment shifts before the official statistics catch up, so soft data often moves markets first — but can give false signals.",
          },
          {
            type: "mc",
            q: "GDP, CPI, and payrolls are all examples of…",
            choices: [
              "Soft data",
              "Hard data",
              "Leading sentiment surveys",
              "Technical indicators",
            ],
            answer: 1,
            explain:
              "These are hard data — official statistics of real economic activity. They tend to drive larger, sustained market moves.",
          },
          {
            type: "mc",
            q: "The Consumer Price Index (CPI) primarily tracks…",
            choices: [
              "Employment levels",
              "Inflation / changes in consumer prices",
              "Stock market returns",
              "Manufacturing orders",
            ],
            answer: 1,
            explain:
              "CPI measures the change in prices of a basket of consumer goods — a key inflation gauge for the Fed.",
          },
          {
            type: "tf",
            q: "A surprisingly strong jobs report can push bond yields higher.",
            answer: true,
            explain:
              "Strong data can raise expectations of higher rates/inflation, pushing yields up and pressuring bond prices down.",
          },
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────
  {
    id: "excel",
    title: "Excel Skills",
    icon: "⌨️",
    accent: "#1d7a3f",
    blurb: "The keyboard shortcuts that make modeling fast.",
    source: "Excel · Basics & Shortcut List",
    lessons: [
      {
        id: "essential-shortcuts",
        title: "Essential Shortcuts",
        questions: [
          {
            type: "mc",
            q: "In Excel, what does pressing F4 do while editing a formula?",
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
            choices: [
              "Edits the cell's contents",
              "Anchors the reference",
              "Sums the column",
              "Spell-checks",
            ],
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
            explain:
              "CTRL + arrow jumps to the edge of the current data region. Add SHIFT to select along the way.",
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
            explain: "CTRL + 9 hides the selected row(s); CTRL + SHIFT + 9 unhides them.",
          },
          {
            type: "tf",
            q: "SHIFT + Spacebar selects the entire row, and CTRL + Spacebar selects the entire column.",
            answer: true,
            explain:
              "Handy pair: SHIFT+Space = whole row, CTRL+Space = whole column.",
          },
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────
  {
    id: "technicals",
    title: "Interview Technicals",
    icon: "🏦",
    accent: "#5a2d82",
    blurb: "Deal concepts that show up in IB and equity research interviews.",
    source: "Interview Prep · Investment Banking Technicals",
    lessons: [
      {
        id: "lbo-ma",
        title: "LBOs & M&A",
        questions: [
          {
            type: "tf",
            q: "A leveraged buyout (LBO) funds an acquisition primarily with debt.",
            answer: true,
            explain:
              "In an LBO a firm acquires a company using a large amount of borrowed money, using the target's cash flows to service the debt.",
          },
          {
            type: "mc",
            q: "Which is NOT a primary driver of returns in an LBO?",
            choices: [
              "Paying down debt over the hold period",
              "Growing EBITDA",
              "Issuing dividends to common shareholders each quarter",
              "Multiple expansion (selling at a higher multiple than purchase)",
            ],
            answer: 2,
            explain:
              "LBO returns come from debt paydown, EBITDA growth, and multiple expansion — not from quarterly common dividends.",
          },
          {
            type: "mc",
            q: "In a merger, a deal is “accretive” when…",
            choices: [
              "The acquirer's earnings per share (EPS) goes up after the deal",
              "The target's stock price falls",
              "The combined company has more employees",
              "Goodwill is written off",
            ],
            answer: 0,
            explain:
              "Accretive = the acquirer's EPS increases post-deal; dilutive means EPS decreases.",
          },
          {
            type: "mc",
            q: "“Synergies” in an M&A deal usually refer to…",
            choices: [
              "Cost savings or added revenue from combining two companies",
              "The legal fees of the transaction",
              "The number of shares issued",
              "The discount rate used in a DCF",
            ],
            answer: 0,
            explain:
              "Synergies are the extra value (cost cuts or revenue gains) the combined firm can achieve that the two couldn't alone.",
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
