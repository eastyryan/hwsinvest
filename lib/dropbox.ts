// Server-only Dropbox helpers for the members file area.
//
// Auth model: a long-lived *refresh token* (created once, see SETUP notes in
// .env.example) is exchanged for short-lived access tokens on demand. This is
// the only Dropbox auth flow that survives unattended on a server, raw
// "generated access tokens" from the Dropbox console expire after 4 hours.
//
// Everything lives under one base folder (DROPBOX_FOLDER). With an "App folder"
// scoped app, DROPBOX_FOLDER can stay "" (the sandboxed app-folder root).
// Members can browse subfolders below that root.

export type DropboxEntry = {
  type: "file" | "folder";
  name: string;
  path: string; // path_lower, used for navigate / download / delete
  size: number;
  modified: string; // ISO date (files only)
};

// Base folder, normalized to "" or "/Something" (no trailing slash).
export const BASE_FOLDER = (process.env.DROPBOX_FOLDER ?? "").replace(/\/+$/, "");

// Where the admin console keeps its JSON (roster, calendar). It lives inside
// the same Dropbox app folder but is filtered out of listEntries, so it never
// shows up in the members file browser.
export const DATA_FOLDER = `${BASE_FOLDER}/_club-data`;

// Board-only docs (budgets, officer notes, etc.). Same Dropbox app folder, but
// only the admin role can list, upload, download, or delete under it. Members
// never see the folder name and get 403 if they craft a path into it.
export const BOARD_FOLDER = `${BASE_FOLDER}/_board`;

/** Folders that must never appear in the members file browser. */
export const HIDDEN_FOLDERS = [DATA_FOLDER, BOARD_FOLDER] as const;

export type FileScope = "members" | "board";

export function isDropboxConfigured(): boolean {
  return Boolean(
    process.env.DROPBOX_APP_KEY &&
      process.env.DROPBOX_APP_SECRET &&
      process.env.DROPBOX_REFRESH_TOKEN
  );
}

/** True when `path` is the board folder or something inside it. */
export function isBoardPath(path: string): boolean {
  const p = path.toLowerCase();
  const board = BOARD_FOLDER.toLowerCase();
  if (!board) return p === "/_board" || p.startsWith("/_board/");
  return p === board || p.startsWith(board + "/");
}

/** True when `path` is a hidden system folder (or inside one). */
export function isHiddenPath(path: string): boolean {
  const p = path.toLowerCase();
  return HIDDEN_FOLDERS.some((folder) => {
    const f = folder.toLowerCase();
    return p === f || p.startsWith(f + "/");
  });
}

/**
 * Keep a requested path inside a sandbox so a crafted ?path= can't escape.
 * `scope: "board"` sandboxes under BOARD_FOLDER; otherwise under BASE_FOLDER.
 * Returns a clean absolute Dropbox path ("" = app-folder root when BASE is "").
 */
export function safePath(
  input: string | null | undefined,
  scope: FileScope = "members"
): string {
  const root = scope === "board" ? BOARD_FOLDER : BASE_FOLDER;
  let p = (input ?? "").trim();
  if (!p || p === "/") return root;
  if (!p.startsWith("/")) p = "/" + p;
  p = p.replace(/\/+$/, "").replace(/\.\.+/g, ""); // strip trailing slash + ".."
  const base = root.toLowerCase();
  if (base && !(p.toLowerCase() === base || p.toLowerCase().startsWith(base + "/"))) {
    return root; // outside the sandbox → snap back to root
  }
  // Members scope must never resolve into a hidden folder via path tricks.
  if (scope === "members" && isHiddenPath(p)) return BASE_FOLDER;
  return p;
}

// In-memory access-token cache (per server instance). Avoids refreshing on
// every request; refresh tokens are valid for ~4h, we re-mint a minute early.
let cached: { token: string; expires: number } | null = null;

