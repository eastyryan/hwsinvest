import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import SearchBox from "@/components/research/SearchBox";
import RecentCompanies from "@/components/research/RecentCompanies";

export const metadata = { title: "Company Research · HWS Investment Club" };

export default function ResearchPage() {
  return (
    <main
      className="container-x"
      style={{ padding: "clamp(32px,5vh,56px) 0 90px", maxWidth: 960, margin: "0 auto" }}
    >
      <Link
        href="/members"
        className="link-muted"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 7,
          fontSize: 13.5,
          fontWeight: 600,
        }}
      >
        <ArrowLeft size={15} strokeWidth={2.2} /> Dashboard
      </Link>

      <div style={{ marginTop: 26 }}>
        <p className="kicker">Research</p>
        <h1 className="h-page" style={{ fontSize: "clamp(30px,4vw,44px)" }}>
          Company Financials
        </h1>
        <p className="lede" style={{ maxWidth: "52ch" }}>
          Search any US-listed company and read its full financial history straight from SEC
          filings — income statement, balance sheet, cash flow, ratios, and charts.
        </p>
      </div>

      <div style={{ marginTop: 34 }}>
        <SearchBox large />
      </div>

      <RecentCompanies />

      <div
        style={{
          marginTop: 52,
          display: "grid",
          gap: 16,
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
        }}
      >
        {[
          {
            title: "Every filed period",
            body: "Annual and quarterly statements back to 2009, with YoY and QoQ change on each line and 3/5/10-year CAGRs.",
          },
          {
            title: "Ratios and comparisons",
            body: "Margins, returns, and leverage computed from the filings — then stack up to three companies side by side.",
          },
          {
            title: "Charts and export",
            body: "Chart any line item against price and fundamentals, or pull the whole history down as a formatted Excel workbook.",
          },
        ].map((f) => (
          <div key={f.title} className="card" style={{ padding: 20 }}>
            <div className="h-sub" style={{ fontSize: 17.5 }}>
              {f.title}
            </div>
            <p
              style={{
                margin: "8px 0 0",
                fontSize: 13.5,
                lineHeight: 1.55,
                color: "var(--muted)",
              }}
            >
              {f.body}
            </p>
          </div>
        ))}
      </div>

      <p className="rsch-note" style={{ marginTop: 34 }}>
        Data from SEC EDGAR filings. Values as reported by the company. Nothing here is
        investment advice.
      </p>
    </main>
  );
}
