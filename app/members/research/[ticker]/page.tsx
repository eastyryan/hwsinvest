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
      <main
        className="container-x"
        style={{
          display: "flex",
          minHeight: "60vh",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 14,
          textAlign: "center",
        }}
      >
        <h1 className="h-sub">Couldn&apos;t reach SEC EDGAR</h1>
        <p className="lede" style={{ maxWidth: "44ch", marginTop: 0 }}>
          The company directory didn&apos;t load, so we can&apos;t look up &ldquo;{upper}
          &rdquo; right now. This is usually temporary — try again in a moment.
        </p>
        <Link
          href={`/members/research/${upper.toLowerCase()}`}
          className="btn-primary"
          style={{ padding: "11px 18px", fontSize: 14.5 }}
        >
          Try again
        </Link>
      </main>
    );
  }

  if (!entry) {
    return (
      <main
        className="container-x"
        style={{
          display: "flex",
          minHeight: "60vh",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 14,
          textAlign: "center",
        }}
      >
        <h1 className="h-sub">Couldn&apos;t find &ldquo;{upper}&rdquo;</h1>
        <p className="lede" style={{ maxWidth: "44ch", marginTop: 0 }}>
          That ticker isn&apos;t in the SEC company directory. It may not be a US-listed
          company.
        </p>
        <Link
          href="/members/research"
          className="btn-primary"
          style={{ padding: "11px 18px", fontSize: 14.5 }}
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
