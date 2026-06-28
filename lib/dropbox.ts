// Server-only Dropbox helpers for the members file area.
//
// Auth model: a long-lived *refresh token* (created once, see SETUP notes in
// .env.example) is exchanged for short-lived access tokens on demand. This is
// the only Dropbox auth flow that survives unattended on a server — raw
// "generated access tokens" from the Dropbox console expire after 4 hours.
//
// All files live under one folder (DROPBOX_FOLDER). If you create the Dropbox
// app with "App folder" access, that folder is sandboxed and DROPBOX_FOLDER can
// stay "" (the app folder root).

export type DropboxFile = {
  name: string;
  path: string; // path_lower, used for download/delete
  size: number;
  modified: string; // ISO date
};

const FOLDER = (process.env.DROPBOX_FOLDER ?? "").replace(/\/$/, "");

export function isDropboxConfigured(): boolean {
  return Boolean(
    process.env.DROPBOX_APP_KEY &&
      process.env.DROPBOX_APP_SECRET &&
      process.env.DROPBOX_REFRESH_TOKEN
  );
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

// List files in the members folder (newest first). Folders are skipped.
export async function listFiles(): Promise<DropboxFile[]> {
  const res = await rpc("files/list_folder", {
    path: FOLDER, // "" = app-folder root
    recursive: false,
    include_non_downloadable_files: false,
  });
  if (!res.ok) {
    // Folder not found yet (nothing uploaded) → treat as empty.
    if (res.status === 409) return [];
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
  return json.entries
    .filter((e) => e[".tag"] === "file")
    .map((e) => ({
      name: e.name,
      path: e.path_lower,
      size: e.size ?? 0,
      modified: e.server_modified ?? "",
    }))
    .sort((a, b) => (a.modified < b.modified ? 1 : -1));
}

// A direct, time-limited (~4h) download URL for a file. We never expose the
// Dropbox token to the browser — only these short-lived links.
export async function temporaryLink(path: string): Promise<string | null> {
  const res = await rpc("files/get_temporary_link", { path });
  if (!res.ok) return null;
  const json = (await res.json()) as { link: string };
  return json.link;
}

export async function deleteFile(path: string): Promise<void> {
  const res = await rpc("files/delete_v2", { path });
  if (!res.ok && res.status !== 409) {
    throw new Error(`Dropbox delete failed (${res.status})`);
  }
}

// Upload bytes to the members folder. Names collide → Dropbox autorenames.
export async function uploadFile(name: string, data: ArrayBuffer): Promise<void> {
  const token = await accessToken();
  const safeName = name.replace(/[\\/:*?"<>|]/g, "_"); // strip path-y chars
  const dropboxPath = `${FOLDER}/${safeName}`;
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
