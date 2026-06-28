// File-type helpers shared by the preview proxy and the file browser UI.

export type PreviewKind = "pdf" | "image" | "text" | "office" | "none";

function ext(name: string): string {
  const i = name.lastIndexOf(".");
  return i === -1 ? "" : name.slice(i + 1).toLowerCase();
}

const MIME: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  txt: "text/plain; charset=utf-8",
  md: "text/plain; charset=utf-8",
  csv: "text/plain; charset=utf-8",
  json: "application/json",
};

export function mimeFor(name: string): string {
  return MIME[ext(name)] ?? "application/octet-stream";
}

// How (if at all) a file can be shown inline in the browser.
//  pdf/image/text → streamed through our /api/files/view proxy
//  office         → embedded via Microsoft's Office Online viewer (needs a
//                   public temp link)
//  none           → download only
export function previewKind(name: string): PreviewKind {
  const e = ext(name);
  if (e === "pdf") return "pdf";
  if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(e)) return "image";
  if (["txt", "md", "csv", "json"].includes(e)) return "text";
  if (["doc", "docx", "xls", "xlsx", "ppt", "pptx"].includes(e)) return "office";
  return "none";
}
