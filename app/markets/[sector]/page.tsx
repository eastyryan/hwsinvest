import { notFound } from "next/navigation";
import Link from "next/link";
import QuoteCard from "@/components/QuoteCard";
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
    <main>
      <section style={{ background: "var(--bgDeep)", borderBottom: "1px solid var(--line)" }}>
        <div
          className="container-x"
          style={{ paddingTop: "clamp(44px,7vh,76px)", paddingBottom: "clamp(44px,7vh,76px)" }}
        >
          <Link
            href="/markets"
            className="link-muted mono"
            style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13 }}
          >
            ← Back to markets
          </Link>
          <p className="kicker" style={{ marginTop: 18 }}>
            {sector.etf} · Sector
          </p>
          <h1 className="h-page">{sector.name}</h1>
          <p className="lede">{sector.blurb}</p>
        </div>
      </section>

      {etfQuote && (
        <section className="container-x" style={{ paddingTop: "clamp(44px,6vh,72px)" }}>
          <div style={{ maxWidth: 340 }}>
            <QuoteCard quote={etfQuote} label={`${sector.name} ETF`} />
          </div>
        </section>
      )}

      <section className="container-x" style={{ paddingTop: "clamp(40px,5vh,56px)" }}>
        <h2 className="h-sub" style={{ marginBottom: 22 }}>
          Representative holdings
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
            gap: 16,
          }}
        >
          {holdingQuotes.map((q) => (
            <QuoteCard key={q.symbol} quote={q} />
          ))}
        </div>
      </section>
    </main>
  );
}
