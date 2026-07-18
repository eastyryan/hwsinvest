import { getPriceSeries } from "@/lib/research/prices";

export async function GET(
  req: Request,
  { params }: { params: { ticker: string } }
) {
  const { ticker } = params;
  const rangeKey = new URL(req.url).searchParams.get("range") ?? "5y";
  try {
    return Response.json(await getPriceSeries(ticker, rangeKey));
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Price data unavailable" },
      { status: 502 }
    );
  }
}
