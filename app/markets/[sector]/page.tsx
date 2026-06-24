import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import QuoteCard from "@/components/QuoteCard";
import SectionHeading from "@/components/SectionHeading";
import { sectors } from "@/data/sectors";
import { getQuotes } from "@/lib/finnhub";

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return sectors.map((s) => ({ sector: s.slug }));
}

export default async function SectorPage({
  params,
}: {
  params: { sector: string };
}) {
  const sector = sectors.find((s) => s.slug === params.sector);
  if (!sector) notFound();

  const symbols = [sector.etf, ...sector.holdings];
  const quotes = await getQuotes(symbols);
  const etfQuote = quotes.find((q) => q.symbol === sector.etf);
  const holdingQuotes = quotes.filter((q) => q.symbol !== sector.etf);

  return (
    <main className="mx-auto max-w-7xl px-6 py-12">
      <Link
        href="/markets"
        className="inline-flex items-center gap-1 text-sm text-gray-400 transition hover:text-hws-yellow"
      >
        <ArrowLeft className="h-4 w-4" /> Back to markets
      </Link>

      <div className="mt-4">
        <SectionHeading
          kicker={`${sector.etf} · Sector`}
          title={sector.name}
          sub={sector.blurb}
        />
      </div>

      {etfQuote && (
        <div className="max-w-sm">
          <QuoteCard quote={etfQuote} label={`${sector.name} ETF`} />
        </div>
      )}

      <div className="mt-12">
        <SectionHeading title="Representative holdings" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {holdingQuotes.map((q) => (
            <QuoteCard key={q.symbol} quote={q} />
          ))}
        </div>
      </div>
    </main>
  );
}
