import { getStreetEstimates } from "@/lib/research/street-estimates";
import { publicErrorMessage } from "@/lib/research/http";
import { isValidTicker } from "@/lib/research/validate";

export const maxDuration = 15;

export async function GET(
  _req: Request,
  { params }: { params: {  ticker: string  } }
) {
  const { ticker  } = params;
  if (!isValidTicker(ticker)) {
    return Response.json({ error: "Invalid ticker." }, { status: 400 });
  }

  try {
    const estimates = await getStreetEstimates(ticker);
    if (!estimates) {
      return Response.json(
        { estimates: null, error: "No street estimates available for this ticker." },
        { status: 404 }
      );
    }
    return Response.json({ estimates });
  } catch (e) {
    console.error("[estimates]", e);
    return Response.json(
      { error: publicErrorMessage(e, "Could not load street estimates.") },
      { status: 502 }
    );
  }
}
