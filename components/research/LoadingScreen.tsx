"use client";

import { useEffect, useState } from "react";

const LINES = [
  "Reading 10-Ks so you don't have to",
  "Pulling every filing since 2009",
  "Adding up the quarters",
  "Cross-checking the balance sheet",
  "Finding what's growing and what's slowing",
  "Sharpening the pencils",
];

export default function LoadingScreen({ name }: { name: string }) {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % LINES.length), 2400);
    return () => clearInterval(t);
  }, []);

  return (
    <div
      style={{
        display: "flex",
        minHeight: "70vh",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 24px",
      }}
    >
      <div style={{ width: "100%", maxWidth: 400 }}>
        <p className="rsch-panel-label">Opening the books on</p>
        <p
          className="h-sub"
          style={{
            fontSize: 26,
            marginTop: 6,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {name}
        </p>
        <div
          style={{
            marginTop: 22,
            height: 4,
            width: "100%",
            overflow: "hidden",
            borderRadius: 999,
            background: "var(--card2)",
          }}
        >
          <div className="rsch-scan" />
        </div>
        <p
          key={idx}
          className="rsch-fade"
          style={{ marginTop: 16, fontSize: 14.5, color: "var(--muted)" }}
        >
          {LINES[idx]}&hellip;
        </p>
      </div>
    </div>
  );
}
