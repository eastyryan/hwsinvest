import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { workbookToCsvText } from "@/lib/attendance-sheet";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// POST /api/club/attendance/sheet  (multipart file) → { text: csv }
// Admin-only. Converts the Google Form xlsx export into CSV for the matcher.
export async function POST(request: Request) {
  if ((await getSession()) !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected a file upload." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Attach an .xlsx or .xls file." }, { status: 400 });
  }
  if (file.size > 5_000_000) {
    return NextResponse.json({ error: "That spreadsheet is too large (5 MB max)." }, { status: 400 });
  }

  const name = file.name.toLowerCase();
  if (!name.endsWith(".xlsx") && !name.endsWith(".xls")) {
    return NextResponse.json({ error: "Upload an Excel .xlsx file (or paste CSV instead)." }, { status: 400 });
  }

  try {
    const text = await workbookToCsvText(await file.arrayBuffer());
    return NextResponse.json({ text });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not read spreadsheet" },
      { status: 422 }
    );
  }
}
