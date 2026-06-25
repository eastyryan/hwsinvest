"use client";

import { useState } from "react";

// Renders a firm's logo, falling back to its name in text if the image
// is missing or fails to load — so the wall never shows a broken image.
export default function FirmLogo({ name, logo }: { name: string; logo: string }) {
  const [errored, setErrored] = useState(false);

  if (errored) {
    return (
      <span
        className="serif"
        style={{ fontSize: 16, fontWeight: 500, color: "var(--text)", letterSpacing: "-0.01em", textAlign: "center" }}
      >
        {name}
      </span>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={logo}
        alt={`${name} logo`}
        onError={() => setErrored(true)}
        style={{
          height: 34,
          width: 34,
          objectFit: "contain",
          borderRadius: 7,
          flexShrink: 0,
        }}
      />
      <span style={{ fontSize: 14.5, fontWeight: 600, color: "var(--text)", whiteSpace: "nowrap" }}>
        {name}
      </span>
    </div>
  );
}