async function accessToken(): Promise<string> {
  if (cached && cached.expires > Date.now()) return cached.token;

  const appKey = process.env.DROPBOX_APP_KEY!;
  const appSecret = process.env.DROPBOX_APP_SECRET!;
  const refresh = process.env.DROPBOX_REFRESH_TOKEN!;

  const res = await fetch("https://api.dropbox.com/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: "Basic " + btoa(`${appKey}:${appSecret}`),
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refresh,
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Dropbox token refresh failed (${res.status})`);
  }
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cached = {
    token: json.access_token,
    expires: Date.now() + (json.expires_in - 60) * 1000,
  };
  return cached.token;
}

async function rpc(endpoint: string, body: unknown): Promise<Response> {
  const token = await accessToken();
  return fetch(`https://api.dropboxapi.com/2/${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
}

// List entries (folders first, then files) inside an absolute folder path.
export async function listEntries(dir: string): Promise<DropboxEntry[]> {
  const res = await rpc("files/list_folder", {
    path: dir, // "" = app-folder root
    recursive: false,
    include_non_downloadable_files: false,
  });
  if (!res.ok) {
    if (res.status === 409) return []; // folder doesn't exist yet → empty
    throw new Error(`Dropbox list failed (${res.status})`);
  }
  const json = (await res.json()) as {
    entries: Array<{
      [".tag"]: string;
      name: string;
      path_lower: string;
      size?: number;
      server_modified?: string;
    }>;
  };
  const hidden = new Set(HIDDEN_FOLDERS.map((f) => f.toLowerCase()));
  const entries: DropboxEntry[] = json.entries
    .filter((e) => e[".tag"] === "file" || e[".tag"] === "folder")
    // Keep _club-data and _board out of the members file browser root.
    .filter((e) => !hidden.has(e.path_lower))
    .map((e) => ({
      type: e[".tag"] === "folder" ? "folder" : "file",
      name: e.name,
      path: e.path_lower,
      size: e.size ?? 0,
      modified: e.server_modified ?? "",
    }));
  // Folders first (alphabetical), then files (newest first).
  entries.sort((a, b) => {
    if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
    if (a.type === "folder") return a.name.localeCompare(b.name);
    return a.modified < b.modified ? 1 : -1;
  });
  return entries;
}

// A direct, time-limited (~4h) download URL. Used by the Office Online viewer,
// which needs a public URL it can fetch. Inline preview of PDFs/images/text
// instead goes through our own authed proxy (see app/api/files/view).
export async function temporaryLink(path: string): Promise<string | null> {
  const res = await rpc("files/get_temporary_link", { path });
  if (!res.ok) return null;
  const json = (await res.json()) as { link: string };
  return json.link;
}

// Stream a file's bytes through our server (keeps access behind the login).
export async function downloadFile(
  path: string
): Promise<{ body: ArrayBuffer; size: number } | null> {
  const token = await accessToken();
  const res = await fetch("https://content.dropboxapi.com/2/files/download", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Dropbox-API-Arg": JSON.stringify({ path }),
    },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const body = await res.arrayBuffer();
  return { body, size: body.byteLength };
}

// Delete a file OR folder (delete_v2 handles both).
export async function deletePath(path: string): Promise<void> {
  const res = await rpc("files/delete_v2", { path });
  if (!res.ok && res.status !== 409) {
    throw new Error(`Dropbox delete failed (${res.status})`);
  }
}

export async function createFolder(dir: string, name: string): Promise<void> {
  const clean = name.replace(/[\\/:*?"<>|]/g, "_").trim();
  if (!clean) throw new Error("Folder name required");
  const res = await rpc("files/create_folder_v2", { path: `${dir}/${clean}` });
  if (!res.ok && res.status !== 409) {
    throw new Error(`Dropbox create folder failed (${res.status})`);
  }
}

/** Create a folder at an absolute path if it isn't there yet (409 = ok). */
export async function ensureFolder(path: string): Promise<void> {
  if (!path) return;
  const res = await rpc("files/create_folder_v2", { path });
  if (!res.ok && res.status !== 409) {
    throw new Error(`Dropbox ensure folder failed (${res.status})`);
  }
}

// Upload bytes into a folder. Name collisions → Dropbox autorenames.
export async function uploadFile(
  dir: string,
  name: string,
  data: ArrayBuffer
): Promise<void> {
  const token = await accessToken();
  const safeName = name.replace(/[\\/:*?"<>|]/g, "_"); // strip path-y chars
  const dropboxPath = `${dir}/${safeName}`;
  const res = await fetch("https://content.dropboxapi.com/2/files/upload", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/octet-stream",
      "Dropbox-API-Arg": JSON.stringify({
        path: dropboxPath,
        mode: "add",
        autorename: true,
        mute: true,
      }),
    },
    body: data,
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Dropbox upload failed (${res.status}): ${text}`);
  }
}

// ── JSON documents (roster, calendar) ───────────────────────
// Small config blobs the admin console owns. Stored as plain JSON files under
// DATA_FOLDER with overwrite semantics, so each save replaces the last one
// instead of piling up autorenamed copies the way uploadFile() does.

export async function readJson<T>(name: string): Promise<T | null> {
  const token = await accessToken();
  const res = await fetch("https://content.dropboxapi.com/2/files/download", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Dropbox-API-Arg": JSON.stringify({ path: `${DATA_FOLDER}/${name}` }),
    },
    cache: "no-store",
  });
  if (res.status === 409) return null; // not written yet
  if (!res.ok) throw new Error(`Dropbox read failed (${res.status})`);
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`${name} is not valid JSON`);
  }
}

export async function writeJson(name: string, data: unknown): Promise<void> {
  // First save can race the folder existing; create it if needed.
  await ensureFolder(DATA_FOLDER);
  const token = await accessToken();
  const res = await fetch("https://content.dropboxapi.com/2/files/upload", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/octet-stream",
      "Dropbox-API-Arg": JSON.stringify({
        path: `${DATA_FOLDER}/${name}`,
        mode: "overwrite",
        autorename: false,
        mute: true,
      }),
    },
    body: JSON.stringify(data, null, 2),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Dropbox write failed (${res.status}): ${await res.text()}`);
  }
}
