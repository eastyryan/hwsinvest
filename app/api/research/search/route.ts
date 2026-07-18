import { searchTickers } from "@/lib/research/edgar";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q") ?? "";
  try {
    return Response.json(await searchTickers(q));
  } catch {
    return Response.json([], { status: 502 });
  }
}
