"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Folder, ArrowRight } from "lucide-react";
import { TRACKS } from "@/data/learn";
import { TRACK_ICON } from "./icons";
import { loadProgress, trackCompletion, type Progress } from "@/lib/progress";

export default function Dashboard({ admin }: { admin: boolean }) {
  const [p, setP] = useState<Progress | null>(null);
  useEffect(() => setP(loadProgress()), []);

  return (
    <main className="container-x" style={{ padding: "clamp(32px,5vh,56px) 0 80px", maxWidth: 960, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
        <div>
          <p className="kicker">Members</p>
          <h1 className="h-page" style={{ fontSize: "clamp(30px,4vw,44px)" }}>Dashboard</h1>
          <p className="lede" style={{ maxWidth: "46ch" }}>
            Study the fundamentals at your own pace, then dive into the club&apos;s research, models, and guides.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          {admin && <Link href="/admin" className="ctl">Manage files</Link>}
          <LogoutButton />
        </div>
      </div>

      {/* Files */}
      <Link href="/members/files" className="card lift card-hover-brand" style={{ display: "flex", alignItems: "center", gap: 18, padding: 20, margin: "clamp(28px,4vh,40px) 0 36px", textDecoration: "none" }}>
        <span style={iconBadge}><Folder size={20} strokeWidth={1.9} /></span>
        <div style={{ flex: 1 }}>
          <div className="h-sub" style={{ fontSize: 18 }}>Club Files</div>
          <p style={{ fontSize: 14, color: "var(--muted)", margin: "4px 0 0", lineHeight: 1.5 }}>
            Browse, preview, and download every document — models, decks, guides, and recaps.
          </p>
        </div>
        <ArrowRight size={20} color="var(--brand)" />
      </Link>

      {/* Tracks */}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 16 }}>
        <p className="kicker" style={{ color: "var(--faint)", letterSpacing: "0.08em", textTransform: "uppercase", fontSize: 12.5 }}>
          Study Tracks
        </p>
        <span style={{ fontSize: 12.5, color: "var(--faint)" }}>
          Free practice — review any lesson, any order
        </span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(252px, 1fr))", gap: 16 }}>
        {TRACKS.map((t) => {
          const Icon = TRACK_ICON[t.id];
          const ids = t.lessons.map((l) => l.id);
          const { done, total } = p ? trackCompletion(p, t.id, ids) : { done: 0, total: ids.length };
          const finished = done === total && total > 0;
          return (
            <Link key={t.id} href={`/members/learn/${t.id}`} className="card lift card-hover-brand" style={{ display: "flex", flexDirection: "column", gap: 12, padding: 20, textDecoration: "none" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                <span style={iconBadge}>{Icon && <Icon size={20} strokeWidth={1.9} />}</span>
                {done > 0 && <Ring done={done} total={total} finished={finished} />}
              </div>
              <div className="h-sub" style={{ fontSize: 17.5 }}>{t.title}</div>
              <p style={{ fontSize: 13.5, color: "var(--muted)", lineHeight: 1.5, margin: 0, flex: 1 }}>{t.blurb}</p>
              <div style={{ fontSize: 12.5, color: finished ? "var(--brand)" : "var(--faint)", fontWeight: finished ? 700 : 500 }}>
                {finished ? "All lessons reviewed" : `${total} lesson${total === 1 ? "" : "s"}${done > 0 ? ` · ${done} reviewed` : ""}`}
              </div>
            </Link>
          );
        })}
      </div>
    </main>
  );
}

function Ring({ done, total, finished }: { done: number; total: number; finished: boolean }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  const r = 12;
  const c = 2 * Math.PI * r;
  const color = finished ? "var(--brand)" : "var(--brandSolid)";
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden>
      <circle cx="16" cy="16" r={r} fill="none" stroke="var(--line)" strokeWidth="3.5" />
      <circle cx="16" cy="16" r={r} fill="none" stroke={color} strokeWidth="3.5" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} transform="rotate(-90 16 16)" style={{ transition: "stroke-dashoffset .4s" }} />
    </svg>
  );
}

function LogoutButton() {
  return (
    <button
      onClick={async () => {
        await fetch("/api/logout", { method: "POST" });
        window.location.href = "/login";
      }}
      className="ctl"
    >
      Sign out
    </button>
  );
}

const iconBadge: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 42,
  height: 42,
  borderRadius: 11,
  background: "var(--card2)",
  border: "1px solid var(--line)",
  color: "var(--brand)",
  flexShrink: 0,
};
