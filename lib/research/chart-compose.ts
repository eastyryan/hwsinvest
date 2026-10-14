// Pure helpers for the statement composer: which axis a series belongs on,
// and how far back a preset should reach. The chart component only draws.

export type AxisFormat = "value" | "perShare" | "shares" | "pct" | "x";

export type AxisSide = "left" | "right" | "dropped";

export interface AxisPlan {
  left: AxisFormat;
  /** First format that is not the left-hand unit. Null when every series matches. */
  right: AxisFormat | null;
  assign: AxisSide[];
}

/**
 * Two scales per chart. The first series owns the left axis. The next distinct
 * unit owns the right axis. A third unit is dropped — plotting it on either
 * axis would draw a truthful number on the wrong scale.
 */
export function planAxes(formats: AxisFormat[]): AxisPlan {
  const left = formats[0] ?? "value";
  let right: AxisFormat | null = null;
  for (const format of formats) {
    if (format !== left) {
      right = format;
      break;
    }
  }
  return {
    left,
    right,
    assign: formats.map((format) => {
      if (format === left) return "left";
      if (right != null && format === right) return "right";
      return "dropped";
    }),
  };
}

const YEAR_MS = 365.25 * 86_400_000;

/**
 * Oldest-first start index so the slice still covers `years` before the last
 * point. `null` years means the full history. A short history starts at 0.
 */
export function startIndexForYears(
  ends: readonly string[],
  years: number | null
): number {
  if (years == null || !Number.isFinite(years) || years <= 0 || ends.length === 0) {
    return 0;
  }
  const last = Date.parse(ends[ends.length - 1] ?? "");
  if (!Number.isFinite(last)) return 0;
  const cutoff = last - years * YEAR_MS;
  // A few days of fiscal-calendar drift should still count as "inside" the window.
  const slack = 20 * 86_400_000;
  const index = ends.findIndex((end) => {
    const t = Date.parse(end);
    return Number.isFinite(t) && t >= cutoff - slack;
  });
  return index === -1 ? 0 : index;
}
