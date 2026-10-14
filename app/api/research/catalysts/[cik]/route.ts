import { getCatalysts } from "@/lib/research/catalysts-server";
import { getMacroCalendar } from "@/lib/research/macro-server";
import { macroForCompany, macroScopeLine } from "@/lib/research/macro-calendar";
import { publicErrorMessage } from "@/lib/research/http";
import { isValidCik, isValidTicker } from "@/lib/research/validate";

export const maxDuration = 30;

export async function GET(
  req: Request,
  { params }: { params: { cik: string } }
) {
  const { cik } = params;
  if (!isValidCik(cik)) {
    return Response.json({ error: "Invalid company id." }, { status: 400 });
  }

  const url = new URL(req.url);
  const tickerRaw = (url.searchParams.get("ticker") ?? "").toUpperCase();
  const ticker = isValidTicker(tickerRaw) ? tickerRaw : "";
  const sector = (url.searchParams.get("sector") ?? "").trim().slice(0, 80);
  const industry = (url.searchParams.get("industry") ?? "").trim().slice(0, 80);
  const sic = (url.searchParams.get("sic") ?? "").trim().slice(0, 8);

  try {
    const company = await getCatalysts(cik, ticker);
    let macro: Awaited<ReturnType<typeof getMacroCalendar>> = [];
    let macroNote = macroScopeLine(sector || null, industry || null, sic || null);
    try {
      macro = macroForCompany(
        await getMacroCalendar(),
        sector || null,
        industry || null,
        sic || null
      );
    } catch (e) {
      console.error("[catalysts] macro", e);
      macro = [];
      macroNote = "The economic calendar is unavailable right now.";
    }
    return Response.json({ ...company, macro, macroNote });
  } catch (e) {
    console.error("[catalysts]", e);
    return Response.json(
      { error: publicErrorMessage(e, "Could not load company catalysts.") },
      { status: 502 }
    );
  }
}
