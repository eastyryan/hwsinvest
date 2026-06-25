export const usd = (n: number | undefined) =>
  n == null || Number.isNaN(n)
    ? "—"
    : n.toLocaleString("en-US", { style: "currency", currency: "USD" });

export const pct = (n: number | undefined) =>
  n == null || Number.isNaN(n) ? "—" : `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;

export const isUp = (n: number | undefined) => (n ?? 0) >= 0;

export const arrow = (n: number | undefined) => (isUp(n) ? "▲" : "▼");

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
