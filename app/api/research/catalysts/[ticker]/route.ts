import { getCompanyCatalysts } from "@/lib/research/catalysts-server";
import { publicErrorMessage } from "@/lib/research/http";
import { isValidCik, isValidTicker } from "@/lib/research/validate";

export const maxDuration = 20;

export async function GET(
  req: Request,
  { params }: { params: { ticker: string } }
) {
  const { ticker } = params;
  if (!isValidTicker(ticker)) {
    return Response.json({ error: "Invalid ticker." }, { status: 400 });
  }
  const cik = new URL(req.url).searchParams.get("cik");
  if (cik && !isValidCik(cik)) {
    return Response.json({ error: "Invalid company id." }, { status: 400 });
  }

  try {
    const catalysts = await getCompanyCatalysts(ticker, cik);
    return Response.json({ catalysts });
  } catch (e) {
    console.error("[catalysts]", e);
    return Response.json(
      { error: publicErrorMessage(e, "Could not load company catalysts.") },
      { status: 502 }
    );
  }
}
