import Link from "next/link";
import { getSession } from "@/lib/auth";
import MemberFiles from "@/components/MemberFiles";

export const metadata = { title: "Members · HWS Investment Club" };

export default async function MembersPage() {
  // Middleware already gated this route; read the role for the admin link.
  const role = await getSession();

  return (
    <main className="container-x" style={{ padding: "48px 0 80px", maxWidth: 760, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16, marginBottom: 8 }}>
        <h1 style={{ fontSize: 30, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.02em" }}>
          Member Files
        </h1>
        {role === "admin" && (
          <Link href="/admin" style={{ fontSize: 13.5, fontWeight: 600, color: "var(--brand)" }}>
            Manage files →
          </Link>
        )}
      </div>
      <p style={{ fontSize: 15, color: "var(--muted)", marginBottom: 30 }}>
        Research, pitch decks, and club documents — for members only.
      </p>

      <MemberFiles />
    </main>
  );
}
