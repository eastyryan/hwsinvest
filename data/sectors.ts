// Sector definitions. Each maps to a SPDR sector ETF (works on Finnhub's
// free tier) plus a few representative names for the drill-down page.

export type Sector = {
  slug: string;
  name: string;
  etf: string;
  blurb: string;
  holdings: string[];
};

export const sectors: Sector[] = [
  {
    slug: "technology",
    name: "Technology",
    etf: "XLK",
    blurb:
      "Hardware, software, and semiconductors. The largest weight in the S&P 500 and a key driver of index returns.",
    holdings: ["AAPL", "MSFT", "NVDA", "AVGO"],
  },
  {
    slug: "financials",
    name: "Financials",
    etf: "XLF",
    blurb:
      "Banks, insurers, and capital markets firms. Sensitive to interest rates and the credit cycle.",
    holdings: ["JPM", "BAC", "WFC", "GS"],
  },
  {
    slug: "energy",
    name: "Energy",
    etf: "XLE",
    blurb:
      "Oil & gas producers, refiners, and equipment. Tracks commodity prices and global demand.",
    holdings: ["XOM", "CVX", "COP", "SLB"],
  },
  {
    slug: "healthcare",
    name: "Health Care",
    etf: "XLV",
    blurb:
      "Pharma, biotech, devices, and providers. Often defensive in slowdowns.",
    holdings: ["LLY", "UNH", "JNJ", "MRK"],
  },
  {
    slug: "consumer-discretionary",
    name: "Consumer Discretionary",
    etf: "XLY",
    blurb:
      "Retail, autos, travel, and leisure — spending consumers can postpone. Cyclical.",
    holdings: ["AMZN", "TSLA", "HD", "MCD"],
  },
  {
    slug: "industrials",
    name: "Industrials",
    etf: "XLI",
    blurb:
      "Aerospace, machinery, transports, and defense. A read on the real economy.",
    holdings: ["GE", "CAT", "UNP", "HON"],
  },
];

export const indices = [
  { symbol: "SPY", label: "S&P 500" },
  { symbol: "QQQ", label: "Nasdaq 100" },
  { symbol: "DIA", label: "Dow 30" },
  { symbol: "IWM", label: "Russell 2000" },
];
