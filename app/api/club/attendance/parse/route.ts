import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { parseAttendanceSheet, type RosterPerson } from "@/lib/attendance-match";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/club/attendance/parse
// { text, roster?: { name, email }[] } → match result
// Admin-only. Uses deterministic matching, then SpaceXAI for leftovers.
export async function POST(request: Request) {
  if ((await getSession()) !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  let text = "";
  let roster: RosterPerson[] = [];
  try {
    const body = await request.json();
    text = typeof body?.text === "string" ? body.text : "";
    if (Array.isArray(body?.roster)) {
      roster = body.roster
        .filter((r: unknown) => r && typeof r === "object")
        .map((r: { name?: unknown; email?: unknown }) => ({
          name: typeof r.name === "string" ? r.name : "",
          email: typeof r.email === "string" ? r.email : "",
        }));
    }
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  if (!text.trim()) {
    return NextResponse.json({ error: "Paste a sign-in list or CSV first." }, { status: 400 });
  }
  if (text.length > 200_000) {
    return NextResponse.json({ error: "That paste is too large." }, { status: 400 });
  }

  try {
    const result = await parseAttendanceSheet(text, roster);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Parse failed" },
      { status: 502 }
    );
  }
}
