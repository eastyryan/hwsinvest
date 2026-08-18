import { getSegments } from "@/lib/research/segments";
import { publicErrorMessage } from "@/lib/research/http";
import { isValidCik } from "@/lib/research/validate";

export const maxDuration = 45;

export async function GET(
  _req: Request,
  { params }: { params: {  cik: string  } }
) {
  const { cik  } = params;
  if (!isValidCik(cik)) {
    return Response.json({ error: "Invalid company id." }, { status: 400 });
  }

  try {
    const data = await getSegments(cik);
    return Response.json(data);
  } catch (e) {
    console.error("[segments]", e);
    return Response.json(
      { error: publicErrorMessage(e, "Could not load segment data.") },
      { status: 502 }
    );
  }
}
