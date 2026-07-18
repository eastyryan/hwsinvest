"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Download } from "lucide-react";
import type { CompanyFinancials, StatementSet, LineValues } from "@/lib/research/edgar";
import type { Insights } from "@/lib/research/insights";
import { fmtMarketCap } from "@/lib/research/format";
import LoadingScreen from "./LoadingScreen";
import StatementTable from "./StatementTable";
import Summary from "./Summary";
import SearchBox from "./SearchBox";
import ChartsPanel from "./ChartsPanel";
import RatiosTable from "./RatiosTable";
import Compare from "./Compare";
import { recordRecent } from "./RecentCompanies";

interface Profile {
  sector: string | null;
  industry: string | null;
  marketCap: number | null;
  price: number | null;
}

type Payload = CompanyFinancials & {
  insights: Insights;
  aiSummary: string | null;
  profile: Profile;
};

const MIN_LOADING_MS = 1500;

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "income", label: "Income" },
  { key: "balance", label: "Balance Sheet" },
  { key: "cashflow", label: "Cash Flow" },
  { key: "ratios", label: "Ratios" },
  { key: "charts", label: "Charts" },
  { key: "compare", label: "Compare" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

const STATEMENT_INDEX: Record<string, number> = { income: 0, balance: 1, cashflow: 2 };

function initialTab(): TabKey {
  if (typeof window !== "undefined") {
    const h = window.location.hash.slice(1);
    if (TABS.some((t) => t.key === h)) return h as TabKey;
  }
  return "overview";
}

function findLine(set: StatementSet, key: string): LineValues | undefined {
  for (const st of set.statements) {
    const l = st.lines.find((l) => l.key === key);
    if (l) return l;
  }
  return undefined;
}

export default function CompanyView({
  cik,
  ticker,
  name,
}: {
  cik: string;
  ticker: string;
  name: string;
}) {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [freq, setFreq] = useState<"annual" | "quarterly">("annual");
  const [tab, setTab] = useState<TabKey>(initialTab);

  useEffect(() => {
    let cancelled = false;
    const started = Date.now();
    (async () => {
      try {
        const res = await fetch(
          `/api/research/financials/${cik}?ticker=${encodeURIComponent(ticker)}`
        );
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Failed to load financials");
        const wait = MIN_LOADING_MS - (Date.now() - started);
        if (wait > 0) await new Promise((r) => setTimeout(r, wait));
        if (!cancelled) {
          setData(json);
          recordRecent({ ticker, name });
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Something went wrong");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cik, ticker, name]);

  function selectTab(t: TabKey) {
    setTab(t);
    window.history.replaceState(null, "", `#${t}`);
  }

  if (error) {
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
        <h1 className="h-sub">Couldn&apos;t load {name}</h1>
        <p className="lede" style={{ maxWidth: "44ch", marginTop: 0 }}>
          {error}
        </p>
        <Link
          href="/members/research"
          className="btn-primary"
          style={{ padding: "11px 18px", fontSize: 14.5 }}
        >
          Search another company
        </Link>
      </main>
    );
  }

  if (!data) return <LoadingScreen name={name} />;

  const set: StatementSet = freq === "annual" ? data.annual : data.quarterly;
  const profile = data.profile;
  const isStatementTab = tab === "income" || tab === "balance" || tab === "cashflow";
  const showFreqControls = isStatementTab || tab === "ratios";

  const denominator =
    tab === "balance" ? findLine(set, "totalAssets") : findLine(set, "revenue");
  const denominatorLabel = tab === "balance" ? "total assets" : "revenue";

  const meta =
    [
      [profile.sector, profile.industry].filter(Boolean).join(", "),
      profile.marketCap != null ? fmtMarketCap(profile.marketCap) + " market cap" : null,
      profile.price != null
        ? "$" + profile.price.toLocaleString("en-US", { maximumFractionDigits: 2 })
        : null,
    ]
      .filter(Boolean)
      .join("  ·  ") || `SEC CIK ${cik}`;

  return (
    <main style={{ paddingBottom: 90 }}>
      <div className="rsch-bar">
        <div
          className="container-x"
          style={{ display: "flex", alignItems: "center", gap: 16, paddingTop: 11 }}
        >
          <Link
            href="/members/research"
            className="link-muted"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              fontSize: 13.5,
              fontWeight: 600,
              flexShrink: 0,
            }}
          >
            <ArrowLeft size={15} strokeWidth={2.2} /> New search
          </Link>
          <div style={{ marginLeft: "auto", width: "100%", maxWidth: 300 }}>
            <SearchBox />
          </div>
        </div>
        <nav className="container-x rsch-tabs" aria-label="Company sections">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => selectTab(t.key)}
              aria-current={tab === t.key ? "page" : undefined}
              className="rsch-tab"
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="container-x">
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: 22,
            paddingTop: 34,
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
              <h1 className="h-page" style={{ fontSize: "clamp(28px,4vw,40px)", margin: 0 }}>
                {data.name}
              </h1>
              <span className="rsch-tag">{ticker}</span>
            </div>
            <p style={{ margin: "9px 0 0", fontSize: 14.5, color: "var(--muted)" }}>{meta}</p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {showFreqControls && (
              <div className="rsch-seg">
                {(["annual", "quarterly"] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    aria-pressed={freq === f}
                    onClick={() => setFreq(f)}
                    style={{ textTransform: "capitalize" }}
                  >
                    {f}
                  </button>
                ))}
              </div>
            )}
            <a
              href={`/api/research/excel/${cik}?ticker=${encodeURIComponent(ticker)}`}
              className="ctl"
              download
            >
              <Download size={15} strokeWidth={2} /> Download Excel
            </a>
          </div>
        </div>

        <div style={{ marginTop: 34 }}>
          {tab === "overview" && (
            <Summary insights={data.insights} aiSummary={data.aiSummary} />
          )}
          {isStatementTab && (
            <StatementTable
              statement={set.statements[STATEMENT_INDEX[tab]]}
              periods={set.periods}
              quarterly={freq === "quarterly"}
              denominator={denominator}
              denominatorLabel={denominatorLabel}
            />
          )}
          {tab === "ratios" && <RatiosTable fin={data} freq={freq} maxCols={8} />}
          {tab === "charts" && <ChartsPanel fin={data} />}
          {tab === "compare" && <Compare base={data} />}
        </div>

        <footer
          style={{
            marginTop: 64,
            borderTop: "1px solid var(--line)",
            paddingTop: 22,
            fontSize: 12.5,
            lineHeight: 1.6,
            color: "var(--faint)",
          }}
        >
          Data from SEC EDGAR filings. Prices from Yahoo Finance / Twelve Data. Values as
          reported by the company. Nothing here is investment advice.
        </footer>
      </div>
    </main>
  );
}
