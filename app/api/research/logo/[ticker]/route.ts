import { companyLogoSources, logoTicker } from "@/lib/research/company-logo";
import { isValidTicker } from "@/lib/research/validate";

export const maxDuration = 15;

const IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  "image/x-icon",
  "image/vnd.microsoft.icon",
]);

/** Same-origin logo. The page policy blocks third-party images, so the browser cannot load them directly. */
export async function GET(
  req: Request,
  { params }: { params: { ticker: string } }
) {
  const { ticker } = params;
  if (!isValidTicker(ticker) || !logoTicker(ticker)) {
    return new Response(null, { status: 400 });
  }

  const website = new URL(req.url).searchParams.get("website");
  for (const url of companyLogoSources(ticker, website)) {
    try {
      const upstream = await fetch(url, {
        redirect: "follow",
        signal: AbortSignal.timeout(4000),
        headers: { Accept: "image/*,*/*" },
      });
      if (!upstream.ok) continue;
      const type = (upstream.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
      if (!IMAGE_TYPES.has(type)) continue;
      const bytes = await upstream.arrayBuffer();
      if (bytes.byteLength < 80 || bytes.byteLength > 1_000_000) continue;
      return new Response(bytes, {
        headers: {
          "Content-Type": type,
          "Cache-Control": "public, max-age=86400",
          "X-Content-Type-Options": "nosniff",
        },
      });
    } catch {
      continue;
    }
  }

  return new Response(null, {
    status: 404,
    headers: { "Cache-Control": "public, max-age=300" },
  });
}
