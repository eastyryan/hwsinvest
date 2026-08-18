// 52-week trading range valuation (market-based).
//
// Filters a price series to the last ~365 calendar days, reads high / low /
// current, maps those levels to equity and enterprise value when shares and
// net debt are known, and back-solves implied multiples at the range extremes.

export type PricePoint = { t: number; c: number };

export type TradingRangeResult = {
  current: number | null;
  high52: number | null;
  low52: number | null;
  mid52: number | null;
  /** (current - low) / (high - low) */
  positionInRange: number | null;
  /** % off 52w high: (current - high) / high */
  pctFromHigh: number | null;
  /** % off 52w low: (current - low) / low */
  pctFromLow: number | null;
  /** Equity market caps if shares known */
  equityAtLow: number | null;
  equityAtMid: number | null;
  equityAtHigh: number | null;
  equityAtCurrent: number | null;
  /** EV = equity + netDebt */
  evAtLow: number | null;
  evAtHigh: number | null;
  /** Implied multiples at range using subject ebitda/revenue */
  multiplesAtHigh: {
    pe: number | null;
    evEbitda: number | null;
    evSales: number | null;
  };
  multiplesAtLow: {
    pe: number | null;
    evEbitda: number | null;
    evSales: number | null;
  };
  /** Per share = price levels */
  range: { low: number | null; mid: number | null; high: number | null };
  windowDays: number;
  notes: string[];
};

const DAY_MS = 86_400_000;
const WINDOW_MS = 365 * DAY_MS;

