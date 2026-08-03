/**
 * Does a computed subtotal exactly reproduce the figure the company filed?
 *
 * This gates whether the Excel export writes a subtotal as a live formula or as
 * a literal. The distinction is load-bearing and the tolerance must be tight:
 *
 * A formula cell carries a cached value, but Excel *recalculates on open*. If
 * the formula and the filed figure differ at all, the number the user sees
 * changes the moment they open the workbook — silently replacing a reported
 * figure with a computed one. That is worse than showing no formula.
 *
 * An earlier version allowed 0.5% or $1M of slack, reasoning that "close
 * enough" subtotals were still worth linking. They aren't: Target, Tesla and
 * Microsoft all had subtotals within that band whose formulas recalculated to
 * different numbers than the filings reported. Only exact matches qualify.
 *
 * The remaining epsilon is for IEEE-754 noise, not for accounting slack.
 * Values are whole dollars, so one dollar of absolute tolerance is well below
 * anything meaningful and well above float error.
 */
export function reconcilesExactly(computed: number, reported: number): boolean {
  return Math.abs(computed - reported) <= Math.max(1, Math.abs(reported) * 1e-9);
}
