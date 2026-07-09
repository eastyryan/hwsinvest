"use client";

import { useState } from "react";

export type Advisor = {
  name: string;
  initials: string;
  title: string;
  bio: string;
  img?: string;
};

// Portrait card whose bio panel covers the photo when expanded. Clicking the
// "+" grows a green circle out of the button until it fills the whole card;
// clicking the "×" retracts it smoothly back into the button.
export default function AdvisorCard({ advisor }: { advisor: Advisor }) {
  const [open, setOpen] = useState(false);

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

      {/* Green reveal — a circle centred on the toggle that scales to fill the
          card when open and retracts back into the button when closed. */}
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

      {/* Single persistent toggle — stays in the same spot, + rotates to × */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? `Hide ${advisor.name}'s bio` : `Show ${advisor.name}'s bio`}
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

      {/* Collapsed label — name + title (fades out as the green fills) */}
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
          boxShadow: "0 6px 20px -8px rgba(0,0,0,0.25)",
          opacity: open ? 0 : 1,
          transition: open ? "opacity 0.12s ease" : "opacity 0.25s ease 0.12s",
          pointerEvents: open ? "none" : "auto",
        }}
      >
        <p style={{ fontWeight: 700, fontSize: 15, color: "var(--text)", margin: 0, letterSpacing: "-0.01em" }}>
          {advisor.name}
        </p>
        <p
          style={{
            fontSize: 12.5,
            color: "var(--muted)",
            margin: "3px 0 0",
            lineHeight: 1.35,
            minHeight: 34,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {advisor.title}
        </p>
      </div>

      {/* Expanded content — full bio, fades in once the green has filled */}
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
          {advisor.name}
        </p>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.85)", margin: "4px 0 0", fontWeight: 600, paddingRight: 40 }}>
          {advisor.title}
        </p>
        <p style={{ fontSize: 14, lineHeight: 1.6, margin: "14px 0 0", color: "rgba(255,255,255,0.95)" }}>
          {advisor.bio}
        </p>
      </div>
    </div>
  );
}
