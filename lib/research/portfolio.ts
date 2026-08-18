/**
 * Simple free portfolio analytics on watchlist weights.
 * Pure math — no paid feeds.
 */

export type PortfolioHolding = {
  ticker: string;
  weight: number; // 0-1
  /** Optional contribution metrics (fraction or absolute) */
  revYoy?: number | null;
  netMargin?: number | null;
  fcfMargin?: number | null;
};

export type PortfolioSummary = {
  holdings: PortfolioHolding[];
  weightSum: number;
  /** Weights renormalized to sum 1 if sum > 0 */
  normalized: PortfolioHolding[];
  weightedRevYoy: number | null;
  weightedNetMargin: number | null;
  weightedFcfMargin: number | null;
  notes: string[];
};

function finite(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

export function summarizePortfolio(holdings: PortfolioHolding[]): PortfolioSummary {
  const notes: string[] = [];
  const cleaned = holdings.map((h) => ({
    ...h,
    weight: finite(h.weight) && h.weight > 0 ? h.weight : 0,
  }));
  const weightSum = cleaned.reduce((s, h) => s + h.weight, 0);
  if (weightSum <= 0) {
    notes.push("No positive weights — set weights to build a portfolio view.");
    return {
      holdings: cleaned,
      weightSum: 0,
      normalized: cleaned,
      weightedRevYoy: null,
      weightedNetMargin: null,
      weightedFcfMargin: null,
      notes,
    };
  }
  if (Math.abs(weightSum - 1) > 0.02) {
    notes.push(
      `Weights sum to ${(weightSum * 100).toFixed(1)}% — metrics use renormalized weights.`
    );
  }
  const normalized = cleaned.map((h) => ({
    ...h,
    weight: h.weight / weightSum,
  }));

  function wavg(key: "revYoy" | "netMargin" | "fcfMargin"): number | null {
    let s = 0;
    let w = 0;
    for (const h of normalized) {
      const v = h[key];
      if (finite(v)) {
        s += v * h.weight;
        w += h.weight;
      }
    }
    return w > 0 ? s / w : null;
  }

  return {
    holdings: cleaned,
    weightSum,
    normalized,
    weightedRevYoy: wavg("revYoy"),
    weightedNetMargin: wavg("netMargin"),
    weightedFcfMargin: wavg("fcfMargin"),
    notes,
  };
}
