/**
 * Football-field valuation synthesis.
 *
 * IB-style triangulation chart data: each method is a low/mid/high bar,
 * plotted on a shared axis with the current share price for context.
 * Inspired by standard pitch-book practice (DCF, comps, precedents, LBO,
 * trading range) — pure data assembly, no rendering.
 */

import { filterFinite, mean } from "@/lib/research/valuation/stats";

/** Where a bar’s numbers come from — honesty label for the chart. */
export type FootballProvenance =
  | "filing"
  | "market"
  | "model"
  | "illustrative";

export type FootballBar = {
  id: string;
  label: string;
  /** per-share or equity — document unit in `unit` */
  low: number | null;
  mid: number | null;
  high: number | null;
  unit: "perShare" | "equity" | "enterprise";
  /** Optional source method note */
  note?: string;
  /** Whether to show on chart */
  enabled?: boolean;
  /** Honesty label: filing / market / model / illustrative */
  provenance?: FootballProvenance;
};

/** Short display label for a provenance tag. */
export function provenanceLabel(p: FootballProvenance): string {
  switch (p) {
    case "filing":
      return "filing";
    case "market":
      return "market";
    case "model":
      return "model";
    case "illustrative":
      return "illustrative";
  }
}

export type FootballFieldResult = {
  bars: FootballBar[];
  /** global axis extent for charting */
  axis: { min: number; max: number } | null;
  currentPrice: number | null;
  /** midpoint average of available mids */
  centralEstimate: number | null;
  /** vs current price */
  impliedUpside: number | null;
  notes: string[];
};

function finite(n: number | null | undefined): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

/**
 * Normalize any collection of points into a low / mid / high triple.
 * - empty → all null
 * - single finite → low = mid = high
 * - multiple → min / mean / max
 */
export function rangeFromPoints(points: (number | null | undefined)[]): {
  low: number | null;
  mid: number | null;
  high: number | null;
} {
  const xs = filterFinite(points);
  if (xs.length === 0) return { low: null, mid: null, high: null };
  if (xs.length === 1) {
    const v = xs[0];
    return { low: v, mid: v, high: v };
  }
  const low = Math.min(...xs);
  const high = Math.max(...xs);
  const mid = mean(xs);
  return { low, mid, high };
}

/** True when the bar has at least one finite bound and is not disabled. */
function isActiveBar(bar: FootballBar): boolean {
  if (bar.enabled === false) return false;
  return finite(bar.low) || finite(bar.mid) || finite(bar.high);
}

/**
 * Fill missing mid from low/high mean; collapse a single point to low=mid=high.
 * Ensures low ≤ high when both ends exist.
 */
function normalizeBar(bar: FootballBar): FootballBar {
  const points = [bar.low, bar.mid, bar.high].filter(finite);
  if (points.length === 0) {
    return { ...bar, low: null, mid: null, high: null };
  }
  if (points.length === 1) {
    const v = points[0];
    return { ...bar, low: v, mid: v, high: v };
  }

  let low = finite(bar.low) ? bar.low : Math.min(...points);
  let high = finite(bar.high) ? bar.high : Math.max(...points);
  if (finite(low) && finite(high) && low > high) {
    const t = low;
    low = high;
    high = t;
  }

  let mid: number | null = finite(bar.mid) ? bar.mid : null;
  if (mid == null) {
    if (finite(low) && finite(high)) {
      mid = (low + high) / 2;
    } else {
      mid = mean(points);
    }
  }

  return { ...bar, low, mid, high };
}

/**
 * Assemble chart-ready football-field bars, axis, and summary stats.
 *
 * - Drops disabled bars and bars with no finite bounds
 * - Fills missing mid (mean of low/high) or collapses single-point bars
 * - Axis spans min(lows, currentPrice) … max(highs, currentPrice) with pad
 * - centralEstimate = mean of non-illustrative mids; impliedUpside = (central − price) / price
 */
