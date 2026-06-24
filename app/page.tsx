import Link from "next/link";
import { ArrowRight, BarChart3, Landmark, Briefcase, Layers } from "lucide-react";
import Ticker from "@/components/Ticker";
import QuoteCard from "@/components/QuoteCard";
import SectionHeading from "@/components/SectionHeading";
import { getQuotes } from "@/lib/finnhub";
import { indices } from "@/data/sectors";

// Render at request time so quotes are fresh and the build doesn't depend on
// env vars being present.
export const dynamic = "force-dynamic";

export default async function Home() {
  const quotes = await getQuotes(indices.map((i) => i.symbol));

  const tiles = [
    {
      href: "/markets",
      icon: BarChart3,
      title: "Markets",
      desc: "Indices, movers, and our club watchlist.",
    },
    {
      href: "/markets",
      icon: Layers,
      title: "Sectors",
      desc: "Drill into Tech, Energy, Financials, and more.",
    },
    {
      href: "/economy",
      icon: Landmark,
      title: "Bonds & Economy",
      desc: "Treasury yields, the Fed, inflation, and jobs.",
    },
    {
      href: "/careers",
      icon: Briefcase,
      title: "Careers",
      desc: "Finance paths and how to break in.",
    },
  ];

  return (
    <main>
      {/* Hero */}
      <section className="relative isolate overflow-hidden">
        {/* Replace with a real campus photo at /public/campus.jpg.
            The gradient below is a tasteful fallback. */}
        <div
          className="absolute inset-0 -z-10 bg-cover bg-center"
          style={{ backgroundImage: "url('/campus.jpg')" }}
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-hws-purple/90 via-ink/85 to-ink" />
        <div className="mx-auto max-w-7xl px-6 py-28 sm:py-36">
          <p className="text-sm font-semibold uppercase tracking-widest text-hws-yellow">
            Hobart and William Smith Colleges
          </p>
          <h1 className="mt-3 max-w-3xl text-4xl font-bold leading-tight text-white sm:text-6xl">
            The HWS{" "}
            <span className="text-hws-orange">Investment Club</span>
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-gray-200">
            Live markets, hands-on research, and the career knowledge to get you
            from the Quad to Wall Street. Built by students, for students.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              href="/markets"
              className="inline-flex items-center gap-2 rounded-lg bg-hws-orange px-5 py-3 font-semibold text-ink transition hover:brightness-110"
            >
              Explore the Markets <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/about"
              className="inline-flex items-center gap-2 rounded-lg border border-line bg-panel/60 px-5 py-3 font-semibold text-white transition hover:border-hws-yellow"
            >
              Meet the Board
            </Link>
          </div>
        </div>
      </section>

      <Ticker />

      {/* Live indices */}
      <section className="mx-auto max-w-7xl px-6 py-16">
        <SectionHeading
          kicker="At a glance"
          title="Major U.S. indices"
          sub="Live snapshot via index-tracking ETFs. Updated continuously during market hours."
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {quotes.map((q) => {
            const label = indices.find((i) => i.symbol === q.symbol)?.label;
            return <QuoteCard key={q.symbol} quote={q} label={label} />;
          })}
        </div>
      </section>

      {/* Navigation tiles */}
      <section className="mx-auto max-w-7xl px-6 pb-20">
        <SectionHeading kicker="Dive in" title="Where do you want to go?" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {tiles.map((t) => (
            <Link
              key={t.title}
              href={t.href}
              className="group rounded-xl border border-line bg-panel p-6 transition hover:border-hws-orange"
            >
              <t.icon className="h-7 w-7 text-hws-yellow" />
              <p className="mt-4 text-lg font-semibold text-white">{t.title}</p>
              <p className="mt-1 text-sm text-gray-400">{t.desc}</p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm text-hws-orange opacity-0 transition group-hover:opacity-100">
                Open <ArrowRight className="h-4 w-4" />
              </span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
