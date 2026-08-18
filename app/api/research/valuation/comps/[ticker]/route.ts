import { getCompanyFinancials, searchTickers } from "@/lib/research/edgar";
import { getPeersForCompany } from "@/lib/research/peers";
import { getLatestQuote } from "@/lib/research/prices";
import { publicErrorMessage } from "@/lib/research/http";
import { isValidCik, isValidTicker } from "@/lib/research/validate";
import { runComps, type CompPeerInput } from "@/lib/research/valuation/comps";
import { compOperatingFromFinancials } from "@/lib/research/valuation/comps-periods";
import { createGate } from "@/lib/research/concurrency";

export const maxDuration = 60;

/** Cap concurrent quote/financials fan-out on this route. */
const gate = createGate(4);

function toCompInput(
  fin: Awaited<ReturnType<typeof getCompanyFinancials>>,
  price: number | null
): CompPeerInput {
  const m = compOperatingFromFinancials(fin);
  return {
    ticker: fin.ticker.toUpperCase(),
    name: fin.name,
    revenue: m.revenue,
    ebitda: m.ebitda,
    ebit: m.ebit,
    netIncome: m.netIncome,
    shares: m.shares,
    netDebt: m.netDebt,
    price,
    periodEnd: m.periodEnd ?? undefined,
    basis: m.basis,
  };
}

/**
 * Trading comps payload: subject + sector peers with prices and filings metrics.
 * Used by the Valuation tab Comparable Company Analysis panel.
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
  const marketCapRaw = url.searchParams.get("marketCap");
  const marketCap =
    marketCapRaw != null && marketCapRaw !== "" ? Number(marketCapRaw) : null;

  try {
    if (!cik || !isValidCik(cik)) {
      const hits = await searchTickers(ticker, 4);
      const hit = hits.find((h) => h.ticker.toUpperCase() === ticker) ?? hits[0];
      if (!hit) {
        return Response.json({ error: "Company not found." }, { status: 404 });
      }
      cik = hit.cik;
    }

    const subjectFin = await getCompanyFinancials(cik, ticker);
    const peersPayload = await getPeersForCompany({
      ticker,
      cik,
      name: subjectFin.name,
      sector: sector?.trim() || null,
      industry: industry?.trim() || null,
      marketCap: Number.isFinite(marketCap) ? marketCap : null,
    });

    const peerCards = peersPayload.cards.filter((c) => !c.isSubject).slice(0, 8);

    async function loadPeer(card: (typeof peerCards)[number]): Promise<CompPeerInput | null> {
      const release = await gate.acquire(12_000);
      if (!release) return null;
      try {
        if (!card.cik || !isValidCik(card.cik)) return null;
        const [fin, quote] = await Promise.all([
          getCompanyFinancials(card.cik, card.ticker),
          getLatestQuote(card.ticker),
        ]);
        return toCompInput(fin, quote?.price ?? null);
      } catch {
        return null;
      } finally {
        release();
      }
    }

    const [subjectQuote, peerInputs] = await Promise.all([
      getLatestQuote(ticker),
      Promise.all(peerCards.map(loadPeer)),
    ]);

    const subject = toCompInput(subjectFin, subjectQuote?.price ?? null);
    const peers = peerInputs.filter((p): p is CompPeerInput => p != null);
    const result = runComps(subject, peers);

    return Response.json({
      subject: result.subject,
      peers: result.peers,
      peerMultiples: result.peerMultiples,
      implied: result.implied,
      range: result.range,
      notes: [...result.notes, ...peersPayload.notes],
    });
  } catch (e) {
    console.error(`[valuation/comps] ${ticker}:`, e);
    return Response.json(
      { error: publicErrorMessage(e, "Comps data unavailable.") },
      { status: 502 }
    );
  }
}
