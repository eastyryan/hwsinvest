// Route gate for the members area. Runs on the Edge before the page renders.
// Uses the same signed-cookie check as lib/auth (Web Crypto, edge-safe) but
// inlined here because middleware can't import the `next/headers` cookies()
// helper used by server components.

import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "hws_session";
const enc = new TextEncoder();

function secret(): string {
  return process.env.SESSION_SECRET ?? "dev-insecure-secret-change-me";
}

function b64url(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmac(data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return b64url(new Uint8Array(sig));
}

async function roleFromToken(token: string | undefined): Promise<string | null> {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  if ((await hmac(payload)) !== sig) return null;
  let decoded: string;
  try {
    decoded = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
  } catch {
    return null;
  }
  const [role, expStr] = decoded.split(".");
  const exp = Number(expStr);
  if (!exp || exp < Math.floor(Date.now() / 1000)) return null;
  if (role !== "member" && role !== "admin") return null;
  return role;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const role = await roleFromToken(req.cookies.get(SESSION_COOKIE)?.value);

  const needsAdmin = pathname.startsWith("/admin");
  const ok = needsAdmin ? role === "admin" : role === "member" || role === "admin";

  if (ok) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  // Protect the members area, the admin uploader, and the research API the
  // members-only company pages read from (those routes live outside /members,
  // so they need to be listed explicitly or they'd be publicly callable).
  matcher: ["/members/:path*", "/admin/:path*", "/api/research/:path*"],
};
