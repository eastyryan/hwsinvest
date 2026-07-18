import { getCompanyFinancials, getSecProfile } from "@/lib/research/edgar";
import { buildInsights } from "@/lib/research/insights";
import { buildAiSummary } from "@/lib/research/ai-summary";
import { getProfile } from "@/lib/research/yahoo";
import { getLatestPrice } from "@/lib/research/prices";

export const maxDuration = 60;

export async function GET(
  req: Request,
  { params }: { params: { cik: string } }
) {
  const { cik } = params;
  const ticker = new URL(req.url).searchParams.get("ticker") ?? "";
  try {
    const [financials, yahooProfile, secProfile, price] = await Promise.all([
      getCompanyFinancials(cik, ticker),
      getProfile(ticker), // unofficial; often blocked on datacenter IPs
      getSecProfile(cik), // official; reliable
      getLatestPrice(ticker),
    ]);
    const insights = buildInsights(financials);
    const aiSummary = await buildAiSummary(financials, insights);

    // Market cap: Yahoo's if available, else price × latest diluted shares.
    let marketCap = yahooProfile?.marketCap ?? null;
    if (marketCap == null && price != null) {
      const income = financials.quarterly.statements[0];
      const shares = income?.lines.find((l) => l.key === "sharesDiluted");
      const latestKey = financials.quarterly.periods.find(
        (p) => shares?.values[p.key] != null
      )?.key;
      const shareCount = latestKey ? shares?.values[latestKey] : null;
      if (shareCount) marketCap = price * shareCount;
    }

    return Response.json({
      ...financials,
      insights,
      aiSummary,
      profile: {
        sector: yahooProfile?.sector ?? secProfile?.sicDescription ?? null,
        industry: yahooProfile?.industry ?? null,
        marketCap,
        price,
      },
    });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Failed to load financials" },
      { status: 502 }
    );
  }
}
