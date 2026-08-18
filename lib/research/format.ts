export function fmtValue(v: number | null, opts?: { perShare?: boolean; shares?: boolean }): string {
  if (v == null) return "—";
  if (opts?.perShare) return v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (opts?.shares) {
    const m = v / 1e6;
    return m >= 1000 ? (m / 1000).toFixed(2) + "B" : m.toFixed(1) + "M";
  }
  // dollars, shown in millions
  const m = v / 1e6;
  const abs = Math.abs(m);
  const s = abs.toLocaleString("en-US", { maximumFractionDigits: abs < 10 ? 1 : 0 });
  return m < 0 ? `(${s})` : s;
}

export function fmtPct(v: number | null): string {
  if (v == null) return "";
  const pct = v * 100;
  const s = Math.abs(pct) >= 100 ? pct.toFixed(0) : pct.toFixed(1);
  return (v > 0 ? "+" : "") + s + "%";
}

export function fmtMarketCap(v: number): string {
  if (v >= 1e12) return "$" + (v / 1e12).toFixed(2) + "T";
  if (v >= 1e9) return "$" + (v / 1e9).toFixed(1) + "B";
  return "$" + (v / 1e6).toFixed(0) + "M";
}
