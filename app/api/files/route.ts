import { NextResponse } from "next/server";
import { getSession, hasMemberAccess } from "@/lib/auth";
import {
  isDropboxConfigured,
  listEntries,
  temporaryLink,
  uploadFile,
  deletePath,
  createFolder,
  ensureFolder,
  safePath,
  BASE_FOLDER,
  BOARD_FOLDER,
  isBoardPath,
  isHiddenPath,
  type FileScope,
} from "@/lib/dropbox";

export const dynamic = "force-dynamic"; // never cache member files

function parseScope(raw: string | null | undefined): FileScope {
  return raw === "board" ? "board" : "members";
}

/** Board scope is admin-only. Members scope must not touch hidden paths. */
function denyAccess(role: string | null, scope: FileScope, path: string): string | null {
  if (scope === "board" || isBoardPath(path)) {
    if (role !== "admin") return "Admin only";
  }
  // Never serve _club-data (or other hidden roots) through the file browser,
  // even to admins — that JSON is owned by /api/club.
  if (isHiddenPath(path) && !isBoardPath(path)) return "Not found";
  return null;
}

// GET /api/files?path=/sub&scope=members|board → entries in that folder.
// Files include a short-lived download link; folders are navigable.
export async function GET(request: Request) {
  const role = await getSession();
  if (!hasMemberAccess(role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isDropboxConfigured()) {
    return NextResponse.json({ entries: [], path: "", configured: false });
  }

  const url = new URL(request.url);
  const scope = parseScope(url.searchParams.get("scope"));
  const dir = safePath(url.searchParams.get("path"), scope);

  const denied = denyAccess(role, scope, dir);
  if (denied) {
    return NextResponse.json({ error: denied }, { status: denied === "Admin only" ? 403 : 404 });
  }

  try {
    if (scope === "board") await ensureFolder(BOARD_FOLDER);

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
      base: scope === "board" ? BOARD_FOLDER : BASE_FOLDER,
      scope,
      configured: true,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Dropbox error" },
      { status: 502 }
    );
  }
}

// POST /api/files → upload (multipart, field "file", optional "path"=folder,
// optional "scope"=board) OR create a folder when sent as JSON
// { action: "mkdir", path, name, scope? }.
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
      const scope = parseScope(typeof body.scope === "string" ? body.scope : undefined);
      const dir = safePath(body.path, scope);
      const denied = denyAccess(role, scope, dir);
      if (denied) {
        return NextResponse.json({ error: denied }, { status: denied === "Admin only" ? 403 : 404 });
      }
      const name = typeof body.name === "string" ? body.name : "";
      if (!name.trim()) {
        return NextResponse.json({ error: "Folder name required" }, { status: 400 });
      }
      if (scope === "board") await ensureFolder(BOARD_FOLDER);
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
    const scope = parseScope(typeof form.get("scope") === "string" ? (form.get("scope") as string) : undefined);
    const dir = safePath(typeof form.get("path") === "string" ? (form.get("path") as string) : "", scope);
    const denied = denyAccess(role, scope, dir);
    if (denied) {
      return NextResponse.json({ error: denied }, { status: denied === "Admin only" ? 403 : 404 });
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (file.size > 150 * 1024 * 1024) {
      return NextResponse.json({ error: "File exceeds 150MB" }, { status: 413 });
    }
    if (scope === "board") await ensureFolder(BOARD_FOLDER);
    await uploadFile(dir, file.name, await file.arrayBuffer());
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Upload failed" },
      { status: 502 }
    );
  }
}

// DELETE /api/files  { path, scope? } → remove a file or folder (admin only).
export async function DELETE(request: Request) {
  const role = await getSession();
  if (role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }
  try {
    const body = await request.json();
    const scope = parseScope(typeof body?.scope === "string" ? body.scope : undefined);
    const path = safePath(typeof body?.path === "string" ? body.path : "", scope);
    const root = scope === "board" ? BOARD_FOLDER : BASE_FOLDER;
    if (!path || path === root) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }
    const denied = denyAccess(role, scope, path);
    if (denied) {
      return NextResponse.json({ error: denied }, { status: denied === "Admin only" ? 403 : 404 });
    }
    // Don't let anyone delete the board root folder itself via a path trick.
    if (path.toLowerCase() === BOARD_FOLDER.toLowerCase()) {
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
