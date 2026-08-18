import { getFilings } from "@/lib/research/filings-server";
import { publicErrorMessage } from "@/lib/research/http";
import { isValidCik } from "@/lib/research/validate";

export const maxDuration = 20;

export async function GET(
  _req: Request,
  { params }: { params: {  cik: string  } }
) {
  const { cik  } = params;
  if (!isValidCik(cik)) {
    return Response.json({ error: "Invalid company id." }, { status: 400 });
  }

  try {
    const data = await getFilings(cik);
    return Response.json(data);
  } catch (e) {
    console.error("[filings]", e);
    return Response.json(
      { error: publicErrorMessage(e, "Could not load SEC filings.") },
      { status: 502 }
    );
  }
}
