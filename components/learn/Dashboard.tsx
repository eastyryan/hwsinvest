"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Flame, Star, Award, Folder, ArrowRight } from "lucide-react";
import { TRACKS } from "@/data/learn";
import { TRACK_ICON } from "./icons";
import { loadProgress, trackCompletion, level, type Progress } from "@/lib/progress";

export default function Dashboard({ admin }: { admin: boolean }) {
  const [p, setP] = useState<Progress | null>(null);
  useEffect(() => setP(loadProgress()), []);

  const xp = p?.xp ?? 0;
  const streak = p?.streak ?? 0;
  const lvl = level(xp);
  const xpInLevel = xp % 100;

  return (
    <main className="container-x" style={{ padding: "clamp(32px,5vh,56px) 0 80px", maxWidth: 960, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
        <div>
          <p className="kicker">Members</p>
          <h1 className="h-page" style={{ fontSize: "clamp(30px,4vw,44px)" }}>Dashboard</h1>
          <p className="lede" style={{ maxWidth: "44ch" }}>
            Sharpen the fundamentals, then dive into the club&apos;s research, models, and guides.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          {admin && <Link href="/admin" className="ctl">Manage files</Link>}
          <LogoutButton />
        </div>
      </div>

      {/* Stat band — echoes the home page: orange tabular numerals, purple dividers */}
      <div className="card" style={{ marginTop: "clamp(28px,4vh,40px)", overflow: "hidden" }}>
        <div className="learn-stat-grid">
          <Stat icon={<Flame size={18} strokeWidth={2.2} />} label="Day streak" value={streak} />
          <Stat icon={<Star size={18} strokeWidth={2.2} />} label="Total XP" value={xp} />
          <Stat icon={<Award size={18} strokeWidth={2.2} />} label="Level" value={lvl} />
        </div>
        <div style={{ height: 6, background: "var(--card2)" }}>
          <div style={{ width: `${xpInLevel}%`, height: "100%", background: "var(--brandSolid)", transition: "width .4s" }} />
        </div>
      </div>
      <p style={{ fontSize: 12.5, color: "var(--faint)", margin: "8px 2px 0" }}>
        {100 - xpInLevel} XP to level {lvl + 1}
      </p>

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
      <p className="kicker" style={{ color: "var(--faint)", letterSpacing: "0.08em", textTransform: "uppercase", fontSize: 12.5 }}>
        Learning Tracks
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(252px, 1fr))", gap: 16, marginTop: 16 }}>
        {TRACKS.map((t) => {
          const Icon = TRACK_ICON[t.id];
          const ids = t.lessons.map((l) => l.id);
          const { done, total } = p ? trackCompletion(p, t.id, ids) : { done: 0, total: ids.length };
          const pct = total ? Math.round((done / total) * 100) : 0;
          const finished = done === total && total > 0;
          return (
            <Link key={t.id} href={`/members/learn/${t.id}`} className="card lift card-hover-brand" style={{ display: "flex", flexDirection: "column", gap: 12, padding: 20, textDecoration: "none" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                <span style={iconBadge}>{Icon && <Icon size={20} strokeWidth={1.9} />}</span>
                <Ring pct={pct} done={finished} />
              </div>
              <div className="h-sub" style={{ fontSize: 17.5 }}>{t.title}</div>
              <p style={{ fontSize: 13.5, color: "var(--muted)", lineHeight: 1.5, margin: 0, flex: 1 }}>{t.blurb}</p>
              <div style={{ fontSize: 12.5, color: finished ? "var(--orangeText)" : "var(--faint)", fontWeight: finished ? 700 : 500 }}>
                {finished ? "Completed" : `${done} / ${total} lessons`}
              </div>
            </Link>
          );
        })}
      </div>
    </main>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="learn-stat-item" style={{ display: "flex", alignItems: "center", gap: 14, padding: "20px 24px" }}>
      <span style={{ color: "var(--brand)", display: "inline-flex" }}>{icon}</span>
      <div>
        <div className="mono nums" style={{ fontSize: 30, fontWeight: 800, color: "var(--orange)", lineHeight: 1, letterSpacing: "-0.02em" }}>
          {value}
        </div>
        <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 6, fontWeight: 600 }}>{label}</div>
      </div>
    </div>
  );
}

function Ring({ pct, done }: { pct: number; done: boolean }) {
  const r = 12;
  const c = 2 * Math.PI * r;
  const color = done ? "var(--orange)" : "var(--brandSolid)";
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
