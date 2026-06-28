import { NextResponse } from "next/server";
import { getSession, hasMemberAccess } from "@/lib/auth";
import {
  isDropboxConfigured,
  listFiles,
  temporaryLink,
  uploadFile,
  deleteFile,
} from "@/lib/dropbox";

export const dynamic = "force-dynamic"; // never cache member files

// GET /api/files → list of files with short-lived download links (members+).
export async function GET() {
  const role = await getSession();
  if (!hasMemberAccess(role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isDropboxConfigured()) {
    return NextResponse.json({ files: [], configured: false });
  }
  try {
    const files = await listFiles();
    const withLinks = await Promise.all(
      files.map(async (f) => ({ ...f, url: await temporaryLink(f.path) }))
    );
    return NextResponse.json({ files: withLinks, configured: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Dropbox error" },
      { status: 502 }
    );
  }
}

// POST /api/files (multipart form, field "file") → upload (admin only).
export async function POST(request: Request) {
  const role = await getSession();
  if (role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }
  if (!isDropboxConfigured()) {
    return NextResponse.json({ error: "Dropbox not configured" }, { status: 503 });
  }
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (file.size > 150 * 1024 * 1024) {
      return NextResponse.json({ error: "File exceeds 150MB" }, { status: 413 });
    }
    await uploadFile(file.name, await file.arrayBuffer());
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Upload failed" },
      { status: 502 }
    );
  }
}

// DELETE /api/files  { path } → remove a file (admin only).
export async function DELETE(request: Request) {
  const role = await getSession();
  if (role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }
  try {
    const body = await request.json();
    const path = typeof body?.path === "string" ? body.path : "";
    if (!path) return NextResponse.json({ error: "No path" }, { status: 400 });
    await deleteFile(path);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Delete failed" },
      { status: 502 }
    );
  }
}
