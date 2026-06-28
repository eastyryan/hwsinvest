"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { fileSize } from "@/lib/format";

type FileRow = {
  name: string;
  path: string;
  size: number;
  modified: string;
  url: string | null;
};

// Shared file browser for both the members page and the admin page.
// When `admin` is true it also shows the drag-and-drop uploader and a
// delete button on each row.
export default function MemberFiles({ admin = false }: { admin?: boolean }) {
  const router = useRouter();
  const [files, setFiles] = useState<FileRow[]>([]);
  const [configured, setConfigured] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/files", { cache: "no-store" });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to load");
      const j = await res.json();
      setFiles(j.files || []);
      setConfigured(j.configured !== false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load files");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function upload(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setUploading(true);
    setError("");
    try {
      for (const file of Array.from(fileList)) {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch("/api/files", { method: "POST", body: form });
        if (!res.ok) {
          throw new Error((await res.json()).error || `Failed to upload ${file.name}`);
        }
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function remove(path: string, name: string) {
    if (!confirm(`Delete "${name}"? This can't be undone.`)) return;
    try {
      const res = await fetch("/api/files", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Delete failed");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  }

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div>
      {admin && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            upload(e.dataTransfer.files);
          }}
          onClick={() => inputRef.current?.click()}
          style={{
            border: `2px dashed ${dragOver ? "var(--brandSolid)" : "var(--line)"}`,
            background: dragOver ? "var(--card2)" : "var(--card)",
            borderRadius: 14,
            padding: "32px 20px",
            textAlign: "center",
            cursor: "pointer",
            marginBottom: 26,
            transition: "border-color .15s, background .15s",
          }}
        >
          <input
            ref={inputRef}
            type="file"
            multiple
            hidden
            onChange={(e) => upload(e.target.files)}
          />
          <p style={{ fontSize: 15.5, fontWeight: 600, color: "var(--text)" }}>
            {uploading ? "Uploading…" : "Drop files here or click to upload"}
          </p>
          <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 6 }}>
            PDFs, slides, spreadsheets — up to 150&nbsp;MB each
          </p>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <span style={{ fontSize: 13.5, color: "var(--muted)" }}>
          {loading ? "Loading…" : `${files.length} file${files.length === 1 ? "" : "s"}`}
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

      {error && (
        <p style={{ color: "var(--down)", fontSize: 14, marginBottom: 14 }}>{error}</p>
      )}

      {!configured && !loading && (
        <div
          style={{
            background: "var(--card)",
            border: "1px solid var(--line)",
            borderRadius: 12,
            padding: 20,
            color: "var(--muted)",
            fontSize: 14,
          }}
        >
          File storage isn&apos;t connected yet. Add the Dropbox keys in the site&apos;s
          environment settings to enable uploads and downloads.
        </div>
      )}

      {configured && !loading && files.length === 0 && !error && (
        <div
          style={{
            background: "var(--card)",
            border: "1px solid var(--line)",
            borderRadius: 12,
            padding: 24,
            textAlign: "center",
            color: "var(--muted)",
            fontSize: 14,
          }}
        >
          No files yet{admin ? " — upload the first one above." : "."}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {files.map((f) => (
          <div
            key={f.path}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              background: "var(--card)",
              border: "1px solid var(--line)",
              borderRadius: 12,
              padding: "14px 16px",
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <path d="M14 2v6h6" />
            </svg>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: "var(--text)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {f.name}
              </div>
              <div style={{ fontSize: 12.5, color: "var(--faint)", marginTop: 2 }}>
                {fileSize(f.size)}
                {f.modified ? ` · ${new Date(f.modified).toLocaleDateString()}` : ""}
              </div>
            </div>
            {f.url && (
              <a
                href={f.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#fbfaf9",
                  background: "var(--brandSolid)",
                  padding: "7px 14px",
                  borderRadius: 8,
                  textDecoration: "none",
                  whiteSpace: "nowrap",
                }}
              >
                Download
              </a>
            )}
            {admin && (
              <button
                onClick={() => remove(f.path, f.name)}
                aria-label={`Delete ${f.name}`}
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--down)",
                  background: "transparent",
                  border: "1px solid var(--line)",
                  padding: "7px 12px",
                  borderRadius: 8,
                  cursor: "pointer",
                }}
              >
                Delete
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
