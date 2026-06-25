import { usd, pct, isUp, arrow } from "@/lib/format";
import type { Quote } from "@/lib/finnhub";

export default function QuoteCard({
  quote,
  label,
}: {
  quote: Quote;
  label?: string;
}) {
  const up = isUp(quote.dp);
  const color = up ? "var(--up)" : "var(--down)";
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
          {quote.symbol}
        </span>
      </div>
      <p
        className="mono nums"
        style={{ fontSize: 28, fontWeight: 600, color: "var(--text)", margin: "16px 0 0" }}
      >
        {usd(quote.c)}
      </p>
      <p className="mono nums" style={{ fontSize: 14, color, margin: "8px 0 0", fontWeight: 500 }}>
        {arrow(quote.dp)} {usd(Math.abs(quote.d))} ({pct(quote.dp)})
      </p>
    </div>
  );
}
