"use client";

import { useState } from "react";

export type Advisor = {
  name: string;
  initials: string;
  title: string;
  bio: string;
  img?: string;
};

// Personal card (like the board cards on About) that expands via a plus
// button to reveal the advisor's bio.
export default function AdvisorCard({ advisor }: { advisor: Advisor }) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div
        style={{
          position: "relative",
          borderRadius: 16,
          overflow: "hidden",
          aspectRatio: "4 / 5",
          background: "var(--card2)",
        }}
      >
        {advisor.img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={advisor.img}
            alt={advisor.name}
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
            {advisor.initials}
          </div>
        )}

        {/* Floating label with name/title and a plus toggle */}
        <div
          style={{
            position: "absolute",
            left: 12,
            right: 12,
            bottom: 12,
            background: "var(--card)",
            border: "1px solid var(--line)",
            borderRadius: 12,
            padding: "12px 14px",
            display: "flex",
            alignItems: "center",
            gap: 10,
            boxShadow: "0 6px 20px -8px rgba(0,0,0,0.25)",
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontWeight: 700, fontSize: 15, color: "var(--text)", margin: 0, letterSpacing: "-0.01em" }}>
              {advisor.name}
            </p>
            <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "2px 0 0" }}>
              {advisor.title}
            </p>
          </div>
          <button
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={open ? `Hide ${advisor.name}'s bio` : `Show ${advisor.name}'s bio`}
            style={{
              flexShrink: 0,
              width: 32,
              height: 32,
              borderRadius: 9,
              background: "var(--wsGreen)",
              color: "#fff",
              border: "none",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 20,
              lineHeight: 1,
              transition: "transform 0.18s ease",
              transform: open ? "rotate(45deg)" : "none",
            }}
          >
            +
          </button>
        </div>
      </div>

      {open && (
        <div
          className="card"
          style={{ marginTop: 12, padding: "16px 18px", borderRadius: 12 }}
        >
          <p style={{ color: "var(--muted)", fontSize: 14.5, lineHeight: 1.65, margin: 0 }}>
            {advisor.bio}
          </p>
        </div>
      )}
    </div>
  );
}
