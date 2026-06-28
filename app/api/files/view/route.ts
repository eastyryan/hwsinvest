import { getSession, hasMemberAccess } from "@/lib/auth";
import { downloadFile, safePath, isDropboxConfigured } from "@/lib/dropbox";
import { mimeFor } from "@/lib/preview";

export const dynamic = "force-dynamic";

// GET /api/files/view?path=/foo/bar.pdf
// Streams a file inline (Content-Disposition: inline) so PDFs/images/text
// render in the browser. Members only; access stays behind the login.
export async function GET(request: Request) {
  const role = await getSession();
  if (!hasMemberAccess(role)) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (!isDropboxConfigured()) {
    return new Response("Not configured", { status: 503 });
  }

  const raw = new URL(request.url).searchParams.get("path");
  const path = safePath(raw);
  if (!path) return new Response("Bad path", { status: 400 });

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
