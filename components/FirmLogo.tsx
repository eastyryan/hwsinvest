"use client";

import { useState } from "react";

// Renders a firm's logo above its name. Wordmark logos already contain the
// company name, so their text caption is hidden. Falls back to the name in
// text if the image is missing or fails to load.
export default function FirmLogo({
  name,
  logo,
  wordmark = false,
}: {
  name: string;
  logo: string;
  wordmark?: boolean;
}) {
  const [errored, setErrored] = useState(false);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 14,
        textAlign: "center",
        padding: "12px 8px",
      }}
    >
      <div
        style={{
          height: 56,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {errored ? (
          <span style={{ fontSize: 18, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.02em" }}>
            {name}
          </span>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logo}
            alt={`${name} logo`}
            onError={() => setErrored(true)}
            style={{
              maxHeight: wordmark ? 30 : 56,
              maxWidth: "100%",
              width: "auto",
              objectFit: "contain",
            }}
          />
        )}
      </div>
      {!wordmark && !errored && (
        <span style={{ fontSize: 15, fontWeight: 600, color: "var(--text)", whiteSpace: "nowrap" }}>
          {name}
        </span>
      )}
    </div>
  );
}
