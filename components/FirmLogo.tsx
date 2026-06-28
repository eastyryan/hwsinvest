"use client";

import { useState } from "react";

// Renders a firm's logo centered in a fixed-size box so every mark reads at a
// consistent visual size — no cards, no captions. Broken images are hidden.
export default function FirmLogo({ name, logo }: { name: string; logo: string }) {
  const [errored, setErrored] = useState(false);
  if (errored) return null;

  return (
    <div
      style={{
        height: 104,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 12px",
      }}
    >
      {/* Height-priority sizing: now that each logo is trimmed to its mark,
          capping height makes them read at a consistent visual size. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={logo}
        alt={name}
        onError={() => setErrored(true)}
        style={{ maxHeight: 64, maxWidth: "100%", width: "auto", objectFit: "contain" }}
      />
    </div>
  );
}
