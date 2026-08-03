"use client";

import { useState } from "react";

// Renders the official HWS shield logo from /public/hws-shield.png — the Hobart
// DISCE shield alongside the William Smith lamp shield. If that file ever fails
// to load, it falls back to a self-contained brand mark so the header/footer
// never show a broken image.
export default function Logo({
  size = 34,
  src = "/hws-shield.png",
}: {
  size?: number;
  src?: string;
}) {
  const [errored, setErrored] = useState(false);

  if (!errored) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt="Hobart and William Smith Colleges"
        style={{ height: size, width: "auto", display: "block", flexShrink: 0 }}
        onError={() => setErrored(true)}
      />
    );
  }

  // Two shields side by side, matching the real mark's ~1.95:1 aspect so a
  // fallback never reflows the layout around it.
  return (
    <svg
      height={size}
      viewBox="0 0 196 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Hobart and William Smith Colleges"
      style={{ display: "block", flexShrink: 0, width: "auto" }}
    >
      {/* Hobart — purple shield with orange quarters */}
      <path
        d="M2 7 Q44 0 86 7 V40 Q86 76 44 98 Q2 76 2 40 Z"
        fill="#542785"
      />
      <path d="M2 7 Q16 3 30 4 V30 H2 Z" fill="#F36F21" />
      <path d="M58 4 Q72 3 86 7 V30 H58 Z" fill="#F36F21" />
      <rect x="30" y="34" width="28" height="22" rx="2" fill="#FFFFFF" />

      {/* William Smith — green shield with the lamp of learning */}
      <path
        d="M110 7 Q152 0 194 7 V40 Q194 76 152 98 Q110 76 110 40 Z"
        fill="#0F6B37"
      />
      <ellipse cx="152" cy="58" rx="17" ry="6" fill="#B0C1AD" />
      <path d="M144 58 Q152 40 160 58 Z" fill="#B0C1AD" />
      <rect x="149" y="30" width="6" height="12" rx="3" fill="#B0C1AD" />
    </svg>
  );
}
