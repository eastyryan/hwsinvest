// Server-only helpers for Finnhub. The API key is read from process.env and
// is NEVER sent to the browser. Only call these from server components or
// route handlers (files in /app/api).

export type Quote = {
  symbol: string;
  c: number; // current price
  d: number; // change
  dp: number; // percent change
  h: number; // high
  l: number; // low
  o: number; // open
  pc: number; // previous close
};

const BASE = "https://finnhub.io/api/v1";

function key() {
  const k = process.env.FINNHUB_API_KEY;
  if (!k) throw new Error("FINNHUB_API_KEY is not set");
  return k;
}

// Fetch a single quote. Cached for 30s to protect the free-tier rate limit.
export async function getQuote(symbol: string): Promise<Quote> {
  const res = await fetch(
    `${BASE}/quote?symbol=${encodeURIComponent(symbol)}&token=${key()}`,
    { next: { revalidate: 30 } }
  );
  if (!res.ok) throw new Error(`Finnhub quote failed for ${symbol}`);
  const data = await res.json();
  return { symbol, ...data } as Quote;
}

// Fetch several quotes. Runs them in parallel; each is individually cached.
export async function getQuotes(symbols: string[]): Promise<Quote[]> {
  const results = await Promise.allSettled(symbols.map((s) => getQuote(s)));
  return results
    .filter((r): r is PromiseFulfilledResult<Quote> => r.status === "fulfilled")
    .map((r) => r.value);
}

export type NewsItem = {
  id: number;
  headline: string;
  source: string;
  url: string;
  datetime: number;
  summary: string;
};

// Recent company news for a symbol (last ~7 days).
export async function getCompanyNews(symbol: string): Promise<NewsItem[]> {
  const to = new Date();
  const from = new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const res = await fetch(
    `${BASE}/company-news?symbol=${symbol}&from=${fmt(from)}&to=${fmt(
      to
    )}&token=${key()}`,
    { next: { revalidate: 900 } }
  );
  if (!res.ok) return [];
  const data = (await res.json()) as NewsItem[];
  return data.slice(0, 8);
}