function isFiniteNumber(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

function equityAt(
  price: number | null,
  shares: number | null
): number | null {
  if (
    !isFiniteNumber(price) ||
    !isFiniteNumber(shares) ||
    !(shares > 0)
  ) {
    return null;
  }
  return price * shares;
}

function evAt(
  equity: number | null,
  netDebt: number | null
): number | null {
  if (!isFiniteNumber(equity)) return null;
  if (!isFiniteNumber(netDebt)) return equity;
  return equity + netDebt;
}

function peMultiple(
  equity: number | null,
  netIncome: number | null
): number | null {
  if (
    !isFiniteNumber(equity) ||
    !isFiniteNumber(netIncome) ||
    !(netIncome > 0)
  ) {
    return null;
  }
  return equity / netIncome;
}

function ratio(
  numerator: number | null,
  denominator: number | null
): number | null {
  if (
    !isFiniteNumber(numerator) ||
    !isFiniteNumber(denominator) ||
    !(denominator > 0)
  ) {
    return null;
  }
  return numerator / denominator;
}

/**
 * 52-week (≈365-day) trading range from a close series.
 *
 * Window: last 365 calendar days ending at `asOfMs` (default: last point's `t`,
 * else `Date.now()`). If the series is shorter than that, all points are used.
 */
export function runTradingRange(args: {
  points: PricePoint[];
  /** Prefer last 365 days; if points shorter use all */
  asOfMs?: number;
  shares: number | null;
  netDebt: number | null;
  netIncome: number | null;
  ebitda: number | null;
  revenue: number | null;
}): TradingRangeResult {
  const { points, shares, netDebt, netIncome, ebitda, revenue } = args;
  const notes: string[] = [];

  const empty: TradingRangeResult = {
    current: null,
    high52: null,
    low52: null,
    mid52: null,
    positionInRange: null,
    pctFromHigh: null,
    pctFromLow: null,
    equityAtLow: null,
    equityAtMid: null,
    equityAtHigh: null,
    equityAtCurrent: null,
    evAtLow: null,
    evAtHigh: null,
    multiplesAtHigh: { pe: null, evEbitda: null, evSales: null },
    multiplesAtLow: { pe: null, evEbitda: null, evSales: null },
    range: { low: null, mid: null, high: null },
    windowDays: 0,
    notes: ["No price points provided."],
  };

  if (!points.length) return empty;

  const valid = points.filter(
    (p) => isFiniteNumber(p.t) && isFiniteNumber(p.c) && p.c > 0
  );
  if (!valid.length) {
    return {
      ...empty,
      notes: ["No finite positive closes in the price series."],
    };
  }

  // Sort ascending by time so "current" is the last observation in-window.
  const sorted = valid.slice().sort((a, b) => a.t - b.t);

  const asOf =
    isFiniteNumber(args.asOfMs)
      ? args.asOfMs
      : sorted[sorted.length - 1].t;

  const cutoff = asOf - WINDOW_MS;
  let windowed = sorted.filter((p) => p.t >= cutoff && p.t <= asOf);

  // If nothing lands in the window (e.g. asOf far from series), fall back to all.
  if (!windowed.length) {
    windowed = sorted;
    notes.push(
      "No points in the 365-day window ending at asOf; using the full series."
    );
  } else if (windowed.length < sorted.length) {
    // normal case — filtered
  } else if (sorted[0].t > cutoff) {
    notes.push(
      "Price history shorter than 365 days; 52-week range uses the available series."
    );
  }

  let high52 = -Infinity;
  let low52 = Infinity;
  for (const p of windowed) {
    if (p.c > high52) high52 = p.c;
    if (p.c < low52) low52 = p.c;
  }
  if (!Number.isFinite(high52) || !Number.isFinite(low52)) {
    return {
      ...empty,
      notes: ["Could not determine high/low from the price series."],
    };
  }

  const current = windowed[windowed.length - 1].c;
  const mid52 = (high52 + low52) / 2;

  const span = high52 - low52;
  const positionInRange =
    span > 0 ? (current - low52) / span : high52 === low52 ? 0.5 : null;

  const pctFromHigh =
    high52 > 0 ? (current - high52) / high52 : null;
  const pctFromLow = low52 > 0 ? (current - low52) / low52 : null;

  const equityAtLow = equityAt(low52, shares);
  const equityAtMid = equityAt(mid52, shares);
  const equityAtHigh = equityAt(high52, shares);
  const equityAtCurrent = equityAt(current, shares);

  const evAtLowVal = evAt(equityAtLow, netDebt);
  const evAtHighVal = evAt(equityAtHigh, netDebt);

  const multiplesAtHigh = {
    pe: peMultiple(equityAtHigh, netIncome),
    evEbitda: ratio(evAtHighVal, ebitda),
    evSales: ratio(evAtHighVal, revenue),
  };
  const multiplesAtLow = {
    pe: peMultiple(equityAtLow, netIncome),
    evEbitda: ratio(evAtLowVal, ebitda),
    evSales: ratio(evAtLowVal, revenue),
  };

  const t0 = windowed[0].t;
  const t1 = windowed[windowed.length - 1].t;
  const windowDays = Math.max(0, Math.round((t1 - t0) / DAY_MS));

  if (!isFiniteNumber(shares) || !(shares > 0)) {
    notes.push("Share count missing — equity and EV levels not computed.");
  }
  if (!isFiniteNumber(netDebt)) {
    notes.push(
      "Net debt missing — EV treated as equity-only where equity is available."
    );
  }
  if (!isFiniteNumber(netIncome) || !(netIncome > 0)) {
    notes.push("Net income missing or non-positive — P/E not computed.");
  }
  if (!isFiniteNumber(ebitda) || !(ebitda > 0)) {
    notes.push("EBITDA missing or non-positive — EV/EBITDA not computed.");
  }
  if (!isFiniteNumber(revenue) || !(revenue > 0)) {
    notes.push("Revenue missing or non-positive — EV/Sales not computed.");
  }
  if (span === 0) {
    notes.push("High equals low in the window — flat series over the range.");
  }

  return {
    current,
    high52,
    low52,
    mid52,
    positionInRange,
    pctFromHigh,
    pctFromLow,
    equityAtLow,
    equityAtMid,
    equityAtHigh,
    equityAtCurrent,
    evAtLow: evAtLowVal,
    evAtHigh: evAtHighVal,
    multiplesAtHigh,
    multiplesAtLow,
    range: { low: low52, mid: mid52, high: high52 },
    windowDays,
    notes,
  };
}
