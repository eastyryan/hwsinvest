/**
 * Small numeric helpers for trading-comps distributions.
 * Empty / non-finite inputs yield null rather than NaN.
 */

/** Drop null/undefined/non-finite values, preserving order. */
export function filterFinite(nums: (number | null | undefined)[]): number[] {
  return nums.filter((n): n is number => typeof n === "number" && Number.isFinite(n));
}

/** Arithmetic mean of finite numbers, or null if empty. */
export function mean(nums: number[]): number | null {
  const xs = filterFinite(nums);
  if (xs.length === 0) return null;
  let sum = 0;
  for (const x of xs) sum += x;
  return sum / xs.length;
}

/**
 * Sample median. Even-length arrays average the two central values.
 * Returns null for an empty finite set.
 */
export function median(nums: number[]): number | null {
  const xs = filterFinite(nums).slice().sort((a, b) => a - b);
  const n = xs.length;
  if (n === 0) return null;
  const mid = Math.floor(n / 2);
  if (n % 2 === 1) return xs[mid];
  return (xs[mid - 1] + xs[mid]) / 2;
}

/**
 * Percentile with linear interpolation between ranks.
 * `p` is in [0, 100]. Empty input or non-finite p → null.
 *
 * Rank = (p/100) * (n − 1); value = lerp between floor/ceil neighbors.
 */
export function percentile(nums: number[], p: number): number | null {
  if (!Number.isFinite(p) || p < 0 || p > 100) return null;
  const xs = filterFinite(nums).slice().sort((a, b) => a - b);
  const n = xs.length;
  if (n === 0) return null;
  if (n === 1) return xs[0];
  const rank = (p / 100) * (n - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) return xs[lo];
  const w = rank - lo;
  return xs[lo] * (1 - w) + xs[hi] * w;
}
