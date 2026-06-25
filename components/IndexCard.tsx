import { usd, pct, isUp, arrow, sparkline } from "@/lib/format";
import type { Quote } from "@/lib/finnhub";

// Index tile with a small live sparkline. The sparkline is synthesized from the
// quote's previous-close / open / low / high / current so it reflects today's
// movement without needing an intraday series (free-tier friendly).
export default function IndexCard({
  quote,
  label,
  etf,
}: {
  quote: Quote;
  label?: string;
  etf?: string;
}) {
  const up = isUp(quote.dp);
  const color = up ? "var(--up)" : "var(--down)";
  const points = sparkline([quote.pc, quote.o, quote.l, quote.h, quote.c]);

  return (
    <div className="card card-hover-orange" style={{ padding: 22 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <span style={{ color: "var(--muted)", fontSize: 14, fontWeight: 500 }}>
          {label ?? quote.symbol}
        </span>
        <span
          className="mono"
          style={{ fontSize: 11, color: "var(--faint)", letterSpacing: "0.05em" }}
        >
          {etf ?? quote.symbol}
        </span>
      </div>
      <p
        className="mono nums"
        style={{ fontSize: 30, fontWeight: 600, color: "var(--text)", margin: "16px 0 0" }}
      >
        {usd(quote.c)}
      </p>
      <p
        className="mono nums"
        style={{ fontSize: 14, color, margin: "8px 0 14px", fontWeight: 500 }}
      >
        {arrow(quote.dp)} {usd(Math.abs(quote.d))} ({pct(quote.dp)})
      </p>
      {points && (
        <svg
          viewBox="0 0 100 32"
          preserveAspectRatio="none"
          style={{ width: "100%", height: 34, display: "block" }}
        >
          <polyline
            points={points}
            fill="none"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      )}
    </div>
  );
}
