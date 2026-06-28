import { NextResponse } from "next/server";
import { getSession, hasMemberAccess } from "@/lib/auth";
import {
  isDropboxConfigured,
  listEntries,
  temporaryLink,
  uploadFile,
  deletePath,
  createFolder,
  safePath,
  BASE_FOLDER,
} from "@/lib/dropbox";

export const dynamic = "force-dynamic"; // never cache member files

// GET /api/files?path=/sub → entries (folders + files) in that folder.
// Files include a short-lived download link; folders are navigable.
export async function GET(request: Request) {
  const role = await getSession();
  if (!hasMemberAccess(role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isDropboxConfigured()) {
    return NextResponse.json({ entries: [], path: "", configured: false });
  }
  const dir = safePath(new URL(request.url).searchParams.get("path"));
  try {
    const entries = await listEntries(dir);
    const withLinks = await Promise.all(
      entries.map(async (e) =>
        e.type === "file"
          ? { ...e, url: await temporaryLink(e.path) }
          : { ...e, url: null }
      )
    );
    return NextResponse.json({
      entries: withLinks,
      path: dir,
      base: BASE_FOLDER,
      configured: true,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Dropbox error" },
      { status: 502 }
    );
  }
}

// POST /api/files → upload (multipart, field "file", optional "path"=folder)
// OR create a folder when sent as JSON { action: "mkdir", path, name }.
export async function POST(request: Request) {
  const role = await getSession();
  if (role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }
  if (!isDropboxConfigured()) {
    return NextResponse.json({ error: "Dropbox not configured" }, { status: 503 });
  }

  const contentType = request.headers.get("content-type") || "";

  // Create folder (JSON body)
  if (contentType.includes("application/json")) {
    try {
      const body = await request.json();
      if (body?.action !== "mkdir") {
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
      }
      const dir = safePath(body.path);
      const name = typeof body.name === "string" ? body.name : "";
      if (!name.trim()) {
        return NextResponse.json({ error: "Folder name required" }, { status: 400 });
      }
      await createFolder(dir, name);
      return NextResponse.json({ ok: true });
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Failed" },
        { status: 502 }
      );
    }
  }

  // Upload file (multipart)
  try {
    const form = await request.formData();
    const file = form.get("file");
    const dir = safePath(typeof form.get("path") === "string" ? (form.get("path") as string) : "");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (file.size > 150 * 1024 * 1024) {
      return NextResponse.json({ error: "File exceeds 150MB" }, { status: 413 });
    }
    await uploadFile(dir, file.name, await file.arrayBuffer());
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Upload failed" },
      { status: 502 }
    );
  }
}

// DELETE /api/files  { path } → remove a file or folder (admin only).
export async function DELETE(request: Request) {
  const role = await getSession();
  if (role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }
  try {
    const body = await request.json();
    const path = safePath(typeof body?.path === "string" ? body.path : "");
    if (!path || path === BASE_FOLDER) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }
    await deletePath(path);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Delete failed" },
      { status: 502 }
    );
  }
}
