/**
 * Human-readable "as of" timestamps for filings, prices, and other free data.
 */

export type DataFreshness = {
  label: string;
  at: number | null;
  source?: string;
};

/**
 * Format a millisecond epoch as a short calendar date (en-US).
 * Null / invalid → "—".
 */
export function formatAsOf(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms)) return "—";
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Current wall-clock as an as-of date string. */
export function asOfNow(): string {
  return formatAsOf(Date.now());
}

/**
 * One freshness part: `"Filings as of Aug 10, 2026"`.
 * Pass an array to join with middle dots: `"Filings as of … · Prices as of …"`.
 */
export function freshnessLabel(f: DataFreshness | DataFreshness[]): string {
  const parts = Array.isArray(f) ? f : [f];
  return parts
    .map((part) => {
      const when = formatAsOf(part.at);
      const base = `${part.label} as of ${when}`;
      if (part.source && part.source.trim()) {
        return `${base} (${part.source.trim()})`;
      }
      return base;
    })
    .join(" · ");
}
