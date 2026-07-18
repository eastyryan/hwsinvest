// Shared price data helpers: Yahoo first (keyless, blocks datacenter IPs),
// Twelve Data fallback (TWELVEDATA_API_KEY, free tier 800 credits/day).

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

export interface PriceSeries {
  points: { t: number; c: number }[];
  price: number | null;
  currency: string;
  source: "yahoo" | "twelvedata";
}

const YAHOO_RANGES: Record<string, string> = {
  "1y": "1y|1d",
  "5y": "5y|1wk",
  max: "max|1mo",
};

async function fromYahoo(ticker: string, rangeKey: string): Promise<PriceSeries> {
  const [range, interval] = (YAHOO_RANGES[rangeKey] ?? YAHOO_RANGES["5y"]).split("|");
  const res = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      ticker
    )}?range=${range}&interval=${interval}`,
    { headers: { "User-Agent": BROWSER_UA }, next: { revalidate: 900 } }
  );
  if (!res.ok) throw new Error(`Yahoo responded ${res.status}`);
  const data = await res.json();
  const result = data?.chart?.result?.[0];
  const ts: number[] = result?.timestamp ?? [];
  const close: (number | null)[] = result?.indicators?.quote?.[0]?.close ?? [];
  const points = ts
    .map((t, i) => ({ t: t * 1000, c: close[i] }))
    .filter((p): p is { t: number; c: number } => p.c != null);
  if (points.length === 0) throw new Error("Yahoo returned no points");
  return {
    points,
    price: result?.meta?.regularMarketPrice ?? points[points.length - 1].c,
    currency: result?.meta?.currency ?? "USD",
    source: "yahoo",
  };
}

const TWELVE_RANGES: Record<string, { interval: string; outputsize: number }> = {
  "1y": { interval: "1day", outputsize: 260 },
  "5y": { interval: "1week", outputsize: 265 },
  max: { interval: "1month", outputsize: 5000 },
};

async function fromTwelveData(ticker: string, rangeKey: string): Promise<PriceSeries> {
  const key = process.env.TWELVEDATA_API_KEY;
  if (!key) throw new Error("No TWELVEDATA_API_KEY configured");
  const { interval, outputsize } = TWELVE_RANGES[rangeKey] ?? TWELVE_RANGES["5y"];
  const res = await fetch(
    `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(
      ticker
    )}&interval=${interval}&outputsize=${outputsize}&apikey=${key}`,
    { next: { revalidate: 900 } }
  );
  const data = await res.json();
  if (data.status === "error" || !Array.isArray(data.values)) {
    throw new Error(data.message ?? "Twelve Data returned no data");
  }
  const points = (data.values as { datetime: string; close: string }[])
    .map((v) => ({ t: new Date(v.datetime).getTime(), c: parseFloat(v.close) }))
    .filter((p) => Number.isFinite(p.c))
    .sort((a, b) => a.t - b.t);
  if (points.length === 0) throw new Error("Twelve Data returned no points");
  return {
    points,
    price: points[points.length - 1].c,
    currency: data.meta?.currency ?? "USD",
    source: "twelvedata",
  };
}

export async function getPriceSeries(
  ticker: string,
  rangeKey: string
): Promise<PriceSeries> {
  const errors: string[] = [];
  for (const provider of [fromYahoo, fromTwelveData]) {
    try {
      return await provider(ticker, rangeKey);
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }
  throw new Error(errors.join("; "));
}

/** Latest price only. Cheap: one cached call, 1y daily via whichever provider answers. */
export async function getLatestPrice(ticker: string): Promise<number | null> {
  try {
    const s = await getPriceSeries(ticker, "1y");
    return s.price;
  } catch {
    return null;
  }
}
