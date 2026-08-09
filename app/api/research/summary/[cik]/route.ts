// AI narrative summary, on its own endpoint.
//
// Split out of /api/financials so the model call, seconds of latency, and the
// one operation here that costs money per request, can't block the statements
// from rendering.

import {
  canonicalTicker,
  getCompanyFinancials,
  InvalidCikError,
  NoFactsError,
} from "@/lib/research/edgar";
import { buildInsights } from "@/lib/research/insights";
import { buildAiSummary } from "@/lib/research/ai-summary";
import { isValidCik, isValidTicker } from "@/lib/research/validate";
import { clientKey, rateLimit } from "@/lib/research/ratelimit";

export const maxDuration = 60;

export async function GET(
  req: Request,
  { params }: { params: { cik: string } }
) {
  const { cik } = params;
  const rawTicker = new URL(req.url).searchParams.get("ticker") ?? "";

  if (!isValidCik(cik)) {
    return Response.json({ error: "Invalid company id." }, { status: 400 });
  }
  if (rawTicker && !isValidTicker(rawTicker)) {
    return Response.json({ error: "Invalid ticker." }, { status: 400 });
  }

  // This endpoint spends Anthropic tokens per cold request.
  const limit = rateLimit(`summary:${clientKey(req)}`, 20, 60);
  if (!limit.ok) {
    return Response.json(
      { error: "Too many requests. Try again shortly." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  const ticker = await canonicalTicker(cik, rawTicker);

  try {
    // Cached from the financials request that just ran, so this is normally a
    // cache hit rather than a second SEC download.
    const financials = await getCompanyFinancials(cik, ticker);
    const insights = buildInsights(financials);
    const summary = await buildAiSummary(financials, insights);
    return Response.json({ summary });
  } catch (e) {
    if (e instanceof InvalidCikError || e instanceof NoFactsError) {
      return Response.json({ summary: null });
    }
    console.error(`[summary] failed for cik=${cik}:`, e);
    // A missing summary is not a page failure: the rule-based insights stand
    // on their own, so degrade quietly rather than surfacing an error.
    return Response.json({ summary: null });
  }
}
