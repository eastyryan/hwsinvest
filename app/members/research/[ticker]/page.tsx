import Link from "next/link";
import { getTickerDirectory } from "@/lib/research/edgar";
import CompanyView from "@/components/research/CompanyView";

export async function generateMetadata({ params }: { params: { ticker: string } }) {
  return { title: `${params.ticker.toUpperCase()} · Research · HWS Investment Club` };
}

export default async function CompanyPage({ params }: { params: { ticker: string } }) {
  const upper = params.ticker.toUpperCase();
  let entry = null;
  try {
    const dir = await getTickerDirectory();
    entry = dir.find((e) => e.ticker === upper) ?? null;
  } catch {
    entry = null;
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

  return <CompanyView cik={entry.cik} ticker={entry.ticker} name={entry.name} />;
}
