import { getCompanyFinancials, searchTickers } from "@/lib/research/edgar";
import { getPeersForCompany } from "@/lib/research/peers";
import { publicErrorMessage } from "@/lib/research/http";
import { isValidCik, isValidTicker } from "@/lib/research/validate";

export const maxDuration = 60;

/**
 * On-demand peer scorecards. Not prefetched — Overview only hits this when the
 * user expands the peer strip button.
 */
export async function GET(
  req: Request,
  { params }: { params: {  ticker: string  } }
) {
  const { ticker: rawTicker  } = params;
  const ticker = rawTicker.toUpperCase();
  if (!isValidTicker(ticker)) {
    return Response.json({ error: "Invalid ticker." }, { status: 400 });
  }

  const url = new URL(req.url);
  const sector = url.searchParams.get("sector");
  const industry = url.searchParams.get("industry");
  let cik = url.searchParams.get("cik") ?? "";
  let name = url.searchParams.get("name") ?? ticker;
  const marketCapRaw = url.searchParams.get("marketCap");
  const marketCap =
    marketCapRaw != null && marketCapRaw !== ""
      ? Number(marketCapRaw)
      : null;

  try {
    if (!cik || !isValidCik(cik)) {
      const hits = await searchTickers(ticker, 4);
      const hit = hits.find((h) => h.ticker.toUpperCase() === ticker) ?? hits[0];
      if (!hit) {
        return Response.json({ error: "Company not found." }, { status: 404 });
      }
      cik = hit.cik;
      name = hit.name;
    }

    // Prefetch subject so we can attach isSubject with full metrics once.
    const subjectFin = await getCompanyFinancials(cik, ticker);
    const payload = await getPeersForCompany({
      ticker,
      cik,
      name: subjectFin.name || name,
      sector: sector?.trim() || null,
      industry: industry?.trim() || null,
      subjectFin,
      peerLimit: 5,
      marketCap:
        marketCap != null && Number.isFinite(marketCap) && marketCap > 0
          ? marketCap
          : null,
    });

    return Response.json(payload);
  } catch (e) {
    console.error(`[peers] failed for ${ticker}:`, e);
    return Response.json(
      { error: publicErrorMessage(e, "Peer comparison is unavailable right now.") },
      { status: 502 }
    );
  }
}
