"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Download } from "lucide-react";
import type { CompanyFinancials, StatementSet, LineValues } from "@/lib/research/edgar";
import type { Insights } from "@/lib/research/insights";
import type { Narrative } from "@/lib/research/narrative";
import { fmtBig, fmtMoney, isRealNumber } from "./currency";
import LoadingScreen from "./LoadingScreen";
import StatementTable from "./StatementTable";
import Summary, { type AiSummary } from "./Summary";
import SearchBox from "./SearchBox";
import ChartsPanel from "./ChartsPanel";
import RatiosTable from "./RatiosTable";
import Compare from "./Compare";
import { recordRecent } from "./RecentCompanies";

interface Profile {
  sector: string | null;
  industry: string | null;
  marketCap: number | null;
  marketCapCurrency: string;
  /** True when market cap is price x shares rather than a reported figure. */
  marketCapIsDerived: boolean;
  price: number | null;
  priceCurrency: string | null;
}

type Payload = CompanyFinancials & {
  insights: Insights;
  /** Deterministic read, computed server-side. Ships with the statements. */
  narrative: Narrative;
  profile: Profile;
  /** The filer's actual reporting currency — not always USD. */
  currency: string;
  sharesOutstanding: number | null;
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

function tabFromHash(): TabKey | null {
  if (typeof window === "undefined") return null;
  const h = window.location.hash.slice(1);
  return TABS.some((t) => t.key === h) ? (h as TabKey) : null;
}

function initialTab(): TabKey {
  return tabFromHash() ?? "overview";
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
  const [summary, setSummary] = useState<AiSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [freq, setFreq] = useState<"annual" | "quarterly">("annual");
  const [tab, setTab] = useState<TabKey>(initialTab);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    let cancelled = false;
    const started = Date.now();
    // No reset needed here: the mount site passes key={ticker}, so a different
    // company remounts this component with fresh state. That key is what
    // prevents one company's financials rendering under another's name — if it
    // is ever removed, this effect must reset `data` and `error` instead.
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

  // The AI summary is a slow LLM call on its own route. It is fetched
  // independently so the statements render as soon as the financials land.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/research/summary/${cik}?ticker=${encodeURIComponent(ticker)}`
        );
        if (!res.ok) throw new Error();
        const json: { summary: AiSummary | null } = await res.json();
        if (!cancelled) setSummary(json.summary ?? null);
      } catch {
        if (!cancelled) setSummary(null);
      } finally {
        if (!cancelled) setSummaryLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cik, ticker]);

  // The tab lives in the hash so a view is linkable. Reading it once at mount
  // is not enough: editing the hash, following an in-page link, or using
  // back/forward across hash entries all change the URL without remounting, and
  // the page would silently keep showing the old tab.
  useEffect(() => {
    function sync() {
      const t = tabFromHash();
      if (t) setTab(t);
    }
    window.addEventListener("hashchange", sync);
    window.addEventListener("popstate", sync);
    return () => {
      window.removeEventListener("hashchange", sync);
      window.removeEventListener("popstate", sync);
    };
  }, []);

  const selectTab = useCallback((t: TabKey) => {
    setTab(t);
    window.history.replaceState(null, "", `#${t}`);
  }, []);

  // The tab strip scrolls horizontally on narrow screens, so a deep link to
  // "Compare" would otherwise land with the active tab off-screen and no
  // indication that the strip scrolls at all.
  //
  // Adjusting `scrollLeft` by hand rather than calling scrollIntoView: the
  // strip lives inside the sticky header, and scrollIntoView walks *every*
  // scrollable ancestor, so it nudged the whole document down and tucked the
  // company name under the header on load.
  useEffect(() => {
    const nav = navRef.current;
    const el = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!nav || !el) return;
    const navBox = nav.getBoundingClientRect();
    const elBox = el.getBoundingClientRect();
    const pad = 24;
    if (elBox.left < navBox.left + pad) {
      nav.scrollLeft += elBox.left - navBox.left - pad;
    } else if (elBox.right > navBox.right - pad) {
      nav.scrollLeft += elBox.right - navBox.right + pad;
    }
  }, [tab, data]);

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

  // Filings are not always in USD. Say so rather than implying dollars.
  const currency = data.currency || "USD";
  const isForeignCurrency = currency !== "USD";
  const marketCapCurrency = profile.marketCapCurrency || "USD";
  const priceCurrency = profile.priceCurrency ?? marketCapCurrency;

  // A market cap of exactly 0 is never real — it means the shares-outstanding
  // input was missing, so price x shares collapsed. SPG shipped as
  // "~$0M USD market cap", which is worse than saying nothing.
  const marketCapText = isRealNumber(profile.marketCap)
    ? (profile.marketCapIsDerived ? "~" : "") +
      fmtBig(profile.marketCap, marketCapCurrency) +
      " market cap" +
      (profile.marketCapIsDerived ? " (est. from price × shares)" : "")
    : null;
  // A bare "226.79 USD" next to a market cap reads as another size figure.
  const priceText = isRealNumber(profile.price)
    ? `${fmtMoney(profile.price, priceCurrency)} per share`
    : null;

  const meta =
    [
      [profile.sector, profile.industry].filter(Boolean).join(", "),
      marketCapText,
      priceText,
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
        <nav ref={navRef} className="container-x rsch-tabs" aria-label="Company sections">
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
            <div
              style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 13 }}
            >
              <h1 className="h-page" style={{ fontSize: "clamp(28px,4vw,40px)", margin: 0 }}>
                {data.name}
              </h1>
              <span className="rsch-tag">{ticker}</span>
              {isForeignCurrency && (
                <span
                  className="rsch-tag-ghost"
                  title={`This company reports its financial statements in ${currency}, not US dollars.`}
                  style={{
                    borderColor: "var(--yellow)",
                    color: "var(--orangeText)",
                  }}
                >
                  Reports in {currency}
                </span>
              )}
            </div>
            <p style={{ margin: "9px 0 0", fontSize: 14.5, color: "var(--muted)" }}>{meta}</p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {showFreqControls && (
              // Not tabs — this picks the reporting period for the panel below,
              // so it is a two-option group of toggle buttons.
              <div className="rsch-seg" role="group" aria-label="Reporting period">
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
            <Summary
              insights={data.insights}
              narrative={data.narrative}
              summary={summary}
              loading={summaryLoading}
            />
          )}
          {isStatementTab && (
            /* key={tab}: showAll/commonSize must reset per statement — the
               common-size denominator differs between the balance sheet and the rest. */
            <StatementTable
              key={tab}
              statement={set.statements[STATEMENT_INDEX[tab]]}
              periods={set.periods}
              quarterly={freq === "quarterly"}
              denominator={denominator}
              denominatorLabel={denominatorLabel}
              currency={currency}
            />
          )}
          {tab === "ratios" && <RatiosTable fin={data} freq={freq} maxCols={8} />}
          {tab === "charts" && <ChartsPanel fin={data} currency={currency} />}
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
