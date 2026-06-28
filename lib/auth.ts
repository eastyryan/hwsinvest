// Lightweight session auth for the members area.
//
// Today: a single shared club password (CLUB_PASSWORD) grants the "member"
// role, and ADMIN_PASSWORD grants "admin" (which also implies member access).
// Sessions are a signed cookie — no database — so this stays trivial to run.
//
// Later: when HWS student-email / SSO login is ready, only this file and the
// /login route need to change. Everything downstream just reads the role off
// the cookie via getSession(), so the file-access + upload features carry over
// unchanged.

import { cookies } from "next/headers";

export type Role = "member" | "admin";

export const SESSION_COOKIE = "hws_session";
const MAX_AGE_SEC = 60 * 60 * 24 * 14; // 14 days

const enc = new TextEncoder();

function secret(): string {
  // Falls back to a constant only so local dev without config doesn't crash;
  // production MUST set SESSION_SECRET (see .env.example).
  return process.env.SESSION_SECRET ?? "dev-insecure-secret-change-me";
}

function b64url(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlStr(str: string): string {
  return b64url(enc.encode(str));
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

// timing-safe-ish string compare
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

// Build a signed token: `<payload>.<sig>` where payload = b64url("role.exp").
export async function createToken(role: Role): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE_SEC;
  const payload = b64urlStr(`${role}.${exp}`);
  const sig = await hmac(payload);
  return `${payload}.${sig}`;
}

export async function verifyToken(token: string | undefined): Promise<Role | null> {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = await hmac(payload);
  if (!safeEqual(sig, expected)) return null;
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

// Check a submitted password against configured club/admin passwords.
// Returns the granted role, or null if it matches neither.
export function roleForPassword(password: string): Role | null {
  const admin = process.env.ADMIN_PASSWORD;
  const club = process.env.CLUB_PASSWORD;
  if (admin && password === admin) return "admin";
  if (club && password === club) return "member";
  return null;
}

// Server-component / route helper: read the current session role from cookies.
export async function getSession(): Promise<Role | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  return verifyToken(token);
}

export function hasMemberAccess(role: Role | null): boolean {
  return role === "member" || role === "admin";
}
