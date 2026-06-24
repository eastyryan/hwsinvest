import Link from "next/link";
import { ArrowRight } from "lucide-react";
import Ticker from "@/components/Ticker";
import QuoteCard from "@/components/QuoteCard";
import SectionHeading from "@/components/SectionHeading";
import { getQuotes } from "@/lib/finnhub";
import { indices, sectors } from "@/data/sectors";
import { usd, pct, isUp } from "@/lib/format";

// Edit this watchlist to whatever the club wants to track.
const WATCHLIST = ["AAPL", "MSFT", "NVDA", "AMZN", "GOOGL", "META", "TSLA", "JPM"];

export const metadata = { title: "Markets · HWS Investment Club" };
export const dynamic = "force-dynamic";

export default async function MarketsPage() {
  const [indexQuotes, sectorQuotes, watchQuotes] = await Promise.all([
    getQuotes(indices.map((i) => i.symbol)),
    getQuotes(sectors.map((s) => s.etf)),
    getQuotes(WATCHLIST),
  ]);

  return (
    <main className="mx-auto max-w-7xl px-6 py-12">
      <SectionHeading
        kicker="Markets"
        title="U.S. equity markets"
        sub="Live quotes via Finnhub. Indices are tracked through their ETFs."
      />
      <Ticker />

      <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {indexQuotes.map((q) => {
          const label = indices.find((i) => i.symbol === q.symbol)?.label;
          return <QuoteCard key={q.symbol} quote={q} label={label} />;
        })}
      </div>

      {/* Sectors */}
      <div className="mt-16">
        <SectionHeading
          kicker="Sectors"
          title="Explore by sector"
          sub="Click any sector to see its ETF and representative holdings."
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sectors.map((s) => {
            const q = sectorQuotes.find((x) => x.symbol === s.etf);
            const up = isUp(q?.dp);
            return (
              <Link
                key={s.slug}
                href={`/markets/${s.slug}`}
                className="group rounded-xl border border-line bg-panel p-5 transition hover:border-hws-orange"
              >
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-white">{s.name}</p>
                  <span className="text-xs text-gray-500">{s.etf}</span>
                </div>
                {q && (
                  <p
                    className={`mt-2 text-sm nums ${up ? "text-up" : "text-down"}`}
                  >
                    {usd(q.c)} · {pct(q.dp)}
                  </p>
                )}
                <p className="mt-2 line-clamp-2 text-sm text-gray-400">
                  {s.blurb}
                </p>
                <span className="mt-3 inline-flex items-center gap-1 text-sm text-hws-orange opacity-0 transition group-hover:opacity-100">
                  View sector <ArrowRight className="h-4 w-4" />
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Watchlist */}
      <div className="mt-16">
        <SectionHeading
          kicker="Watchlist"
          title="Club watchlist"
          sub="Edit WATCHLIST in app/markets/page.tsx to change these names."
        />
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full text-left text-sm">
            <thead className="bg-panel text-gray-400">
              <tr>
                <th className="px-4 py-3 font-medium">Symbol</th>
                <th className="px-4 py-3 text-right font-medium">Price</th>
                <th className="px-4 py-3 text-right font-medium">Change</th>
                <th className="px-4 py-3 text-right font-medium">% Change</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {watchQuotes.map((q) => {
                const up = isUp(q.dp);
                return (
                  <tr key={q.symbol} className="bg-ink hover:bg-panel/60">
                    <td className="px-4 py-3 font-semibold text-white">
                      {q.symbol}
                    </td>
                    <td className="px-4 py-3 text-right nums">{usd(q.c)}</td>
                    <td
                      className={`px-4 py-3 text-right nums ${
                        up ? "text-up" : "text-down"
                      }`}
                    >
                      {usd(q.d)}
                    </td>
                    <td
                      className={`px-4 py-3 text-right nums ${
                        up ? "text-up" : "text-down"
                      }`}
                    >
                      {pct(q.dp)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
