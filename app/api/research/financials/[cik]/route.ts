import {
  canonicalTicker,
  getCompanyFinancialsWithMeta,
  getSecProfile,
  InvalidCikError,
  NoFactsError,
  secSubmissionsUrl,
} from "@/lib/research/edgar";
import { buildInsights } from "@/lib/research/insights";
import { buildNarrative } from "@/lib/research/narrative";
import { getProfile } from "@/lib/research/yahoo";
import { getLatestQuote } from "@/lib/research/prices";
import { getRestatements } from "@/lib/research/restatements";
import { buildConfidence } from "@/lib/research/confidence";
import { publicErrorMessage } from "@/lib/research/http";
import { isValidCik, isValidTicker } from "@/lib/research/validate";
import { detectSectorMode } from "@/lib/research/sector-mode";

export const maxDuration = 30;

export async function GET(
  req: Request,
  { params }: { params: {  cik: string  } }
) {
  const { cik  } = params;
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
    // The AI summary is deliberately NOT awaited here — it lives on
    // /api/summary/[cik] so a multi-second model call can't hold up the
    // statements, ratios, and charts.
    const [finResult, yahooProfile, secProfile, quote, restatements] =
      await Promise.all([
        getCompanyFinancialsWithMeta(cik, ticker),
        getProfile(ticker), // unofficial; often blocked on datacenter IPs
        getSecProfile(cik), // official; reliable
        getLatestQuote(ticker),
        getRestatements(cik).catch(() => []),
      ]);
    const { financials, cache: financialsCache } = finResult;

    const profileForMode = {
      sector: yahooProfile?.sector ?? secProfile?.sicDescription ?? null,
      industry: yahooProfile?.industry ?? null,
      sic: secProfile?.sic ?? null,
      sicDescription: secProfile?.sicDescription ?? null,
    };
    const sectorMode = detectSectorMode(profileForMode);

    const insights = buildInsights(financials, sectorMode);
    const confidence = buildConfidence(financials, restatements);

    // Market cap: Yahoo's if available, else price x cover-page shares
    // outstanding. Only computed when the quote currency matches the filer's
    // reporting currency — multiplying a non-USD quote by USD share counts
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
      sectorMode,
    });

    if (marketCap != null && !(marketCap > 0)) marketCap = null;

    return Response.json(
      {
        ...financials,
        insights,
        narrative,
        confidence,
        restatements: restatements.slice(0, 8),
        profile: {
          sector: profileForMode.sector,
          industry: profileForMode.industry,
          sic: profileForMode.sic,
          marketCap,
          marketCapCurrency,
          marketCapIsDerived,
          price: quote?.price ?? null,
          priceCurrency: quote?.currency ?? null,
        },
      },
      {
        headers: {
          // Honest server cache status for the statements payload only.
          "X-Cache": financialsCache,
        },
      }
    );
  } catch (e) {
    if (e instanceof InvalidCikError) {
      return Response.json({ error: "Invalid company id." }, { status: 400 });
    }
    if (e instanceof NoFactsError) {
      return Response.json(
        {
          error:
            "No structured XBRL financials (US-GAAP or IFRS companyfacts) for this company.",
          code: "NO_FACTS",
          cik,
          // Foreign private issuers often file 20-F/40-F as PDF-only without
          // machine-readable companyfacts. Point readers at the SEC filings list.
          hint:
            "Foreign private issuers may file 20-F or 40-F annual reports as PDFs without US-GAAP or IFRS companyfacts tags. Open the SEC submissions page to read the filings directly.",
          secSubmissionsUrl: secSubmissionsUrl(cik),
        },
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
