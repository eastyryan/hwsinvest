"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Logo from "@/components/Logo";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/members";

  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error || "Login failed");
        setLoading(false);
        return;
      }
      router.push(next);
      router.refresh();
    } catch {
      setError("Network error — try again");
      setLoading(false);
    }
  }

  return (
    <main
      className="container-x"
      style={{
        minHeight: "calc(100vh - 68px)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "48px 0",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 380,
          background: "var(--card)",
          border: "1px solid var(--line)",
          borderRadius: 16,
          padding: "36px 30px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}>
          <Logo size={42} />
        </div>
        <h1
          style={{
            fontSize: 22,
            fontWeight: 700,
            textAlign: "center",
            color: "var(--text)",
            letterSpacing: "-0.02em",
            marginBottom: 6,
          }}
        >
          Members Login
        </h1>
        <p
          style={{
            fontSize: 14,
            color: "var(--muted)",
            textAlign: "center",
            marginBottom: 24,
          }}
        >
          Enter the club password to access member files.
        </p>

        <form onSubmit={submit}>
          <input
            type="password"
            value={password}
            autoFocus
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Club password"
            style={{
              width: "100%",
              padding: "12px 14px",
              fontSize: 15,
              borderRadius: 10,
              border: "1px solid var(--line)",
              background: "var(--card2)",
              color: "var(--text)",
              outline: "none",
            }}
          />
          {error && (
            <p style={{ color: "var(--down)", fontSize: 13.5, marginTop: 10 }}>{error}</p>
          )}
          <button
            type="submit"
            disabled={loading || !password}
            style={{
              width: "100%",
              marginTop: 16,
              padding: "12px 16px",
              fontSize: 15,
              fontWeight: 600,
              borderRadius: 10,
              border: "none",
              cursor: loading || !password ? "default" : "pointer",
              opacity: loading || !password ? 0.6 : 1,
              color: "#fbfaf9",
              background: "var(--brandSolid)",
            }}
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
