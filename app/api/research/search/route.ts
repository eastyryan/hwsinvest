import { searchTickers } from "@/lib/research/edgar";
import { MAX_SEARCH_QUERY } from "@/lib/research/validate";

export async function GET(req: Request) {
  const q = (new URL(req.url).searchParams.get("q") ?? "").slice(0, MAX_SEARCH_QUERY);
  try {
    return Response.json({ results: await searchTickers(q) });
  } catch (e) {
    console.error("[search] failed:", e);
    // Previously returned a bare `[]` with a 502, so clients that read the body
    // rendered "no results" for what was actually an outage.
    return Response.json(
      { results: [], error: "Company search is unavailable right now." },
      { status: 502 }
    );
  }
}
