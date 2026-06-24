import { NextResponse } from "next/server";
import { getLatest } from "@/lib/fred";

// GET /api/yield?series=DGS10
export const revalidate = 3600;

export async function GET(request: Request) {
  const series = (
    new URL(request.url).searchParams.get("series") ?? "DGS10"
  ).toUpperCase();
  try {
    const data = await getLatest(series);
    return NextResponse.json(data ?? { error: "No data" });
  } catch {
    return NextResponse.json({ error: "Upstream error" }, { status: 502 });
  }
}
