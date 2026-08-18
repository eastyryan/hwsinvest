/**
 * Monte Carlo DCF around a base FCF path.
 *
 * Each simulation independently shocks annual FCF (multiplicative), WACC, and
 * terminal growth — a simplification, not a copula / correlated draw — then
 * discounts year-end and applies Gordon terminal value. Equity = EV − debt + cash.
 *
 * Paths with g ≥ WACC − 25bps have g clamped to WACC − 50bps so Gordon stays
 * defined; the count is noted rather than silently dropped.
 */

import { mean, median, percentile } from "@/lib/research/valuation/stats";

export type McDcfInputs = {
  fcf: number[]; // base path
  wacc: number;
  terminalGrowth: number;
  debt: number;
  cash: number;
  shares: number | null;
  /** shock stdevs */
  fcfShockStd: number; // e.g. 0.15 = 15% multiplicative shock per year independent
  waccShockStd: number; // absolute, e.g. 0.01
  growthShockStd: number;
  simulations: number; // clamp 100-5000, default 1000
  seed?: number; // deterministic PRNG for tests
};

export type McDcfResult = {
  simulations: number;
  meanPerShare: number | null;
  medianPerShare: number | null;
  p5: number | null;
  p25: number | null;
  p75: number | null;
  p95: number | null;
  stdPerShare: number | null;
  /** histogram buckets optional */
  notes: string[];
};

/** mulberry32 — fast 32-bit seeded PRNG → [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Box–Muller normal(0,1) from two uniform draws. */
function normal01(rand: () => number): number {
  let u = 0;
  let v = 0;
  // Avoid log(0)
  while (u === 0) u = rand();
  while (v === 0) v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function isFiniteNumber(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/**
 * Enterprise value of a fixed FCF path discounted at `rate`, Gordon TV at `g`.
 * Year-end factors: 1/(1+r)^t for t = 1..n (same as excel-dcf evAtRate).
 */
function evAtRate(fcf: number[], rate: number, g: number): number | null {
  if (!(rate > 0) || !Number.isFinite(rate)) return null;
  if (!Number.isFinite(g)) return null;
  if (fcf.length === 0) return null;

  const r = 1 + rate;
  let df = 1;
  let sum = 0;
  for (let t = 0; t < fcf.length; t++) {
    df /= r;
    const cf = fcf[t];
    if (!Number.isFinite(cf)) return null;
    sum += cf * df;
  }

  const last = fcf[fcf.length - 1];
  if (!(rate > g)) return null; // non-convergent Gordon
  const tv = (last * (1 + g)) / (rate - g);
  if (!Number.isFinite(tv)) return null;
  return sum + tv * df;
}

function sampleStd(xs: number[], avg: number): number | null {
  if (xs.length < 2) return null;
  let ss = 0;
  for (const x of xs) {
    const d = x - avg;
    ss += d * d;
  }
  return Math.sqrt(ss / (xs.length - 1));
}

export function runMonteCarloDcf(inputs: McDcfInputs): McDcfResult {
  const notes: string[] = [];
  const baseFcf = (inputs.fcf ?? []).filter((x) => typeof x === "number");
  const empty: McDcfResult = {
    simulations: 0,
    meanPerShare: null,
    medianPerShare: null,
    p5: null,
    p25: null,
    p75: null,
    p95: null,
    stdPerShare: null,
    notes,
  };

  if (baseFcf.length === 0 || baseFcf.some((x) => !Number.isFinite(x))) {
    notes.push("FCF path empty or non-finite");
    return empty;
  }
  if (!isFiniteNumber(inputs.wacc) || inputs.wacc <= 0) {
    notes.push("WACC must be a positive finite number");
    return empty;
  }
  if (!isFiniteNumber(inputs.terminalGrowth)) {
    notes.push("Terminal growth must be finite");
    return empty;
  }

  const nSims = isFiniteNumber(inputs.simulations)
    ? clamp(Math.round(inputs.simulations), 100, 5000)
    : 1000;
  if (isFiniteNumber(inputs.simulations) && inputs.simulations !== nSims) {
    notes.push(`Simulations clamped to ${nSims} (allowed 100–5000)`);
  }

  const fcfStd = isFiniteNumber(inputs.fcfShockStd) ? Math.max(0, inputs.fcfShockStd) : 0;
  const waccStd = isFiniteNumber(inputs.waccShockStd) ? Math.max(0, inputs.waccShockStd) : 0;
  const gStd = isFiniteNumber(inputs.growthShockStd) ? Math.max(0, inputs.growthShockStd) : 0;

  const debt = isFiniteNumber(inputs.debt) ? inputs.debt : 0;
  const cash = isFiniteNumber(inputs.cash) ? inputs.cash : 0;
  const shares =
    isFiniteNumber(inputs.shares) && inputs.shares! > 0 ? inputs.shares! : null;

  if (shares == null) {
    notes.push("Shares missing — reporting equity value as 'per share' proxy (raw equity)");
  }

  const seed = isFiniteNumber(inputs.seed) ? inputs.seed : 0xc0ffee;
  const rand = mulberry32(seed);

  const values: number[] = [];
  let rejected = 0;
  let clamped = 0;

  for (let s = 0; s < nSims; s++) {
    const shockedFcf = baseFcf.map((cf) => {
      if (fcfStd === 0) return cf;
      const z = normal01(rand);
      // Multiplicative: FCF * (1 + σZ); floor at small epsilon to avoid sign flips noise
      return cf * (1 + fcfStd * z);
    });

    const wacc = inputs.wacc + (waccStd === 0 ? 0 : waccStd * normal01(rand));
    let g = inputs.terminalGrowth + (gStd === 0 ? 0 : gStd * normal01(rand));

    // Keep WACC positive. If g sits inside 25bp of WACC, clamp to WACC − 50bp
    // (Gordon needs a spread). Independent shocks — no copula.
    if (!(wacc > 0.001)) {
      rejected++;
      continue;
    }
    if (g >= wacc - 0.0025) {
      g = wacc - 0.005;
      clamped++;
    }
    if (g < -0.05) g = -0.05;

    const ev = evAtRate(shockedFcf, wacc, g);
    if (ev == null || !Number.isFinite(ev)) {
      rejected++;
      continue;
    }

    const equity = ev - debt + cash;
    if (!Number.isFinite(equity)) {
      rejected++;
      continue;
    }

    const perShareVal = shares != null ? equity / shares : equity;
    if (Number.isFinite(perShareVal)) values.push(perShareVal);
    else rejected++;
  }

  if (clamped > 0) {
    notes.push(
      `${clamped} of ${nSims} paths had g ≥ WACC − 25bps; terminal growth clamped to WACC − 50bps`
    );
  }
  if (rejected > 0) {
    notes.push(`${rejected} of ${nSims} simulations rejected (WACC/g or non-finite EV)`);
  }

  if (values.length === 0) {
    notes.push("No successful simulations");
    return { ...empty, simulations: nSims, notes };
  }

  const avg = mean(values);
  const std = avg != null ? sampleStd(values, avg) : null;

  return {
    simulations: values.length,
    meanPerShare: avg,
    medianPerShare: median(values),
    p5: percentile(values, 5),
    p25: percentile(values, 25),
    p75: percentile(values, 75),
    p95: percentile(values, 95),
    stdPerShare: std,
    notes,
  };
}