export function buildFootballField(args: {
  currentPrice?: number | null;
  bars: FootballBar[];
  /** pad axis by this fraction default 0.08 */
  pad?: number;
}): FootballFieldResult {
  const pad = args.pad ?? 0.08;
  const currentPrice =
    finite(args.currentPrice) ? args.currentPrice : null;

  const bars = args.bars.filter(isActiveBar).map(normalizeBar);
  const notes: string[] = [];

  if (args.bars.length === 0) {
    notes.push("No valuation bars supplied.");
  } else if (bars.length === 0) {
    notes.push("No bars with finite bounds; football field is empty.");
  }

  // Illustrative bars stay on the chart / axis but do not pull the midpoint.
  const centralBars = bars.filter((b) => b.provenance !== "illustrative");
  const droppedIllustrative = bars.length - centralBars.length;
  if (droppedIllustrative > 0) {
    notes.push(
      `${droppedIllustrative} illustrative bar(s) excluded from the central estimate.`
    );
  }

  const mids = centralBars
    .map((b) => b.mid)
    .filter((v): v is number => finite(v));
  const centralEstimate = mean(mids);

  let impliedUpside: number | null = null;
  if (
    centralEstimate != null &&
    currentPrice != null &&
    currentPrice !== 0
  ) {
    impliedUpside = (centralEstimate - currentPrice) / currentPrice;
  } else if (centralEstimate != null && currentPrice == null) {
    notes.push("Current price missing; implied upside not computed.");
  } else if (currentPrice === 0) {
    notes.push("Current price is zero; implied upside not computed.");
  }

  let axis: { min: number; max: number } | null = null;
  const axisPoints: number[] = [];
  for (const b of bars) {
    if (finite(b.low)) axisPoints.push(b.low);
    if (finite(b.high)) axisPoints.push(b.high);
    // mid alone (degenerate) still contributes
    if (finite(b.mid) && !finite(b.low) && !finite(b.high)) {
      axisPoints.push(b.mid);
    }
  }
  if (currentPrice != null) axisPoints.push(currentPrice);

  if (axisPoints.length > 0) {
    const rawMin = Math.min(...axisPoints);
    const rawMax = Math.max(...axisPoints);
    const span = rawMax - rawMin;
    const padding =
      span > 0
        ? span * pad
        : Math.abs(rawMin) > 0
          ? Math.abs(rawMin) * pad
          : 1;
    axis = { min: rawMin - padding, max: rawMax + padding };
  }

  if (bars.length === 1) {
    notes.push("Only one method on the field; triangulation is limited.");
  }

  const units = new Set(bars.map((b) => b.unit));
  if (units.size > 1) {
    notes.push(
      `Mixed units on field (${[...units].join(", ")}); compare bars with care.`
    );
  }

  return {
    bars,
    axis,
    currentPrice,
    centralEstimate,
    impliedUpside,
    notes,
  };
}

function hasAnyFinite(
  ...vals: (number | null | undefined)[]
): boolean {
  return vals.some(finite);
}

/**
 * Build the standard IB bar set from method outputs.
 * Skips methods where every input is null/non-finite.
 *
 * Bars (when present):
 * - DCF — min/avg/max of Gordon and exit per-share values
 * - Trading comps
 * - Precedent transactions
 * - LBO (implied equity) — entry / IRR mid / exit per share
 * - SOTP
 * - Monte Carlo DCF (distribution band)
 * - 52-week range
 */
