// Shared price data helpers: Yahoo first (keyless, blocks datacenter IPs),
// Twelve Data fallback (TWELVEDATA_API_KEY, free tier 800 credits/day).

import { fetchJson, singleFlight } from "./http";
import { cached } from "./cache";
import { isValidTicker } from "./validate";

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

export interface PriceSeries {
  points: { t: number; c: number }[];
  price: number | null;
  currency: string;
  source: "yahoo" | "twelvedata";
}

export interface Quote {
  price: number;
  currency: string;
}

const YAHOO_RANGES: Record<string, string> = {
  "1y": "1y|1d",
  "5y": "5y|1wk",
  max: "max|1mo",
};

const TWELVE_RANGES: Record<string, { interval: string; outputsize: number }> = {
  "1y": { interval: "1day", outputsize: 260 },
  "5y": { interval: "1week", outputsize: 265 },
  max: { interval: "1month", outputsize: 5000 },
};

/**
 * Look up a range spec by key.
 *
 * `RANGES[key] ?? RANGES["5y"]` was unsafe: `??` doesn't guard inherited
 * properties, so `?range=toString` returned Object.prototype.toString and the
 * subsequent `.split` threw. Both providers failed identically and the request
 * 502'd instead of falling back to the default range.
 */
function lookupRange<T>(table: Record<string, T>, key: string, fallback: string): T {
  return Object.hasOwn(table, key) ? table[key] : table[fallback];
}

export function isValidRange(key: string): boolean {
  return Object.hasOwn(YAHOO_RANGES, key);
}

async function fromYahoo(ticker: string, rangeKey: string): Promise<PriceSeries> {
  const [range, interval] = lookupRange(YAHOO_RANGES, rangeKey, "5y").split("|");
  const data = await fetchJson<{
    chart?: {
      result?: {
        timestamp?: number[];
        indicators?: { quote?: { close?: (number | null)[] }[] };
        meta?: { regularMarketPrice?: number; currency?: string };
      }[];
    };
  }>(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      ticker
    )}?range=${range}&interval=${interval}`,
    { source: "Yahoo Finance", headers: { "User-Agent": BROWSER_UA }, timeoutMs: 8_000 }
  );
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

async function fromTwelveData(ticker: string, rangeKey: string): Promise<PriceSeries> {
  const key = process.env.TWELVEDATA_API_KEY;
  if (!key) throw new Error("No TWELVEDATA_API_KEY configured");
  const { interval, outputsize } = lookupRange(TWELVE_RANGES, rangeKey, "5y");
  const data = await fetchJson<{
    status?: string;
    message?: string;
    values?: { datetime: string; close: string }[];
    meta?: { currency?: string };
  }>(
    // The key travels in a header, not the query string. Next patches global
    // fetch and opens an OpenTelemetry span whose name and `http.url` attribute
    // are the full URL, so a query-string key is handed to any APM the moment
    // one is enabled — and it sits in the provider's access logs regardless.
    `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(
      ticker
    )}&interval=${interval}&outputsize=${outputsize}`,
    {
      source: "Twelve Data",
      headers: { Authorization: `apikey ${key}` },
      timeoutMs: 8_000,
    }
  );
  if (!data || data.status === "error" || !Array.isArray(data.values)) {
    // Deliberately does NOT surface data.message: the API key travels as a query
    // parameter and upstream error payloads can echo request context.
    throw new Error("Twelve Data returned no data");
  }
  const points = data.values
    .map((v) => ({ t: new Date(v.datetime).getTime(), c: parseFloat(v.close) }))
    .filter((p) => Number.isFinite(p.c) && Number.isFinite(p.t))
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
  if (!isValidTicker(ticker)) throw new Error("Invalid ticker");
  const key = `prices:v2:${ticker.toUpperCase()}:${rangeKey}`;
  return singleFlight(key, () =>
    cached(key, { ttl: 900, tags: ["prices"] }, async () => {
      let lastError: unknown = new Error("No price provider available");
      for (const provider of [fromYahoo, fromTwelveData]) {
        try {
          return await provider(ticker, rangeKey);
        } catch (e) {
          // Log the real reason server-side; callers get a generic message.
          console.warn(`[prices] ${provider.name} failed for ${ticker}:`, e);
          lastError = e;
        }
      }
      throw lastError;
    })
  );
}

/**
 * Latest quote, with the currency it is denominated in.
 *
 * Returning a bare number let a non-USD quote be multiplied by USD share counts
 * and presented as a USD market cap. Callers must now reconcile the currency.
 */
export async function getLatestQuote(ticker: string): Promise<Quote | null> {
  try {
    const s = await getPriceSeries(ticker, "1y");
    return s.price == null ? null : { price: s.price, currency: s.currency };
  } catch {
    return null;
  }
}
