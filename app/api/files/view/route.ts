import { getSession, hasMemberAccess } from "@/lib/auth";
import {
  downloadFile,
  safePath,
  isDropboxConfigured,
  isBoardPath,
  isHiddenPath,
  type FileScope,
} from "@/lib/dropbox";
import { mimeFor } from "@/lib/preview";

export const dynamic = "force-dynamic";

// GET /api/files/view?path=/foo/bar.pdf&scope=members|board
// Streams a file inline (Content-Disposition: inline) so PDFs/images/text
// render in the browser. Members only for the shared area; board paths need
// the admin role. Access stays behind the login either way.
export async function GET(request: Request) {
  const role = await getSession();
  if (!hasMemberAccess(role)) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (!isDropboxConfigured()) {
    return new Response("Not configured", { status: 503 });
  }

  const url = new URL(request.url);
  const scope: FileScope = url.searchParams.get("scope") === "board" ? "board" : "members";
  const raw = url.searchParams.get("path");
  const path = safePath(raw, scope);
  if (!path) return new Response("Bad path", { status: 400 });

  if (scope === "board" || isBoardPath(path)) {
    if (role !== "admin") return new Response("Forbidden", { status: 403 });
  }
  if (isHiddenPath(path) && !isBoardPath(path)) {
    return new Response("Not found", { status: 404 });
  }

  const file = await downloadFile(path);
  if (!file) return new Response("Not found", { status: 404 });

  const name = path.split("/").pop() || "file";
  return new Response(file.body, {
    status: 200,
    headers: {
      "Content-Type": mimeFor(name),
      "Content-Disposition": `inline; filename="${name.replace(/"/g, "")}"`,
      "Content-Length": String(file.size),
      "Cache-Control": "private, no-store",
    },
  });
}
