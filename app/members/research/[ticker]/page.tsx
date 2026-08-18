import Link from "next/link";
import { getTickerDirectory } from "@/lib/research/edgar";
import CompanyView from "@/components/research/CompanyView";

export async function generateMetadata({ params }: { params: { ticker: string } }) {
  return { title: `${params.ticker.toUpperCase()} · Research · HWS Investment Club` };
}

export default async function CompanyPage({ params }: { params: { ticker: string } }) {
  const upper = params.ticker.toUpperCase();

  // A directory failure and an unlisted ticker are different situations, and
  // reporting an SEC outage as "this company doesn't exist" is a confidently
  // wrong answer. They're tracked separately so the page can say which happened.
  let entry = null;
  let directoryFailed = false;
  try {
    const dir = await getTickerDirectory();
    entry = dir.find((e) => e.ticker === upper) ?? null;
  } catch {
    directoryFailed = true;
  }

  if (directoryFailed) {
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center gap-3 px-4 text-center">
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          Couldn&apos;t reach SEC EDGAR
        </h1>
        <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          The company directory didn&apos;t load, so we can&apos;t look up &ldquo;{upper}
          &rdquo; right now. This is usually temporary. Try again in a moment.
        </p>
        <Link
          href={`/members/research/${upper.toLowerCase()}`}
          className="mt-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Try again
        </Link>
      </main>
    );
  }

  if (!entry) {
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center gap-3 px-4 text-center">
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          Couldn&apos;t find &ldquo;{upper}&rdquo;
        </h1>
        <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          That ticker isn&apos;t in the SEC company directory. It may not be a US-listed
          company.
        </p>
        <Link
          href="/members/research"
          className="mt-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Search again
        </Link>
      </main>
    );
  }

  // key={ticker} forces a remount on company -> company navigation so the
  // previous company's fetched data can never render under the new name.
  return (
    <CompanyView
      key={entry.ticker}
      cik={entry.cik}
      ticker={entry.ticker}
      name={entry.name}
    />
  );
}
