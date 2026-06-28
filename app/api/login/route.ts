import { NextResponse } from "next/server";
import { createToken, roleForPassword, SESSION_COOKIE } from "@/lib/auth";

// POST /api/login  { password }  → sets the session cookie on success.
export async function POST(request: Request) {
  let password = "";
  try {
    const body = await request.json();
    password = typeof body?.password === "string" ? body.password : "";
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const role = roleForPassword(password);
  if (!role) {
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }

  const token = await createToken(role);
  const res = NextResponse.json({ ok: true, role });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });
  return res;
}
