"use client";

import { useState } from "react";
import type { Member } from "@/data/board";

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function LinkedInButton({ href, dark }: { href?: string; dark?: boolean }) {
  return (
    <a
      href={href || "#"}
      target={href ? "_blank" : undefined}
      rel="noopener noreferrer"
      aria-label="LinkedIn profile"
      onClick={(e) => e.stopPropagation()}
      style={{
        flexShrink: 0,
        width: 30,
        height: 30,
        borderRadius: 8,
        background: dark ? "#fff" : "var(--text)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill={dark ? "var(--wsGreen)" : "var(--bg)"}>
        <path d="M4.98 3.5C4.98 4.88 3.87 6 2.5 6S0 4.88 0 3.5 1.12 1 2.5 1s2.48 1.12 2.48 2.5zM.22 8.06h4.56V24H.22V8.06zM8.34 8.06h4.37v2.18h.06c.61-1.16 2.1-2.38 4.32-2.38 4.62 0 5.47 3.04 5.47 6.99V24h-4.56v-7.05c0-1.68-.03-3.84-2.34-3.84-2.34 0-2.7 1.83-2.7 3.72V24H8.34V8.06z" />
      </svg>
    </a>
  );
}

// Portrait card for a board member. Mirrors AdvisorCard: clicking "+" grows a
// green circle out of the button until it fills the card, revealing the bio;
// clicking "×" retracts it smoothly back into the button.
export default function MemberCard({ member }: { member: Member }) {
  const [open, setOpen] = useState(false);
  const hasBio = Boolean(member.bio);

  return (
    <div
      style={{
        position: "relative",
        borderRadius: 16,
        overflow: "hidden",
        aspectRatio: "4 / 5",
        background: "var(--card2)",
      }}
    >
      {member.img ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={member.img}
          alt={member.name}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      ) : (
        <div
          style={{
            width: "100%",
            height: "100%",
            background: "var(--wsGreen)",
            color: "#fff",
            fontSize: "clamp(44px,7vw,64px)",
            fontWeight: 700,
            letterSpacing: "-0.02em",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {initials(member.name)}
        </div>
      )}

      {/* Green reveal circle */}
      {hasBio && (
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: 9,
            right: 9,
            width: 40,
            height: 40,
            borderRadius: "50%",
            background: "var(--wsGreen)",
            transformOrigin: "center",
            transform: open ? "scale(42)" : "scale(0)",
            transition: "transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
            zIndex: 2,
            pointerEvents: "none",
          }}
        />
      )}

      {/* Toggle */}
      {hasBio && (
        <button
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={open ? `Hide ${member.name}'s bio` : `Show ${member.name}'s bio`}
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            zIndex: 4,
            width: 34,
            height: 34,
            borderRadius: 9,
            background: open ? "rgba(255,255,255,0.2)" : "var(--wsGreen)",
            color: "#fff",
            border: "none",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 22,
            lineHeight: 1,
            transform: open ? "rotate(45deg)" : "none",
            transition: "transform 0.18s ease, background 0.18s ease",
            boxShadow: open ? "none" : "0 4px 14px -4px rgba(0,0,0,0.35)",
          }}
        >
          +
        </button>
      )}

      {/* Collapsed label — name + role + LinkedIn */}
      <div
        style={{
          position: "absolute",
          left: 12,
          right: 12,
          bottom: 12,
          zIndex: 1,
          background: "var(--card)",
          border: "1px solid var(--line)",
          borderRadius: 12,
          padding: "12px 14px",
          display: "flex",
          alignItems: "center",
          gap: 10,
          boxShadow: "0 6px 20px -8px rgba(0,0,0,0.25)",
          opacity: open ? 0 : 1,
          transition: open ? "opacity 0.12s ease" : "opacity 0.25s ease 0.12s",
          pointerEvents: open ? "none" : "auto",
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontWeight: 700, fontSize: 15, color: "var(--text)", margin: 0, letterSpacing: "-0.01em" }}>
            {member.name}
          </p>
          <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "2px 0 0" }}>{member.role}</p>
        </div>
        <LinkedInButton href={member.linkedin || undefined} />
      </div>

      {/* Expanded content — bio */}
      {hasBio && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 3,
            color: "#fff",
            padding: "clamp(18px,4vw,26px)",
            display: "flex",
            flexDirection: "column",
            overflowY: "auto",
            opacity: open ? 1 : 0,
            transition: open ? "opacity 0.25s ease 0.2s" : "opacity 0.12s ease",
            pointerEvents: open ? "auto" : "none",
          }}
        >
          <p style={{ fontWeight: 700, fontSize: 19, margin: "2px 0 0", letterSpacing: "-0.01em", paddingRight: 40 }}>
            {member.name}
          </p>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.85)", margin: "4px 0 0", fontWeight: 600, paddingRight: 40 }}>
            {member.role} · {member.year}
            {member.focus ? ` · ${member.focus}` : ""}
          </p>
          <p style={{ fontSize: 14, lineHeight: 1.6, margin: "14px 0 0", color: "rgba(255,255,255,0.95)" }}>
            {member.bio}
          </p>
          {member.linkedin ? (
            <div style={{ marginTop: 16 }}>
              <LinkedInButton href={member.linkedin} dark />
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
