/** Shared formatting for valuation model panels. */

export function fmtMoney(n: number | null | undefined, digits = 0): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1e12) return `${sign}$${(abs / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(digits)}`;
}

export function fmtPerShare(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `$${n.toFixed(2)}`;
}

export function fmtMult(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n.toFixed(1)}×`;
}

export function fmtPct(n: number | null | undefined, digits = 1): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${(n * 100).toFixed(digits)}%`;
}

export function fmtRange(r: {
  low: number | null;
  mid: number | null;
  high: number | null;
}): string {
  if (r.low == null && r.high == null && r.mid == null) return "—";
  if (r.low != null && r.high != null && r.low !== r.high) {
    return `${fmtPerShare(r.low)} – ${fmtPerShare(r.high)}`;
  }
  return fmtPerShare(r.mid ?? r.low ?? r.high);
}