export function assembleValuationBars(args: {
  dcf?: {
    gordonPerShare?: number | null;
    exitPerShare?: number | null;
    label?: string;
  };
  comps?: { low?: number | null; mid?: number | null; high?: number | null };
  precedents?: {
    low?: number | null;
    mid?: number | null;
    high?: number | null;
  };
  lbo?: {
    /** sponsor equity value per share at entry or exit */
    entryEquityPerShare?: number | null;
    exitEquityPerShare?: number | null;
    irrMidPerShare?: number | null;
  };
  sotp?: { low?: number | null; mid?: number | null; high?: number | null };
  monteCarlo?: {
    low?: number | null;
    mid?: number | null;
    high?: number | null;
  };
  tradingRange?: {
    low?: number | null;
    mid?: number | null;
    high?: number | null;
  };
  /**
   * When true (default), precedent bars are tagged illustrative — sector
   * templates / synthetic deals, not a real M&A set. Set false for market-sourced deals.
   */
  precedentsIllustrative?: boolean;
}): FootballBar[] {
  const bars: FootballBar[] = [];
  const precedentsIllustrative = args.precedentsIllustrative ?? true;

  if (args.dcf && hasAnyFinite(args.dcf.gordonPerShare, args.dcf.exitPerShare)) {
    const range = rangeFromPoints([
      args.dcf.gordonPerShare,
      args.dcf.exitPerShare,
    ]);
    bars.push({
      id: "dcf",
      label: args.dcf.label ?? "DCF",
      low: range.low,
      mid: range.mid,
      high: range.high,
      unit: "perShare",
      provenance: "model",
      note:
        finite(args.dcf.gordonPerShare) && finite(args.dcf.exitPerShare)
          ? "Gordon growth and exit multiple terminal values"
          : finite(args.dcf.gordonPerShare)
            ? "Gordon growth terminal value only"
            : "Exit multiple terminal value only",
    });
  }

  if (
    args.comps &&
    hasAnyFinite(args.comps.low, args.comps.mid, args.comps.high)
  ) {
    const range = rangeFromPoints([
      args.comps.low,
      args.comps.mid,
      args.comps.high,
    ]);
    // Prefer explicit mid when provided; rangeFromPoints re-means all points
    const mid = finite(args.comps.mid)
      ? args.comps.mid
      : range.mid;
    bars.push({
      id: "comps",
      label: "Trading comps",
      low: finite(args.comps.low) ? args.comps.low : range.low,
      mid,
      high: finite(args.comps.high) ? args.comps.high : range.high,
      unit: "perShare",
      provenance: "market",
    });
  }

  if (
    args.precedents &&
    hasAnyFinite(
      args.precedents.low,
      args.precedents.mid,
      args.precedents.high
    )
  ) {
    const range = rangeFromPoints([
      args.precedents.low,
      args.precedents.mid,
      args.precedents.high,
    ]);
    const mid = finite(args.precedents.mid)
      ? args.precedents.mid
      : range.mid;
    bars.push({
      id: "precedents",
      label: "Precedent transactions",
      low: finite(args.precedents.low) ? args.precedents.low : range.low,
      mid,
      high: finite(args.precedents.high) ? args.precedents.high : range.high,
      unit: "perShare",
      provenance: precedentsIllustrative ? "illustrative" : "market",
      note: precedentsIllustrative
        ? "Illustrative sector multiples — not a real deal set"
        : undefined,
    });
  }

  if (
    args.lbo &&
    hasAnyFinite(
      args.lbo.entryEquityPerShare,
      args.lbo.exitEquityPerShare,
      args.lbo.irrMidPerShare
    )
  ) {
    const low = finite(args.lbo.entryEquityPerShare)
      ? args.lbo.entryEquityPerShare
      : null;
    const high = finite(args.lbo.exitEquityPerShare)
      ? args.lbo.exitEquityPerShare
      : null;
    const mid = finite(args.lbo.irrMidPerShare)
      ? args.lbo.irrMidPerShare
      : null;
    // Fall back to range of whatever is present
    const filled = rangeFromPoints([
      args.lbo.entryEquityPerShare,
      args.lbo.irrMidPerShare,
      args.lbo.exitEquityPerShare,
    ]);
    bars.push({
      id: "lbo",
      label: "LBO (implied equity)",
      low: low ?? filled.low,
      mid: mid ?? filled.mid,
      high: high ?? filled.high,
      unit: "perShare",
      provenance: "model",
      note: "Entry / target IRR / exit equity per share",
    });
  }

  if (
    args.sotp &&
    hasAnyFinite(args.sotp.low, args.sotp.mid, args.sotp.high)
  ) {
    const range = rangeFromPoints([
      args.sotp.low,
      args.sotp.mid,
      args.sotp.high,
    ]);
    const mid = finite(args.sotp.mid) ? args.sotp.mid : range.mid;
    bars.push({
      id: "sotp",
      label: "SOTP",
      low: finite(args.sotp.low) ? args.sotp.low : range.low,
      mid,
      high: finite(args.sotp.high) ? args.sotp.high : range.high,
      unit: "perShare",
      provenance: "model",
      note: "Sum-of-the-parts segment multiples",
    });
  }

  if (
    args.monteCarlo &&
    hasAnyFinite(
      args.monteCarlo.low,
      args.monteCarlo.mid,
      args.monteCarlo.high
    )
  ) {
    const range = rangeFromPoints([
      args.monteCarlo.low,
      args.monteCarlo.mid,
      args.monteCarlo.high,
    ]);
    const mid = finite(args.monteCarlo.mid)
      ? args.monteCarlo.mid
      : range.mid;
    bars.push({
      id: "monte-carlo",
      label: "Monte Carlo DCF",
      low: finite(args.monteCarlo.low) ? args.monteCarlo.low : range.low,
      mid,
      high: finite(args.monteCarlo.high)
        ? args.monteCarlo.high
        : range.high,
      unit: "perShare",
      provenance: "model",
      note: "Simulated distribution (e.g. P5–P50–P95)",
    });
  }

  if (
    args.tradingRange &&
    hasAnyFinite(
      args.tradingRange.low,
      args.tradingRange.mid,
      args.tradingRange.high
    )
  ) {
    const range = rangeFromPoints([
      args.tradingRange.low,
      args.tradingRange.mid,
      args.tradingRange.high,
    ]);
    const mid = finite(args.tradingRange.mid)
      ? args.tradingRange.mid
      : range.mid;
    bars.push({
      id: "trading-range",
      label: "52-week range",
      low: finite(args.tradingRange.low)
        ? args.tradingRange.low
        : range.low,
      mid,
      high: finite(args.tradingRange.high)
        ? args.tradingRange.high
        : range.high,
      unit: "perShare",
      provenance: "market",
    });
  }

  return bars;
}
