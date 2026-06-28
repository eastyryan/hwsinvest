"use client";

import { useState } from "react";

// Renders a firm's logo centered, with no card or caption — the logos float
// directly on the white Placements panel. Broken images are hidden entirely.
export default function FirmLogo({ name, logo }: { name: string; logo: string }) {
  const [errored, setErrored] = useState(false);
  if (errored) return null;

  return (
    <div
      style={{
        height: 64,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "8px 16px",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={logo}
        alt={name}
        onError={() => setErrored(true)}
        style={{ maxHeight: 56, maxWidth: "100%", width: "auto", objectFit: "contain" }}
      />
    </div>
  );
}
