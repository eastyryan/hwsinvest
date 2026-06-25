"use client";

import { useState } from "react";

export type Career = {
  title: string;
  blurb: string;
  detail: string;
  skills: string;
  timeline: string;
};

export default function CareerList({ careers }: { careers: Career[] }) {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <div
      className="card"
      style={{ borderRadius: 14, overflow: "hidden", padding: 0 }}
    >
      {careers.map((c, i) => {
        const isOpen = open === i;
        return (
          <div
            key={c.title}
            style={{
              borderTop: i === 0 ? "none" : "1px solid var(--lineSoft)",
            }}
          >
            <button
              onClick={() => setOpen(isOpen ? null : i)}
              aria-expanded={isOpen}
              className="row-hover"
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 16,
                padding: "18px clamp(18px,3vw,26px)",
                background: "transparent",
                border: "none",
                borderTop: i === 0 ? "none" : "1px solid var(--lineSoft)",
                cursor: "pointer",
                textAlign: "left",
                color: "var(--text)",
                transition: "background 0.15s",
              }}
            >
              <span
                style={{
                  flex: 1,
                  fontSize: "clamp(16px,2vw,18px)",
                  fontWeight: 600,
                  letterSpacing: "-0.01em",
                }}
              >
                {c.title}
              </span>
              <span
                style={{
                  color: "var(--muted)",
                  fontSize: 13,
                  display: "none",
                }}
                className="career-blurb"
              >
                {c.blurb}
              </span>
              <span
                aria-hidden
                style={{
                  color: "var(--orange)",
                  fontSize: 20,
                  lineHeight: 1,
                  transform: isOpen ? "rotate(45deg)" : "none",
                  transition: "transform 0.18s ease",
                  flexShrink: 0,
                }}
              >
                +
              </span>
            </button>

            {isOpen && (
              <div
                style={{
                  padding: "0 clamp(18px,3vw,26px) 22px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                <p
                  style={{
                    color: "var(--muted)",
                    fontSize: 14.5,
                    lineHeight: 1.6,
                    margin: 0,
                    maxWidth: "70ch",
                  }}
                >
                  {c.detail}
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 28px" }}>
                  <p style={{ fontSize: 13, color: "var(--faint)", margin: 0, lineHeight: 1.5 }}>
                    <span style={{ color: "var(--orangeText)", fontWeight: 600 }}>
                      Skills ·{" "}
                    </span>
                    {c.skills}
                  </p>
                  <p style={{ fontSize: 13, color: "var(--faint)", margin: 0, lineHeight: 1.5 }}>
                    <span style={{ color: "var(--orangeText)", fontWeight: 600 }}>
                      Timeline ·{" "}
                    </span>
                    {c.timeline}
                  </p>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
