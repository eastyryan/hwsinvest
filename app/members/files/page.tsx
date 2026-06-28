import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getSession } from "@/lib/auth";
import MemberFiles from "@/components/MemberFiles";

export const metadata = { title: "Files · HWS Investment Club" };

export default async function FilesPage() {
  const role = await getSession();

  return (
    <main className="container-x" style={{ padding: "clamp(28px,4vh,44px) 0 80px", maxWidth: 760, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, marginBottom: 22 }}>
        <Link href="/members" className="ctl"><ArrowLeft size={15} /> Dashboard</Link>
        {role === "admin" && <Link href="/admin" className="ctl">Manage files</Link>}
      </div>

      <p className="kicker">Members</p>
      <h1 className="h-page" style={{ fontSize: "clamp(28px,4vw,40px)" }}>Club Files</h1>
      <p className="lede" style={{ marginBottom: 30 }}>
        Research, models, pitch decks, and guides — preview in your browser or download.
      </p>

      <MemberFiles />
    </main>
  );
}
