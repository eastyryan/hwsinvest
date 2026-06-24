import { NextResponse } from "next/server";
import { getQuotes } from "@/lib/finnhub";

// GET /api/quote?symbols=SPY,QQQ,DIA
// Used by the client-side ticker to refresh without exposing the API key.
export const revalidate = 30;

export async function GET(request: Request) {
  const param = new URL(request.url).searchParams.get("symbols") ?? "SPY";
  const symbols = param
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 25);

  try {
    const quotes = await getQuotes(symbols);
    return NextResponse.json({ quotes });
  } catch {
    return NextResponse.json({ error: "Upstream error" }, { status: 502 });
  }
}
