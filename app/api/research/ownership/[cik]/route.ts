import { getOwnership, type OwnershipMode } from "@/lib/research/ownership";
import { canonicalTicker, getCompanyFinancials, InvalidCikError } from "@/lib/research/edgar";
import { publicErrorMessage } from "@/lib/research/http";
import { isValidCik, isValidTicker } from "@/lib/research/validate";

export const maxDuration = 60;

function parseMode(raw: string | null): OwnershipMode {
  if (raw === "quick" || raw === "deep" || raw === "full") return raw;
  return "full";
}

export async function GET(
  req: Request,
  { params }: { params: {  cik: string  } }
) {
  const { cik  } = params;
  const url = new URL(req.url);
  const rawTicker = url.searchParams.get("ticker") ?? "";
  const mode = parseMode(url.searchParams.get("mode"));

  if (!isValidCik(cik)) {
    return Response.json({ error: "Invalid company id." }, { status: 400 });
  }
  if (rawTicker && !isValidTicker(rawTicker)) {
    return Response.json({ error: "Invalid ticker." }, { status: 400 });
  }

  try {
    const ticker = await canonicalTicker(cik, rawTicker);

    // Shares outstanding powers the % of float columns. Soft-fail: ownership
    // still renders without percentages if financials are slow or missing.
    let sharesOutstanding: number | null = null;
    try {
      const fin = await getCompanyFinancials(cik, ticker);
      sharesOutstanding = fin.sharesOutstanding;
    } catch {
      sharesOutstanding = null;
    }

    const data = await getOwnership(cik, ticker, sharesOutstanding, { mode });
    return Response.json(data);
  } catch (e) {
    if (e instanceof InvalidCikError) {
      return Response.json({ error: "Invalid company id." }, { status: 400 });
    }
    console.error("[ownership]", e);
    return Response.json(
      { error: publicErrorMessage(e, "Could not load ownership activity.") },
      { status: 502 }
    );
  }
}
