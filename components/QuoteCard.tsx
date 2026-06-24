import { usd, pct, isUp } from "@/lib/format";
import type { Quote } from "@/lib/finnhub";

export default function QuoteCard({
  quote,
  label,
}: {
  quote: Quote;
  label?: string;
}) {
  const up = isUp(quote.dp);
  return (
    <div className="rounded-xl border border-line bg-panel p-5">
      <div className="flex items-baseline justify-between">
        <p className="text-sm text-gray-400">{label ?? quote.symbol}</p>
        <p className="text-xs text-gray-500">{quote.symbol}</p>
      </div>
      <p className="mt-2 text-2xl font-semibold text-white nums">
        {usd(quote.c)}
      </p>
      <p className={`mt-1 text-sm nums ${up ? "text-up" : "text-down"}`}>
        {up ? "▲" : "▼"} {usd(Math.abs(quote.d))} ({pct(quote.dp)})
      </p>
    </div>
  );
}
