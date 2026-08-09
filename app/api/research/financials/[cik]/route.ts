import {
  canonicalTicker,
  getCompanyFinancials,
  getSecProfile,
  InvalidCikError,
  NoFactsError,
} from "@/lib/research/edgar";
import { buildInsights } from "@/lib/research/insights";
import { buildNarrative } from "@/lib/research/narrative";
import { getProfile } from "@/lib/research/yahoo";
import { getLatestQuote } from "@/lib/research/prices";
import { publicErrorMessage } from "@/lib/research/http";
import { isValidCik, isValidTicker } from "@/lib/research/validate";

export const maxDuration = 30;

export async function GET(
  req: Request,
  { params }: { params: { cik: string } }
) {
  const { cik } = params;
  const rawTicker = new URL(req.url).searchParams.get("ticker") ?? "";

  // The cik is interpolated into the SEC URL downstream; padStart only prepends
  // zeros, it strips nothing, so an unvalidated value could redirect the request
  // to a different data.sec.gov path.
  if (!isValidCik(cik)) {
    return Response.json({ error: "Invalid company id." }, { status: 400 });
  }
  if (rawTicker && !isValidTicker(rawTicker)) {
    return Response.json({ error: "Invalid ticker." }, { status: 400 });
  }

  // Resolved from SEC's directory rather than trusted from the query string, so
  // a varying ticker cannot force uncached upstream calls.
  const ticker = await canonicalTicker(cik, rawTicker);

  try {
    // The AI summary is deliberately NOT awaited here, it lives on
    // /api/summary/[cik] so a multi-second model call can't hold up the
    // statements, ratios, and charts.
    const [financials, yahooProfile, secProfile, quote] = await Promise.all([
      getCompanyFinancials(cik, ticker),
      getProfile(ticker), // unofficial; often blocked on datacenter IPs
      getSecProfile(cik), // official; reliable
      getLatestQuote(ticker),
    ]);

    const insights = buildInsights(financials);

    // Market cap: Yahoo's if available, else price x cover-page shares
    // outstanding. Only computed when the quote currency matches the filer's
    // reporting currency: multiplying a non-USD quote by USD share counts
    // produced a confidently wrong number labeled as USD.
    let marketCap = yahooProfile?.marketCap ?? null;
    let marketCapCurrency = yahooProfile?.currency ?? financials.currency;
    let marketCapIsDerived = false;

    if (marketCap == null && quote != null && (financials.sharesOutstanding ?? 0) > 0) {
      marketCap = quote.price * (financials.sharesOutstanding as number);
      marketCapCurrency = quote.currency;
      marketCapIsDerived = true;
    }

    // Deterministic narrative, computed from the same filings. Free and
    // synchronous, so it ships with the statements rather than on its own
    // request. The optional Claude summary supersedes it when a key is set.
    const narrative = buildNarrative(financials, insights, {
      marketCap,
      currency: marketCapCurrency,
    });

    if (marketCap != null && !(marketCap > 0)) marketCap = null;

    return Response.json({
      ...financials,
      insights,
      narrative,
      profile: {
        sector: yahooProfile?.sector ?? secProfile?.sicDescription ?? null,
        industry: yahooProfile?.industry ?? null,
        marketCap,
        marketCapCurrency,
        marketCapIsDerived,
        price: quote?.price ?? null,
        priceCurrency: quote?.currency ?? null,
      },
    });
  } catch (e) {
    if (e instanceof InvalidCikError) {
      return Response.json({ error: "Invalid company id." }, { status: 400 });
    }
    if (e instanceof NoFactsError) {
      return Response.json(
        { error: "This company doesn't file US-GAAP financial data with the SEC." },
        { status: 404 }
      );
    }
    // Log the real error; return only a message vetted as safe to expose.
    console.error(`[financials] failed for cik=${cik} ticker=${ticker}:`, e);
    return Response.json(
      { error: publicErrorMessage(e, "Failed to load financials.") },
      { status: 502 }
    );
  }
}
