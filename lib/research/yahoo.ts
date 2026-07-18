// Optional decoration from Yahoo Finance (the same unofficial endpoints the
// yfinance Python library wraps). Everything here degrades gracefully — the
// app must render fully without it.

export interface CompanyProfile {
  sector?: string;
  industry?: string;
  description?: string;
  website?: string;
  marketCap?: number;
  price?: number;
  currency?: string;
}

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

let crumbCache: { cookie: string; crumb: string; at: number } | null = null;

async function getCrumb(): Promise<{ cookie: string; crumb: string } | null> {
  if (crumbCache && Date.now() - crumbCache.at < 30 * 60 * 1000) return crumbCache;
  try {
    const r1 = await fetch("https://fc.yahoo.com", {
      headers: { "User-Agent": BROWSER_UA },
      redirect: "manual",
    });
    const cookie = r1.headers.get("set-cookie")?.split(";")[0] ?? "";
    if (!cookie) return null;
    const r2 = await fetch("https://query2.finance.yahoo.com/v1/test/getcrumb", {
      headers: { "User-Agent": BROWSER_UA, Cookie: cookie },
    });
    const crumb = (await r2.text()).trim();
    if (!crumb || crumb.includes("<")) return null;
    crumbCache = { cookie, crumb, at: Date.now() };
    return crumbCache;
  } catch {
    return null;
  }
}

export async function getProfile(ticker: string): Promise<CompanyProfile | null> {
  try {
    const auth = await getCrumb();
    let profile: CompanyProfile = {};

    if (auth) {
      const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(
        ticker
      )}?modules=assetProfile,price&crumb=${encodeURIComponent(auth.crumb)}`;
      const res = await fetch(url, {
        headers: { "User-Agent": BROWSER_UA, Cookie: auth.cookie },
        next: { revalidate: 3600 },
      });
      if (res.ok) {
        const data = await res.json();
        const result = data?.quoteSummary?.result?.[0];
        const ap = result?.assetProfile;
        const pr = result?.price;
        profile = {
          sector: ap?.sector,
          industry: ap?.industry,
          description: ap?.longBusinessSummary,
          website: ap?.website,
          marketCap: pr?.marketCap?.raw,
          price: pr?.regularMarketPrice?.raw,
          currency: pr?.currency,
        };
      }
    }

    // Fallback for price: the chart endpoint usually works without a crumb.
    if (profile.price == null) {
      const res = await fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=1d&interval=1d`,
        { headers: { "User-Agent": BROWSER_UA }, next: { revalidate: 900 } }
      );
      if (res.ok) {
        const data = await res.json();
        const meta = data?.chart?.result?.[0]?.meta;
        if (meta?.regularMarketPrice != null) {
          profile.price = meta.regularMarketPrice;
          profile.currency = profile.currency ?? meta.currency;
        }
      }
    }

    return Object.values(profile).some((v) => v != null) ? profile : null;
  } catch {
    return null;
  }
}
