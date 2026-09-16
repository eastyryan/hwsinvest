import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { EMPTY, loadClubData, saveClubData, storageKind } from "@/lib/club-store";

export const dynamic = "force-dynamic"; // roster and schedule are never cached

// The roster holds student emails and the schedule is internal planning, so
// both sides of this route are admin-only, not member-readable.

// GET /api/club → { data, storage }
export async function GET() {
  if ((await getSession()) !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }
  const storage = storageKind();
  if (storage === "none") {
    return NextResponse.json({ data: EMPTY, storage });
  }
  try {
    return NextResponse.json({ data: await loadClubData(), storage });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Dropbox error" },
      { status: 502 }
    );
  }
}

// PUT /api/club  { roster, events, attendance } → saved snapshot
export async function PUT(request: Request) {
  if ((await getSession()) !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }
  if (storageKind() === "none") {
    return NextResponse.json(
      { error: "Dropbox is not configured, so nothing can be saved to the server." },
      { status: 503 }
    );
  }
  try {
    const data = await saveClubData(await request.json());
    return NextResponse.json({ data, storage: "dropbox" });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Save failed" },
      { status: 502 }
    );
  }
}
