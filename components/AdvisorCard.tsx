"use client";

import { useState } from "react";

export type Advisor = {
  name: string;
  initials: string;
  title: string;
  bio: string;
  img?: string;
};

// Portrait card whose info panel slides up over the photo to reveal the
// advisor's full bio when the plus button is pressed.
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

      {/* Collapsed floating label */}
      {!open && (
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
            <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "2px 0 0" }}>{advisor.title}</p>
          </div>
          <button
            onClick={() => setOpen(true)}
            aria-expanded={false}
            aria-label={`Show ${advisor.name}'s bio`}
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
            }}
          >
            +
          </button>
        </div>
      )}

      {/* Expanded overlay covering the photo */}
      {open && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "var(--wsGreen)",
            color: "#fff",
            padding: "clamp(18px,4vw,26px)",
            display: "flex",
            flexDirection: "column",
            overflowY: "auto",
          }}
        >
          <button
            onClick={() => setOpen(false)}
            aria-label={`Hide ${advisor.name}'s bio`}
            style={{
              position: "absolute",
              top: 14,
              right: 14,
              width: 32,
              height: 32,
              borderRadius: 9,
              background: "rgba(255,255,255,0.18)",
              color: "#fff",
              border: "none",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 20,
              lineHeight: 1,
              transform: "rotate(45deg)",
            }}
          >
            +
          </button>

          <p style={{ fontWeight: 700, fontSize: 19, margin: "4px 0 0", letterSpacing: "-0.01em", paddingRight: 36 }}>
            {advisor.name}
          </p>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.85)", margin: "4px 0 0", fontWeight: 600 }}>
            {advisor.title}
          </p>
          <p style={{ fontSize: 14, lineHeight: 1.6, margin: "14px 0 0", color: "rgba(255,255,255,0.95)" }}>
            {advisor.bio}
          </p>
        </div>
      )}
    </div>
  );
}
