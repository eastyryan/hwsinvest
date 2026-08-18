"use client";

import { formatAsOf, freshnessLabel, type DataFreshness } from "@/lib/research/as-of";

/** Compact “as of” line for panels. Falls back gracefully if lib missing fields. */
export default function DataAsOf({
  items,
  className = "",
}: {
  items: DataFreshness[];
  className?: string;
}) {
  if (!items.length) return null;
  const text = freshnessLabel(items);
  if (!text) return null;
  return (
    <p
      className={`text-[10px] font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500 ${className}`}
    >
      {text}
    </p>
  );
}
