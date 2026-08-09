// Optional decoration from Yahoo Finance (the same unofficial endpoints the
// yfinance Python library wraps). Everything here degrades gracefully, the
// app must render fully without it.

import { fetchJson, singleFlight } from "./http";
import { cached } from "./cache";
import { isValidTicker } from "./validate";

export interface CompanyProfile {
  sector?: string;
  industry?: string;
  description?: string;
  website?: string;
  marketCap?: number;
  currency?: string;
}

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

let crumbCache: { cookie: string; crumb: string; at: number } | null = null;

/** Timed fetch for the two non-JSON crumb calls, which fetchJson can't cover. */
async function fetchWithTimeout(url: string, init: RequestInit, ms: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
  } finally {
    clearTimeout(timer);
  }
}

async function getCrumb(): Promise<{ cookie: string; crumb: string } | null> {
  if (crumbCache && Date.now() - crumbCache.at < 30 * 60 * 1000) return crumbCache;
  try {
    // This call is uncached and runs whenever the crumb is cold. Without a
    // timeout a hung fc.yahoo.com pinned the function for the full maxDuration.
    const r1 = await fetchWithTimeout(
      "https://fc.yahoo.com",
      { headers: { "User-Agent": BROWSER_UA }, redirect: "manual" },
      5_000
    );
    const cookie = r1.headers.get("set-cookie")?.split(";")[0] ?? "";
    if (!cookie) return null;
    const r2 = await fetchWithTimeout(
      "https://query2.finance.yahoo.com/v1/test/getcrumb",
      { headers: { "User-Agent": BROWSER_UA, Cookie: cookie } },
      5_000
    );
    const crumb = (await r2.text()).trim();
    if (!crumb || crumb.includes("<")) return null;
    crumbCache = { cookie, crumb, at: Date.now() };
    return crumbCache;
  } catch {
    return null;
  }
}

/**
 * Sector/industry/market-cap decoration.
 *
 * Note this no longer fetches price: the chart endpoint it used duplicated the
 * one getLatestQuote already calls, and fetch memoization does not apply in
 * Route Handlers, so both requests actually went out on every page load.
 */
export async function getProfile(ticker: string): Promise<CompanyProfile | null> {
  if (!isValidTicker(ticker)) return null;
  const key = `yahooprofile:v2:${ticker.toUpperCase()}`;
  try {
    return await singleFlight(key, () =>
      cached(key, { ttl: 3_600, tags: ["profile"] }, async () => {
        const auth = await getCrumb();
        if (!auth) return null;

        const data = await fetchJson<{
          quoteSummary?: {
            result?: {
              assetProfile?: {
                sector?: string;
                industry?: string;
                longBusinessSummary?: string;
                website?: string;
              };
              price?: { marketCap?: { raw?: number }; currency?: string };
            }[];
          };
        }>(
          `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(
            ticker
          )}?modules=assetProfile,price&crumb=${encodeURIComponent(auth.crumb)}`,
          {
            source: "Yahoo Finance",
            headers: { "User-Agent": BROWSER_UA, Cookie: auth.cookie },
            timeoutMs: 8_000,
            retries: 1,
            nullOn: [401, 403, 404],
          }
        );

        const result = data?.quoteSummary?.result?.[0];
        if (!result) return null;
        const profile: CompanyProfile = {
          sector: result.assetProfile?.sector,
          industry: result.assetProfile?.industry,
          description: result.assetProfile?.longBusinessSummary,
          website: result.assetProfile?.website,
          marketCap: result.price?.marketCap?.raw,
          currency: result.price?.currency,
        };
        return Object.values(profile).some((v) => v != null) ? profile : null;
      })
    );
  } catch {
    return null;
  }
}
