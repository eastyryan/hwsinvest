"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Check, Lock } from "lucide-react";
import type { Track } from "@/data/learn";
import { TRACK_ICON } from "./icons";
import { loadProgress, isComplete, isUnlocked, type Progress } from "@/lib/progress";

export default function TrackView({ track }: { track: Track }) {
  const [p, setP] = useState<Progress | null>(null);
  useEffect(() => setP(loadProgress()), []);

  const Icon = TRACK_ICON[track.id];
  const lessonIds = track.lessons.map((l) => l.id);

  return (
    <main className="container-x" style={{ padding: "clamp(28px,4vh,44px) 0 80px", maxWidth: 660, margin: "0 auto" }}>
      <Link href="/members" className="ctl" style={{ marginBottom: 26 }}>
        <ArrowLeft size={15} /> Dashboard
      </Link>

      <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 22 }}>
        <span style={iconBadge}>{Icon && <Icon size={26} strokeWidth={1.8} />}</span>
        <div>
          <p className="kicker">Learning Track</p>
          <h1 className="h-sub" style={{ fontSize: "clamp(24px,3.5vw,32px)" }}>{track.title}</h1>
        </div>
      </div>
      <p className="lede" style={{ marginTop: 14 }}>{track.blurb}</p>
      <p style={{ fontSize: 12.5, color: "var(--faint)", marginTop: 8, marginBottom: 30 }}>
        Based on the club&apos;s {track.source} material.
      </p>

      <div>
        {track.lessons.map((lesson, i) => {
          const done = p ? isComplete(p, track.id, lesson.id) : false;
          const unlocked = p ? isUnlocked(p, track.id, lessonIds, i) : i === 0;
          const best = p?.best[`${track.id}/${lesson.id}`];

          const inner = (
            <div
              className={unlocked ? "card lift card-hover-brand" : "card"}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 15,
                padding: "17px 18px",
                borderColor: done ? "var(--brand)" : undefined,
                opacity: unlocked ? 1 : 0.6,
              }}
            >
              <div style={{ ...node, ...(done ? { background: "var(--brandSolid)", color: "#fff", border: "none" } : {}) }}>
                {done ? <Check size={18} strokeWidth={2.5} /> : unlocked ? i + 1 : <Lock size={15} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15.5, fontWeight: 600, color: "var(--text)" }}>{lesson.title}</div>
                <div style={{ fontSize: 12.5, color: "var(--faint)", marginTop: 3 }}>
                  {lesson.questions.length} questions
                  {best != null ? ` · best ${best}%` : ""}
                  {!unlocked ? " · locked" : ""}
                </div>
              </div>
              {unlocked && (
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--brand)", whiteSpace: "nowrap" }}>
                  {done ? "Review" : "Start"}
                </span>
              )}
            </div>
          );

          return (
            <div key={lesson.id}>
              {i > 0 && <div style={{ height: 16, width: 2, background: "var(--line)", marginLeft: 36 }} />}
              {unlocked ? (
                <Link href={`/members/learn/${track.id}/${lesson.id}`} style={{ textDecoration: "none" }}>
                  {inner}
                </Link>
              ) : (
                inner
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}

const iconBadge: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 54,
  height: 54,
  borderRadius: 14,
  background: "var(--card2)",
  border: "1px solid var(--line)",
  color: "var(--brand)",
  flexShrink: 0,
};
const node: React.CSSProperties = {
  width: 40,
  height: 40,
  borderRadius: 99,
  flexShrink: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 16,
  fontWeight: 800,
  color: "var(--muted)",
  background: "var(--card2)",
  border: "1px solid var(--line)",
};
