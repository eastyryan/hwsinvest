import { getPriceSeries, isValidRange } from "@/lib/research/prices";
import { isValidTicker } from "@/lib/research/validate";

export const maxDuration = 30;

export async function GET(
  req: Request,
  { params }: { params: { ticker: string } }
) {
  const { ticker } = params;
  const requested = new URL(req.url).searchParams.get("range") ?? "5y";
  // Unknown ranges fall back rather than erroring; isValidRange uses
  // Object.hasOwn so inherited keys like "toString" can't slip through.
  const rangeKey = isValidRange(requested) ? requested : "5y";

  if (!isValidTicker(ticker)) {
    return Response.json({ error: "Invalid ticker." }, { status: 400 });
  }

  try {
    return Response.json(await getPriceSeries(ticker, rangeKey));
  } catch (e) {
    // Never forward the upstream message: the Twelve Data key travels as a
    // query parameter and its error payloads can echo request context.
    console.error(`[prices] failed for ${ticker} range=${rangeKey}:`, e);
    return Response.json(
      { error: "Price data is unavailable right now." },
      { status: 502 }
    );
  }
}
