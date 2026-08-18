// Pure WACC × terminal-growth sensitivity for the in-UI DCF grid.
//
// Recomputes equity / per-share value from a fixed unlevered FCF path so the
// matrix stays consistent with the headline Gordon DCF without re-running the
// full projection. Excel keeps its own wider axes; the web UI uses tighter
// steps centred on the live base case.
//
// Mid-year (optional): DF_t = 1/(1+w)^(t+0.5) with t 0-based — year 1 is
// 1/√(1+w), then × 1/(1+w) each year. Gordon TV uses the same last DF.

/** Year-end is the historical default; mid-year is the IB cash-timing convention. */
export type DiscountConvention = "year-end" | "mid-year";

function discountPath(
  n: number,
  wacc: number,
  convention: DiscountConvention
): number[] | null {
  const r = 1 + wacc;
  if (!(r > 0) || !Number.isFinite(r)) return null;
  const out: number[] = [];
  // 0-based t: year-end 1/(1+w)^(t+1); mid-year 1/(1+w)^(t+0.5)
  let df = convention === "mid-year" ? 1 / Math.sqrt(r) : 1 / r;
  for (let t = 0; t < n; t++) {
    if (t > 0) df /= r;
    if (!Number.isFinite(df)) return null;
    out.push(df);
  }
  return out;
}

/** Value per share (or null when WACC ≤ g, or when shares are missing). */
export function valuePerShareAt(
  fcf: number[],
  wacc: number,
  growth: number,
  debt: number,
  cash: number,
  shares: number | null,
  convention: DiscountConvention = "year-end"
): number | null {
  const equity = equityValueAt(fcf, wacc, growth, debt, cash, convention);
  if (equity == null) return null;
  if (shares != null && shares > 0) return equity / shares;
  return null;
}

/** Equity value (EV − debt + cash) for one (WACC, g) pair; null when invalid. */
export function equityValueAt(
  fcf: number[],
  wacc: number,
  growth: number,
  debt: number,
  cash: number,
  convention: DiscountConvention = "year-end"
): number | null {
  if (!fcf.length) return null;
  const spread = wacc - growth;
  if (!(spread > 0) || !Number.isFinite(wacc) || !Number.isFinite(growth)) {
    return null;
  }
  const dfs = discountPath(fcf.length, wacc, convention);
  if (!dfs) return null;

  let sumPv = 0;
  for (let t = 0; t < fcf.length; t++) {
    sumPv += fcf[t] * dfs[t]!;
  }
  const tv = (fcf[fcf.length - 1] * (1 + growth)) / spread;
  const ev = sumPv + tv * dfs[dfs.length - 1]!;
  return ev - debt + cash;
}

/** Evenly spaced offsets from `-span` to `+span` inclusive, step `step`. */
export function symmetricSteps(span: number, step: number): number[] {
  if (!(span > 0) || !(step > 0)) return [0];
  const n = Math.round(span / step);
  const out: number[] = [];
  for (let i = -n; i <= n; i++) out.push(i * step);
  return out;
}

/** UI defaults: WACC base ±1% in 0.5% steps; terminal g base ±0.5% in 0.25% steps. */
export const UI_WACC_DELTAS = symmetricSteps(0.01, 0.005);
export const UI_GROWTH_DELTAS = symmetricSteps(0.005, 0.0025);

/** Excel / buildDcf defaults: WACC ±2% in 1% steps; g ±1% in 0.5% steps. */
export const EXCEL_WACC_DELTAS = symmetricSteps(0.02, 0.01);
export const EXCEL_GROWTH_DELTAS = symmetricSteps(0.01, 0.005);

export interface SensitivityMatrixInput {
  fcf: number[];
  baseWacc: number;
  baseGrowth: number;
  debt: number;
  cash: number;
  shares: number | null;
  /** Offsets added to base WACC (e.g. [-0.01, 0, 0.01]). */
  waccDeltas?: number[];
  /** Offsets added to base terminal growth. */
  growthDeltas?: number[];
  /** Default year-end so existing grids stay put. */
  discountConvention?: DiscountConvention;
}

export interface SensitivityMatrix {
  waccAxis: number[];
  growthAxis: number[];
  /** [waccIndex][growthIndex] → value per share, or null when undefined. */
  values: (number | null)[][];
  /** Index of base WACC on waccAxis. */
  baseWaccIndex: number;
  /** Index of base growth on growthAxis. */
  baseGrowthIndex: number;
}

/**
 * Build a WACC (rows) × terminal-growth (cols) value-per-share matrix from a
 * fixed free-cash-flow path.
 */
export function buildSensitivityMatrix(
  input: SensitivityMatrixInput
): SensitivityMatrix {
  const waccDeltas = input.waccDeltas ?? UI_WACC_DELTAS;
  const growthDeltas = input.growthDeltas ?? UI_GROWTH_DELTAS;

  const waccAxis = waccDeltas.map((d) => input.baseWacc + d);
  const growthAxis = growthDeltas.map((d) => input.baseGrowth + d);

  const baseWaccIndex = waccDeltas.findIndex((d) => Math.abs(d) < 1e-12);
  const baseGrowthIndex = growthDeltas.findIndex((d) => Math.abs(d) < 1e-12);

  const convention = input.discountConvention === "mid-year" ? "mid-year" : "year-end";

  const values = waccAxis.map((w) =>
    growthAxis.map((g) =>
      valuePerShareAt(
        input.fcf,
        w,
        g,
        input.debt,
        input.cash,
        input.shares,
        convention
      )
    )
  );

  return {
    waccAxis,
    growthAxis,
    values,
    baseWaccIndex: baseWaccIndex >= 0 ? baseWaccIndex : Math.floor(waccAxis.length / 2),
    baseGrowthIndex:
      baseGrowthIndex >= 0 ? baseGrowthIndex : Math.floor(growthAxis.length / 2),
  };
}
