import Link from "next/link";
import MemberFiles from "@/components/MemberFiles";

export const metadata = { title: "Admin · HWS Investment Club" };

export default function AdminPage() {
  // Middleware restricts this route to the admin role.
  return (
    <main className="container-x" style={{ padding: "48px 0 80px", maxWidth: 760, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16, marginBottom: 8 }}>
        <h1 style={{ fontSize: 30, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.02em" }}>
          Manage Files
        </h1>
        <Link href="/members" style={{ fontSize: 13.5, fontWeight: 600, color: "var(--brand)" }}>
          ← Member view
        </Link>
      </div>
      <p style={{ fontSize: 15, color: "var(--muted)", marginBottom: 30 }}>
        Upload or remove files. Everything here appears on the members page.
      </p>

      <MemberFiles admin />
    </main>
  );
}
