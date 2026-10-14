"use client";

import { useState } from "react";

/**
 * Logo beside a company name. Served from this site so the image policy allows it.
 * The ticker initials live outside this component and stay visible if the image 404s.
 */
export default function CompanyLogo({
  ticker,
  website,
  size = 28,
}: {
  ticker: string;
  website?: string | null;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  const symbol = ticker.trim();
  if (!symbol || failed) return null;

  const query = website?.trim()
    ? `?website=${encodeURIComponent(website.trim())}`
    : "";

  return (
    // eslint-disable-next-line @next/next/no-img-element -- same-origin proxy, hidden when the file 404s
    <img
      src={`/api/research/logo/${encodeURIComponent(symbol)}${query}`}
      alt=""
      width={size}
      height={size}
      decoding="async"
      className="shrink-0 rounded-md bg-white object-contain ring-1 ring-zinc-200 dark:ring-zinc-700"
      style={{ width: size, height: size }}
      onError={() => setFailed(true)}
    />
  );
}
