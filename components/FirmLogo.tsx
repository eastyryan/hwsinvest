"use client";

import { useState } from "react";

// Renders a firm's logo centered on a uniform white tile (no caption). The
// white background keeps dark wordmarks legible in both light and dark themes
// and unifies logos that ship with their own background. Broken images are
// hidden entirely rather than showing a blank tile.
export default function FirmLogo({ name, logo }: { name: string; logo: string }) {
  const [errored, setErrored] = useState(false);
  if (errored) return null;

  return (
    <div
      className="firm-tile"
      style={{
        background: "#ffffff",
        border: "1px solid var(--line)",
        borderRadius: 12,
        height: 96,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "18px 24px",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={logo}
        alt={name}
        onError={() => setErrored(true)}
        style={{ maxHeight: 44, maxWidth: "100%", width: "auto", objectFit: "contain" }}
      />
    </div>
  );
}
