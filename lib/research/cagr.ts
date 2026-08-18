// Compound annual growth rate on a newest-first period axis.
//
// Two failure modes this is careful about:
//
// 1. Gaps / fiscal-calendar drift. Indexing `periods[years]` alone can land on
//    the wrong year when a filer skipped a year; pure calendar matching can
//    annualise a 4-year span as "3y". We prefer the fiscal-index match when its
//    calendar span is near `years`, otherwise date-search with a tolerance, and
//    always use the integer year count as the exponent when the span is close
//    (analyst convention for "3y CAGR").
//
// 2. Scale / unit discontinuities. Foreign filers and tag migrations sometimes
//    produce a series that jumps by an order of magnitude (e.g. Toyota revenue
//    in yen for recent years and a USD-scale figure further back). A 10y CAGR
//    across that break is arithmetic nonsense. We refuse to report one when any
//    consecutive pair between the endpoints jumps by more than SCALE_BREAK.

const YEAR_MS = 365.25 * 86_400_000;

/** Max |log-ratio| between consecutive points before we treat the series as broken. */
const SCALE_BREAK = 5; // 5× year-over-year is beyond any real operating change

export interface PeriodLike {
  key: string;
  end: string;
}

/**
 * N-year CAGR from a values map on a newest-first period axis.
 * Returns null when the window can't be measured honestly.
 */
export function periodCagr(
  values: Record<string, number | null | undefined>,
  periods: PeriodLike[],
  years: number,
  opts?: { toleranceYears?: number }
): number | null {
  if (!Number.isFinite(years) || years < 1 || periods.length < 2) return null;
  const tol = opts?.toleranceYears ?? 0.75;

  const latest = periods[0];
  const now = values[latest.key];
  if (now == null || !(now > 0)) return null;

  const latestMs = Date.parse(latest.end);
  if (!Number.isFinite(latestMs)) return null;

  let pastKey: string | null = null;
  let pastEnd: string | null = null;
  let spanYears: number | null = null;

  // Prefer fiscal-index match: periods[N] is "N fiscal years ago" on a dense axis.
  const byIndex = periods[years];
  if (byIndex) {
    const past = values[byIndex.key];
    if (past != null && past > 0) {
      const span = (latestMs - Date.parse(byIndex.end)) / YEAR_MS;
      if (Number.isFinite(span) && span > 0.5 && Math.abs(span - years) <= tol) {
        pastKey = byIndex.key;
        pastEnd = byIndex.end;
        spanYears = span;
      }
    }
  }

  // Fall back to nearest period by calendar date.
  if (pastKey == null) {
    const targetMs = latestMs - years * YEAR_MS;
    let best: { key: string; end: string; span: number; dist: number } | null =
      null;
    for (const p of periods) {
      const v = values[p.key];
      if (v == null || !(v > 0)) continue;
      const endMs = Date.parse(p.end);
      if (!Number.isFinite(endMs)) continue;
      const span = (latestMs - endMs) / YEAR_MS;
      if (span <= 0.5) continue;
      const dist = Math.abs(endMs - targetMs);
      if (!best || dist < best.dist) {
        best = { key: p.key, end: p.end, span, dist };
      }
    }
    if (!best || Math.abs(best.span - years) > tol) return null;
    pastKey = best.key;
    pastEnd = best.end;
    spanYears = best.span;
  }

  const past = values[pastKey];
  if (past == null || !(past > 0) || spanYears == null) return null;

  // Reject scale breaks between the endpoints (inclusive window, newest→oldest).
  if (hasScaleBreak(values, periods, pastEnd!, latest.end)) return null;

  // Integer year count when the span is near N; otherwise the measured span so
  // a 2.2-year window never pretends to be a 3y CAGR.
  const exponent =
    Math.abs(spanYears - years) <= tol ? years : spanYears;
  if (!(exponent > 0)) return null;

  return Math.pow(now / past, 1 / exponent) - 1;
}

/**
 * True when any two consecutive *valued* periods between `fromEnd` and `toEnd`
 * (on the newest-first axis) jump by more than SCALE_BREAK×.
 */
function hasScaleBreak(
  values: Record<string, number | null | undefined>,
  periods: PeriodLike[],
  fromEnd: string, // older
  toEnd: string // newer
): boolean {
  const fromMs = Date.parse(fromEnd);
  const toMs = Date.parse(toEnd);
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs)) return true;

  // Walk newest → oldest; keep points inside [from, to].
  const series: number[] = [];
  for (const p of periods) {
    const t = Date.parse(p.end);
    if (!Number.isFinite(t)) continue;
    if (t > toMs + 2 * 86_400_000) continue;
    if (t < fromMs - 2 * 86_400_000) break;
    const v = values[p.key];
    if (v == null || !(v > 0)) continue;
    series.push(v);
  }

  for (let i = 0; i + 1 < series.length; i++) {
    const a = series[i];
    const b = series[i + 1];
    const ratio = a > b ? a / b : b / a;
    if (ratio > SCALE_BREAK) return true;
  }
  return false;
}
