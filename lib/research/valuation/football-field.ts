/**
 * Football-field valuation synthesis.
 *
 * IB-style triangulation chart data: each method is a low/mid/high bar,
 * plotted on a shared axis with the current share price for context.
 * Pitch-book order: 52-week range, analyst targets, comp P/E, comp
 * EV/EBITDA, then DCF and LBO. Pure data assembly, no rendering.
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
  /**
   * When false, the bar stays on the chart but its midpoint is left out of
   * the central average. The 52-week range is a price history, not a valuation.
   */
  includeInCentral?: boolean;
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

  // Illustrative bars and price-history bars stay on the chart. Only the
  // illustrative ones are called out; the 52-week bar carries its own note.
  const centralBars = bars.filter(
    (b) => b.provenance !== "illustrative" && b.includeInCentral !== false
  );
  const illustrativeCount = bars.filter(
    (b) => b.provenance === "illustrative"
  ).length;
  if (illustrativeCount > 0) {
    notes.push(
      `${illustrativeCount} illustrative bar(s) excluded from the central estimate.`
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

type Band = { low?: number | null; mid?: number | null; high?: number | null };

function pushBand(
  bars: FootballBar[],
  bar: Omit<FootballBar, "low" | "mid" | "high"> & Band
) {
  const low = bar.low ?? null;
  const midIn = bar.mid ?? null;
  const high = bar.high ?? null;
  if (!hasAnyFinite(low, midIn, high)) return;
  const range = rangeFromPoints([low, midIn, high]);
  const mid = finite(midIn) ? midIn : range.mid;
  bars.push({
    ...bar,
    low: finite(low) ? low : range.low,
    mid,
    high: finite(high) ? high : range.high,
  });
}

/**
 * Build the football-field bars in pitch-book order.
 * Skips methods where every input is null/non-finite.
 *
 * Order:
 * 1. 52-week range (price history; left out of the central estimate)
 * 2. Analyst price targets
 * 3. Comp P/E (peer p25 / median / p75)
 * 4. Comp EV/EBITDA
 * 5. Precedent transactions, when a set exists
 * 6. Monte Carlo DCF, when it has been run
 * 7. DCF
 * 8. LBO — price a buyer could pay today at a 25% / 20% / 15% IRR
 */
export function assembleValuationBars(args: {
  dcf?: {
    gordonPerShare?: number | null;
    exitPerShare?: number | null;
    label?: string;
  };
  /** Peer P/E applied to the subject: p25 / median / p75. */
  compsPe?: Band;
  /** Peer EV/EBITDA applied to the subject: p25 / median / p75. */
  compsEvEbitda?: Band;
  analystTargets?: Band;
  precedents?: Band;
  /** Entry price per share at a 25% / 20% / 15% IRR. */
  lbo?: Band;
  monteCarlo?: Band;
  tradingRange?: Band;
  /**
   * When true (default), precedent bars are tagged illustrative — sector
   * templates / synthetic deals, not a real M&A set. Set false for market-sourced deals.
   */
  precedentsIllustrative?: boolean;
}): FootballBar[] {
  const bars: FootballBar[] = [];
  const precedentsIllustrative = args.precedentsIllustrative ?? true;

  if (args.tradingRange) {
    pushBand(bars, {
      id: "trading-range",
      label: "52-week range",
      low: args.tradingRange.low,
      mid: args.tradingRange.mid,
      high: args.tradingRange.high,
      unit: "perShare",
      provenance: "market",
      includeInCentral: false,
      note: "Price history. The central estimate leaves this bar out.",
    });
  }

  if (args.analystTargets) {
    pushBand(bars, {
      id: "analyst-targets",
      label: "Analyst targets",
      low: args.analystTargets.low,
      mid: args.analystTargets.mid,
      high: args.analystTargets.high,
      unit: "perShare",
      provenance: "market",
      note: "Nasdaq consensus low, mean, and high. Unofficial public endpoint.",
    });
  }

  if (args.compsPe) {
    pushBand(bars, {
      id: "comps-pe",
      label: "Comp P/E",
      low: args.compsPe.low,
      mid: args.compsPe.mid,
      high: args.compsPe.high,
      unit: "perShare",
      provenance: "market",
      note: "Peer P/E p25, median, and p75 applied to subject earnings",
    });
  }

  if (args.compsEvEbitda) {
    pushBand(bars, {
      id: "comps-ev-ebitda",
      label: "Comp EV/EBITDA",
      low: args.compsEvEbitda.low,
      mid: args.compsEvEbitda.mid,
      high: args.compsEvEbitda.high,
      unit: "perShare",
      provenance: "market",
      note: "Peer EV/EBITDA p25, median, and p75, bridged through net debt",
    });
  }

  if (args.precedents) {
    pushBand(bars, {
      id: "precedents",
      label: "Precedent transactions",
      low: args.precedents.low,
      mid: args.precedents.mid,
      high: args.precedents.high,
      unit: "perShare",
      provenance: precedentsIllustrative ? "illustrative" : "market",
      note: precedentsIllustrative
        ? "Illustrative sector multiples — not a real deal set"
        : undefined,
    });
  }

  if (args.monteCarlo) {
    pushBand(bars, {
      id: "monte-carlo",
      label: "Monte Carlo DCF",
      low: args.monteCarlo.low,
      mid: args.monteCarlo.mid,
      high: args.monteCarlo.high,
      unit: "perShare",
      provenance: "model",
      note: "Simulated distribution (P5, median, P95)",
    });
  }

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

  if (args.lbo) {
    pushBand(bars, {
      id: "lbo",
      label: "LBO 15–25% IRR",
      low: args.lbo.low,
      mid: args.lbo.mid,
      high: args.lbo.high,
      unit: "perShare",
      provenance: "model",
      note: "Price a buyer could pay today. Low is a 25% IRR, high is 15%.",
    });
  }

  return bars;
}
