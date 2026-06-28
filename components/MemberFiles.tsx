"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { fileSize } from "@/lib/format";
import { previewKind, type PreviewKind } from "@/lib/preview";

type Entry = {
  type: "file" | "folder";
  name: string;
  path: string;
  size: number;
  modified: string;
  url: string | null;
};

type Preview = { name: string; path: string; kind: PreviewKind; url: string | null };

// Shared file browser for the members page and the admin page.
// When `admin` is true it also shows the uploader, "New folder", and delete.
export default function MemberFiles({ admin = false }: { admin?: boolean }) {
  const router = useRouter();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [path, setPath] = useState(""); // current folder ("" = root)
  const [base, setBase] = useState("");
  const [configured, setConfigured] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async (dir: string) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/files?path=${encodeURIComponent(dir)}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to load");
      const j = await res.json();
      setEntries(j.entries || []);
      setPath(j.path ?? dir);
      setBase(j.base ?? "");
      setConfigured(j.configured !== false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load files");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load("");
  }, [load]);

  // Upload into `target` folder (defaults to the folder we're viewing).
  async function upload(fileList: FileList | null, target?: string) {
    if (!fileList || fileList.length === 0) return;
    const dest = target ?? path;
    setUploading(true);
    setError("");
    try {
      for (const file of Array.from(fileList)) {
        const form = new FormData();
        form.append("file", file);
        form.append("path", dest);
        const res = await fetch("/api/files", { method: "POST", body: form });
        if (!res.ok) {
          throw new Error((await res.json()).error || `Failed to upload ${file.name}`);
        }
      }
      await load(path);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  // Per-folder hidden file input (admin "Upload here" button).
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [uploadTarget, setUploadTarget] = useState<string>("");
  const [dropFolder, setDropFolder] = useState<string | null>(null);
  function pickInto(target: string) {
    setUploadTarget(target);
    folderInputRef.current?.click();
  }

  async function newFolder() {
    const name = prompt("New folder name:");
    if (!name || !name.trim()) return;
    try {
      const res = await fetch("/api/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mkdir", path, name: name.trim() }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed");
      await load(path);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create folder");
    }
  }

  async function remove(e: Entry) {
    const label = e.type === "folder" ? "folder (and everything in it)" : "file";
    if (!confirm(`Delete this ${label}: "${e.name}"? This can't be undone.`)) return;
    try {
      const res = await fetch("/api/files", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: e.path }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Delete failed");
      await load(path);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  function openFile(e: Entry) {
    const kind = previewKind(e.name);
    if (kind === "none") {
      if (e.url) window.open(e.url, "_blank");
      return;
    }
    setPreview({ name: e.name, path: e.path, kind, url: e.url });
  }

  // Breadcrumb segments from base → current path.
  const rel = base && path.toLowerCase().startsWith(base.toLowerCase())
    ? path.slice(base.length)
    : path;
  const segments = rel.split("/").filter(Boolean);
  const crumbs = [{ label: "Files", path: base }];
  let acc = base;
  for (const seg of segments) {
    acc = `${acc}/${seg}`;
    crumbs.push({ label: seg, path: acc });
  }

  const fileCount = entries.filter((e) => e.type === "file").length;
  const folderCount = entries.filter((e) => e.type === "folder").length;

  return (
    <div>
      {admin && (
        <>
          <div
            onDragOver={(ev) => {
              ev.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(ev) => {
              ev.preventDefault();
              setDragOver(false);
              upload(ev.dataTransfer.files);
            }}
            onClick={() => inputRef.current?.click()}
            style={{
              border: `2px dashed ${dragOver ? "var(--brandSolid)" : "var(--line)"}`,
              background: dragOver ? "var(--card2)" : "var(--card)",
              borderRadius: 14,
              padding: "28px 20px",
              textAlign: "center",
              cursor: "pointer",
              marginBottom: 14,
              transition: "border-color .15s, background .15s",
            }}
          >
            <input
              ref={inputRef}
              type="file"
              multiple
              hidden
              onChange={(ev) => upload(ev.target.files)}
            />
            <p style={{ fontSize: 15.5, fontWeight: 600, color: "var(--text)" }}>
              {uploading ? "Uploading…" : "Drop files here or click to upload"}
            </p>
            <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 6 }}>
              Uploads into <strong>{crumbs[crumbs.length - 1].label}</strong> · up to 150&nbsp;MB each
            </p>
          </div>
          <button
            onClick={newFolder}
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "var(--text)",
              background: "var(--card2)",
              border: "1px solid var(--line)",
              borderRadius: 9,
              padding: "8px 14px",
              cursor: "pointer",
              marginBottom: 22,
            }}
          >
            + New folder
          </button>
        </>
      )}

      {/* Breadcrumbs */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 4, marginBottom: 12 }}>
        {crumbs.map((c, i) => (
          <span key={c.path} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            {i > 0 && <span style={{ color: "var(--faint)" }}>/</span>}
            <button
              onClick={() => load(c.path)}
              disabled={i === crumbs.length - 1}
              style={{
                fontSize: 13.5,
                fontWeight: i === crumbs.length - 1 ? 700 : 500,
                color: i === crumbs.length - 1 ? "var(--text)" : "var(--brand)",
                background: "transparent",
                border: "none",
                padding: "2px 2px",
                cursor: i === crumbs.length - 1 ? "default" : "pointer",
              }}
            >
              {c.label}
            </button>
          </span>
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <span style={{ fontSize: 13.5, color: "var(--muted)" }}>
          {loading
            ? "Loading…"
            : `${folderCount} folder${folderCount === 1 ? "" : "s"} · ${fileCount} file${fileCount === 1 ? "" : "s"}`}
        </span>
        <button
          onClick={logout}
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "var(--muted)",
            background: "transparent",
            border: "1px solid var(--line)",
            borderRadius: 8,
            padding: "6px 12px",
            cursor: "pointer",
          }}
        >
          Sign out
        </button>
      </div>

      {error && <p style={{ color: "var(--down)", fontSize: 14, marginBottom: 14 }}>{error}</p>}

      {!configured && !loading && (
        <div style={infoBox}>
          File storage isn&apos;t connected yet. Add the Dropbox keys in the site&apos;s
          environment settings to enable uploads and downloads.
        </div>
      )}

      {configured && !loading && entries.length === 0 && !error && (
        <div style={{ ...infoBox, textAlign: "center" }}>
          This folder is empty{admin ? " — upload files or create a folder above." : "."}
        </div>
      )}

      {/* Hidden input used by per-folder "Upload here" buttons. */}
      <input
        ref={folderInputRef}
        type="file"
        multiple
        hidden
        onChange={(ev) => {
          upload(ev.target.files, uploadTarget);
          if (folderInputRef.current) folderInputRef.current.value = "";
        }}
      />

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {entries.map((e) => {
          const isDropTarget = admin && e.type === "folder";
          return (
          <div
            key={e.path}
            style={{
              ...row,
              ...(dropFolder === e.path
                ? { borderColor: "var(--brandSolid)", background: "var(--card2)" }
                : null),
            }}
            onDragOver={isDropTarget ? (ev) => { ev.preventDefault(); setDropFolder(e.path); } : undefined}
            onDragLeave={isDropTarget ? () => setDropFolder((p) => (p === e.path ? null : p)) : undefined}
            onDrop={isDropTarget ? (ev) => { ev.preventDefault(); setDropFolder(null); upload(ev.dataTransfer.files, e.path); } : undefined}
          >
            {e.type === "folder" ? <FolderIcon /> : <FileIcon />}
            <button
              onClick={() => (e.type === "folder" ? load(e.path) : openFile(e))}
              style={{
                flex: 1,
                minWidth: 0,
                textAlign: "left",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: 0,
              }}
            >
              <div style={rowName}>{e.name}</div>
              <div style={{ fontSize: 12.5, color: "var(--faint)", marginTop: 2 }}>
                {e.type === "folder"
                  ? "Folder"
                  : `${fileSize(e.size)}${e.modified ? ` · ${new Date(e.modified).toLocaleDateString()}` : ""}`}
              </div>
            </button>
            {admin && e.type === "folder" && (
              <button onClick={() => pickInto(e.path)} style={btnPrimary}>
                Upload here
              </button>
            )}
            {e.type === "file" && previewKind(e.name) !== "none" && (
              <button onClick={() => openFile(e)} style={btnPrimary}>
                View
              </button>
            )}
            {e.type === "file" && e.url && (
              <a href={e.url} target="_blank" rel="noopener noreferrer" download style={btnGhost}>
                Download
              </a>
            )}
            {admin && (
              <button onClick={() => remove(e)} aria-label={`Delete ${e.name}`} style={btnDanger}>
                Delete
              </button>
            )}
          </div>
          );
        })}
      </div>

      {preview && <PreviewModal preview={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}

function PreviewModal({ preview, onClose }: { preview: Preview; onClose: () => void }) {
  const viewSrc = `/api/files/view?path=${encodeURIComponent(preview.path)}`;
  const officeSrc =
    preview.kind === "office" && preview.url
      ? `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(preview.url)}`
      : null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        zIndex: 100,
        display: "flex",
        flexDirection: "column",
        padding: "3vh 3vw",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--card)",
          border: "1px solid var(--line)",
          borderRadius: 14,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          maxWidth: 1100,
          margin: "0 auto",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "12px 16px", borderBottom: "1px solid var(--line)" }}>
          <span style={{ ...rowName, fontSize: 15 }}>{preview.name}</span>
          <div style={{ display: "flex", gap: 8 }}>
            {preview.url && (
              <a href={preview.url} target="_blank" rel="noopener noreferrer" download style={btnGhost}>
                Download
              </a>
            )}
            <button onClick={onClose} style={btnGhost}>Close</button>
          </div>
        </div>
        <div style={{ flex: 1, minHeight: 0, background: "var(--card2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {preview.kind === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={viewSrc} alt={preview.name} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
          ) : preview.kind === "office" ? (
            officeSrc ? (
              <iframe src={officeSrc} title={preview.name} style={{ width: "100%", height: "100%", border: "none" }} />
            ) : (
              <p style={{ color: "var(--muted)", padding: 24 }}>Preview unavailable — try Download.</p>
            )
          ) : (
            // pdf + text
            <iframe src={viewSrc} title={preview.name} style={{ width: "100%", height: "100%", border: "none" }} />
          )}
        </div>
      </div>
    </div>
  );
}

const infoBox: React.CSSProperties = {
  background: "var(--card)",
  border: "1px solid var(--line)",
  borderRadius: 12,
  padding: 22,
  color: "var(--muted)",
  fontSize: 14,
};
const row: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 14,
  background: "var(--card)",
  border: "1px solid var(--line)",
  borderRadius: 12,
  padding: "14px 16px",
};
const rowName: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 600,
  color: "var(--text)",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};
const btnPrimary: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: "#fbfaf9",
  background: "var(--brandSolid)",
  padding: "7px 14px",
  borderRadius: 8,
  textDecoration: "none",
  whiteSpace: "nowrap",
  border: "none",
  cursor: "pointer",
};
const btnGhost: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: "var(--text)",
  background: "var(--card2)",
  border: "1px solid var(--line)",
  padding: "7px 12px",
  borderRadius: 8,
  textDecoration: "none",
  whiteSpace: "nowrap",
  cursor: "pointer",
};
const btnDanger: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: "var(--down)",
  background: "transparent",
  border: "1px solid var(--line)",
  padding: "7px 12px",
  borderRadius: 8,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

function FolderIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </svg>
  );
}
function FileIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
    </svg>
  );
}
