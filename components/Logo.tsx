"use client";

import { useState } from "react";

// Renders the official HWS logo from /public/hws-logo.png. Until that file
// exists (or if it fails to load), it falls back to a self-contained brand
// mark so the header/footer never show a broken image.
export default function Logo({
  size = 34,
  src = "/hws-logo.png",
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

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{ display: "block", flexShrink: 0 }}
    >
      <rect width="100" height="100" rx="22" fill="#4B2E83" />
      <path
        d="M50 22 L74 33 V52 c0 23 -16 35 -24 41 c-8 -6 -24 -18 -24 -41 V33 Z"
        fill="#FFC72C"
      />
      <text
        x="50"
        y="68"
        fontFamily="Georgia, serif"
        fontSize="46"
        fontWeight="600"
        fill="#4B2E83"
        textAnchor="middle"
      >
        $
      </text>
    </svg>
  );
}
