export const usd = (n: number | undefined) =>
  n == null || Number.isNaN(n)
    ? "—"
    : n.toLocaleString("en-US", { style: "currency", currency: "USD" });

export const pct = (n: number | undefined) =>
  n == null || Number.isNaN(n) ? "—" : `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;

export const isUp = (n: number | undefined) => (n ?? 0) >= 0;

// Formatting for macroeconomic series so big figures read cleanly.
export type EconFmt = "pct" | "index" | "gdp" | "payrolls" | "sentiment";

export function formatEcon(v: number | undefined, fmt: EconFmt): string {
  if (v == null || Number.isNaN(v)) return "—";
  switch (fmt) {
    case "pct":
      return `${v.toFixed(2)}%`;
    case "gdp": // value is in billions of dollars
      return `$${(v / 1000).toFixed(1)}T`;
    case "payrolls": // value is in thousands of persons
      return `${(v / 1000).toFixed(1)}M`;
    case "index":
    case "sentiment":
    default:
      return v.toFixed(1);
  }
}

// Year-over-year change between two readings, returned as display text + sign.
// Percent-style series report a point change ("pp"); levels report % change.
export function yoyChange(
  latest: number,
  prior: number,
  fmt: EconFmt
): { text: string; up: boolean } {
  if (fmt === "pct") {
    const d = latest - prior;
    return { text: `${d >= 0 ? "+" : ""}${d.toFixed(2)} pp`, up: d >= 0 };
  }
  const d = ((latest - prior) / prior) * 100;
  return { text: `${d >= 0 ? "+" : ""}${d.toFixed(1)}%`, up: d >= 0 };
}

export const arrow = (n: number | undefined) => (isUp(n) ? "▲" : "▼");

// Human-readable file size, e.g. 1536 → "1.5 KB".
export function fileSize(bytes: number): string {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const n = bytes / Math.pow(1024, i);
  return `${i === 0 ? n : n.toFixed(1)} ${units[i]}`;
}

// Build a normalized SVG polyline ("x,y x,y …") from a handful of numbers,
// inverting y so larger values sit higher. Used for the index sparklines.
export function sparkline(values: number[], width = 100, height = 32): string {
  const nums = values.filter((v) => typeof v === "number" && !Number.isNaN(v));
  if (nums.length < 2) return "";
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const span = max - min || 1;
  const pad = 3;
  const usable = height - pad * 2;
  return nums
    .map((v, i) => {
      const x = (i / (nums.length - 1)) * width;
      const y = pad + (1 - (v - min) / span) * usable;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}
