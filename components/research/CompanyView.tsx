"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CompanyFinancials, StatementSet, LineValues } from "@/lib/research/edgar";
import type { Insights } from "@/lib/research/insights";
import type { Narrative } from "@/lib/research/narrative";
import {
  getServerWatchlistSnapshot,
  getWatchlistSnapshot,
  subscribeWatchlist,
} from "@/lib/research/watchlist";
import { shouldIgnoreShortcut, watchlistNavDelta } from "@/lib/research/keyboard";
import { fmtBig, fmtMoney, isRealNumber } from "./currency";
import LoadingScreen from "./LoadingScreen";
import StatementTable from "./StatementTable";
import Summary, { type AiSummary } from "./Summary";
import SearchBox from "./SearchBox";
import ThemeToggle from "./ThemeToggle";
import ChartsPanel from "./ChartsPanel";
import RatiosTable from "./RatiosTable";
import Compare from "./Compare";
import OwnershipPanel from "./OwnershipPanel";
import ValuationPanel from "./ValuationPanel";
import SegmentsPanel from "./SegmentsPanel";
import ScorecardCard from "./ScorecardCard";
import QualityOfEarnings from "./QualityOfEarnings";
import WhatChanged from "./WhatChanged";
import PeerStrip from "./PeerStrip";
import WatchButton from "./WatchButton";
import TearSheet from "./TearSheet";
import ConfidenceBadges from "./ConfidenceBadges";
import StreetVsReported from "./StreetVsReported";
import { recordRecent } from "./RecentCompanies";
import type { OwnershipPayload } from "@/lib/research/ownership";
import type { SegmentsPayload } from "@/lib/research/segments";
import type { ConfidenceReport } from "@/lib/research/confidence";
import { restatedPeriodEnds, type RestatementHit } from "@/lib/research/restatements";
import RestatementsCallout from "./RestatementsCallout";
import { detectSectorMode, sectorModeBanner } from "@/lib/research/sector-mode";
import {
  buildIfrsCoverageReport,
  ifrsCoverageLabel,
} from "@/lib/research/ifrs-tags";
import {
  btnToolbar,
  btnToolbarPrimary,
  btnSegmentedToolbar,
  btnSegmentedToolbarItem,
} from "./ui/buttonStyles";
import ResearchGuide from "./ResearchGuide";
import DataAsOf from "./DataAsOf";
import PeriodBasisNote from "./PeriodBasisNote";
import OverviewSection from "./OverviewSection";

function formatSessionTime(ms: number): string {
  try {
    return new Date(ms).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return new Date(ms).toISOString();
  }
}

interface Profile {
  sector: string | null;
  industry: string | null;
  sic: string | null;
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
  confidence?: ConfidenceReport;
  restatements?: RestatementHit[];
};

const MIN_LOADING_MS = 1500;

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "income", label: "Income" },
  { key: "balance", label: "Balance Sheet" },
  { key: "cashflow", label: "Cash Flow" },
  { key: "ratios", label: "Ratios" },
  { key: "valuation", label: "Valuation" },
  { key: "segments", label: "Segments" },
  { key: "ownership", label: "Ownership" },
  { key: "charts", label: "Charts" },
  { key: "compare", label: "Compare" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

const STATEMENT_INDEX: Record<string, number> = { income: 0, balance: 1, cashflow: 2 };

/** Restatement concepts that matter on each statement tab. Overview/ratios show all. */
const RESTATEMENT_KEYS_BY_TAB: Partial<Record<TabKey, readonly string[]>> = {
  income: ["revenue", "netIncome"],
  balance: ["totalAssets", "equity"],
  cashflow: ["ocf"],
};

function restatementsForTab(
  hits: RestatementHit[] | undefined,
  tab: TabKey
): RestatementHit[] {
  if (!hits?.length) return [];
  const keys = RESTATEMENT_KEYS_BY_TAB[tab];
  if (!keys) return hits;
  return hits.filter((h) => h.conceptKey != null && keys.includes(h.conceptKey));
}

function tabFromHash(): TabKey | null {
  if (typeof window === "undefined") return null;
  const h = window.location.hash.slice(1);
  // Compare may carry peers: `#compare?vs=msft,googl`. Other tabs stay bare keys.
  const key = h.split(/[?&]/, 1)[0] ?? "";
  return TABS.some((t) => t.key === key) ? (key as TabKey) : null;
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
  /** Structured empty-facts payload from /api/financials (foreign PDF-only FPIs). */
  const [noFacts, setNoFacts] = useState<{
    hint?: string;
    secSubmissionsUrl?: string;
  } | null>(null);
  const [summary, setSummary] = useState<AiSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [freq, setFreq] = useState<"annual" | "quarterly">("annual");
  const [tab, setTab] = useState<TabKey>(initialTab);
  const [compareLinkCopied, setCompareLinkCopied] = useState(false);
  const [ownership, setOwnership] = useState<OwnershipPayload | null>(null);
  const [segments, setSegments] = useState<SegmentsPayload | null>(null);
  /** When this browser session finished loading /api/financials (not SEC as-of). */
  const [loadedAt, setLoadedAt] = useState<number | null>(null);
  const [cacheStatus, setCacheStatus] = useState<string | null>(null);
  const navRef = useRef<HTMLElement>(null);
  const router = useRouter();
  const watchlist = useSyncExternalStore(
    subscribeWatchlist,
    getWatchlistSnapshot,
    getServerWatchlistSnapshot
  );

  useEffect(() => {
    let cancelled = false;
    const started = Date.now();
    // No reset needed here: the mount site passes key={ticker}, so a different
    // company remounts this component with fresh state. That key is what
    // prevents one company's financials rendering under another's name — if it
    // is ever removed, this effect must reset `data` and `error` instead.
    (async () => {
      try {
        const res = await fetch(`/api/research/financials/${cik}?ticker=${encodeURIComponent(ticker)}`);
        const json = await res.json();
        if (!res.ok) {
          if (json?.code === "NO_FACTS" || res.status === 404) {
            if (!cancelled) {
              setNoFacts({
                hint: typeof json.hint === "string" ? json.hint : undefined,
                secSubmissionsUrl:
                  typeof json.secSubmissionsUrl === "string"
                    ? json.secSubmissionsUrl
                    : `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${String(Number(cik))}&type=&dateb=&owner=include&count=40`,
              });
              setError(json.error ?? "No structured financials available");
            }
            return;
          }
          throw new Error(json.error ?? "Failed to load financials");
        }
        const wait = MIN_LOADING_MS - (Date.now() - started);
        if (wait > 0) await new Promise((r) => setTimeout(r, wait));
        if (!cancelled) {
          setData(json);
          // Client stamp: honest "as of this session", not SEC report date.
          setLoadedAt(Date.now());
          const xCache = res.headers.get("X-Cache");
          setCacheStatus(xCache ? xCache.toUpperCase() : null);
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

  // J/K or [/] → prev/next company on the user's watchlist (when this ticker is on it).
  useEffect(() => {
    const tickers = watchlist.map((e) => e.ticker.toUpperCase());
    const idx = tickers.indexOf(ticker.toUpperCase());
    if (idx < 0 || tickers.length < 2) return;

    function onKeyDown(e: KeyboardEvent) {
      if (shouldIgnoreShortcut(e)) return;
      const delta = watchlistNavDelta(e);
      if (delta == null) return;
      e.preventDefault();
      const next = tickers[(idx + delta + tickers.length) % tickers.length];
      router.push(`/members/research/${next.toLowerCase()}`);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [watchlist, ticker, router]);

  // The AI summary is a slow LLM call on its own route. It is fetched
  // independently so the statements render as soon as the financials land.
  useEffect(() => {
    let cancelled = false;
    // Same reasoning as above: key={ticker} guarantees a fresh mount per
    // company, so summary state starts empty without an explicit reset.
    (async () => {
      try {
        const res = await fetch(`/api/research/summary/${cik}?ticker=${encodeURIComponent(ticker)}`);
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

  // Prefetch heavy tabs once financials are up so Ownership / Segments feel instant.
  // Quick ownership first (institutions + politicians), then full Form 4s, plus segments.
  useEffect(() => {
    if (!data) return;
    let cancelled = false;
    const run = () => {
      const q = encodeURIComponent(ticker);
      fetch(`/api/research/ownership/${cik}?ticker=${q}&mode=quick`)
        .then((r) => (r.ok ? r.json() : null))
        .then((json) => {
          if (!cancelled && json) setOwnership(json as OwnershipPayload);
          // Enrich with Form 4s after the quick paint is cached client-side.
          return fetch(`/api/research/ownership/${cik}?ticker=${q}&mode=full`);
        })
        .then((r) => (r && r.ok ? r.json() : null))
        .then((json) => {
          if (!cancelled && json) setOwnership(json as OwnershipPayload);
        })
        .catch(() => {
          /* ownership tab will retry on demand */
        });

      fetch(`/api/research/segments/${cik}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((json) => {
          if (!cancelled && json) setSegments(json as SegmentsPayload);
        })
        .catch(() => {
          /* segments tab will retry on demand */
        });
    };
    let idleId: number | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      idleId = window.requestIdleCallback(run, { timeout: 4000 });
    } else {
      timer = setTimeout(run, 600);
    }
    return () => {
      cancelled = true;
      if (idleId != null && "cancelIdleCallback" in window) {
        window.cancelIdleCallback(idleId);
      }
      if (timer) clearTimeout(timer);
    };
  }, [data, cik, ticker]);

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
    // Preserve `#compare?vs=…` when re-selecting Compare so shareable peer
    // lists aren't wiped by a no-op tab click. Compare rewrites the hash when
    // peers change; other tabs always get a bare `#key`.
    if (t === "compare") {
      const h = window.location.hash.slice(1);
      if (h === "compare" || h.startsWith("compare?") || h.startsWith("compare&")) {
        return;
      }
    }
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
      <main className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          Couldn&apos;t load {name}
        </h1>
        <p className="max-w-md text-sm text-zinc-500 dark:text-zinc-400">{error}</p>
        {noFacts && (
          <div className="max-w-lg space-y-3 rounded-xl border border-zinc-200 bg-zinc-50 px-5 py-4 text-left text-sm dark:border-zinc-800 dark:bg-zinc-900/50">
            <p className="text-zinc-700 dark:text-zinc-300">
              {noFacts.hint ??
                "This company may be a foreign private issuer that files 20-F or 40-F reports as PDFs only, without machine-readable US-GAAP or IFRS companyfacts."}
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Structured statements require SEC XBRL companyfacts. You can still open the
              company&apos;s EDGAR submissions for the full PDF filings.
            </p>
            {noFacts.secSubmissionsUrl && (
              <a
                href={noFacts.secSubmissionsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex text-sm font-medium text-sky-700 underline-offset-2 hover:underline dark:text-sky-400"
              >
                Open SEC filings for CIK {cik} ↗
              </a>
            )}
          </div>
        )}
        <Link
          href="/members/research"
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Search another company
        </Link>
      </main>
    );
  }

  if (!data) return <LoadingScreen name={name} />;

  const set: StatementSet = freq === "annual" ? data.annual : data.quarterly;
  const profile = data.profile;
  const sectorMode = detectSectorMode(profile);
  const modeBanner = sectorModeBanner(sectorMode);
  const isStatementTab = tab === "income" || tab === "balance" || tab === "cashflow";
  const showFreqControls = isStatementTab || tab === "ratios";
  const tabRestatements = restatementsForTab(data.restatements, tab);
  const overviewRestatements = data.restatements ?? [];

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

  const showIfrsCoverage =
    data.usedIfrsFacts ||
    data.taxonomy === "ifrs-full" ||
    data.taxonomy === "mixed";
  const ifrsCoverage = showIfrsCoverage
    ? buildIfrsCoverageReport(data.ifrsLineKeys, data.taxonomy)
    : null;

  return (
    <main className="min-h-[100dvh]">
      <header className="no-print sticky top-0 z-20 border-b border-zinc-200 bg-white/95 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
        {/* Compact sticky bar: ticker stays visible on narrow screens while
            scrolling long statements. */}
        <div className="mx-auto flex max-w-[1400px] items-center gap-2 px-4 pt-2.5 sm:gap-4 sm:px-6 sm:pt-3">
          <Link
            href="/members/research"
            className="shrink-0 text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            <span className="sm:hidden" aria-hidden>
              &larr;
            </span>
            <span className="sr-only sm:not-sr-only sm:inline">&larr; New search</span>
          </Link>
          <div className="min-w-0 flex-1 md:hidden">
            <div className="flex min-w-0 items-center gap-2">
              <span className="shrink-0 rounded-md bg-zinc-900 px-1.5 py-0.5 font-mono text-[11px] font-bold text-white dark:bg-zinc-100 dark:text-zinc-900">
                {ticker}
              </span>
              <span className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-200">
                {data.name}
              </span>
            </div>
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
            <div className="w-full max-w-xs max-md:hidden">
              <SearchBox />
            </div>
            <ThemeToggle />
          </div>
        </div>
        <nav
          ref={navRef}
          className="mx-auto flex max-w-[1400px] gap-0.5 overflow-x-auto overscroll-x-contain px-4 [-ms-overflow-style:none] [scrollbar-width:none] sm:gap-1 sm:px-6 [&::-webkit-scrollbar]:hidden"
          aria-label="Company sections"
        >
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => selectTab(t.key)}
              aria-current={tab === t.key ? "page" : undefined}
              className={`shrink-0 whitespace-nowrap border-b-2 px-2.5 py-2 text-[13px] font-medium transition-colors sm:px-3 sm:py-2.5 sm:text-sm ${
                tab === t.key
                  ? "border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-100"
                  : "border-transparent text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <div className="mx-auto max-w-[1400px] px-4 pb-24 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4 pt-6 sm:gap-6 sm:pt-8">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <h1 className="text-2xl font-semibold tracking-tighter sm:text-3xl">
                {data.name}
              </h1>
              {/* Desktop/tablet: ticker lives next to the title. On mobile it is
                  already in the sticky header, so hide the duplicate badge. */}
              <span className="hidden rounded-md bg-zinc-900 px-2 py-1 font-mono text-xs font-bold text-white sm:inline-block dark:bg-zinc-100 dark:text-zinc-900">
                {ticker}
              </span>
              {isForeignCurrency && (
                <span
                  className="rounded-md border border-amber-500/60 bg-amber-50 px-2 py-1 font-mono text-xs font-bold text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                  title={`This company reports its financial statements in ${currency}, not US dollars.`}
                >
                  Reports in {currency}
                </span>
              )}
              {showIfrsCoverage && (
                <span
                  className="rounded-md border border-sky-500/50 bg-sky-50 px-2 py-1 text-xs font-semibold text-sky-900 dark:bg-sky-950/40 dark:text-sky-200"
                  title={
                    data.taxonomy === "mixed"
                      ? `Mixed taxonomy: ${data.ifrsLineKeys?.length ?? 0} statement line(s) from IFRS-full companyfacts; remaining lines from US-GAAP where available.`
                      : `IFRS-full companyfacts: ${data.ifrsLineKeys?.length ?? 0} statement line(s) mapped (income, balance, cash flow). Coverage is still thinner than a full US-GAAP filer.`
                  }
                >
                  {ifrsCoverageLabel(data.ifrsLineKeys)}
                </span>
              )}
            </div>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              {[
                [profile.sector, profile.industry].filter(Boolean).join(", "),
                marketCapText,
                priceText,
              ]
                .filter(Boolean)
                .join("  ·  ") || `SEC CIK ${cik}`}
            </p>
            {ifrsCoverage && (
              <details className="no-print group mt-3 max-w-xl rounded-lg border border-sky-200/80 bg-sky-50/50 open:bg-sky-50 dark:border-sky-900 dark:bg-sky-950/30 dark:open:bg-sky-950/40">
                <summary className="cursor-pointer list-none px-3 py-2 text-xs font-medium text-sky-950 marker:content-none dark:text-sky-100 [&::-webkit-details-marker]:hidden">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="text-sky-600 transition-transform group-open:rotate-90 dark:text-sky-400">
                      ▸
                    </span>
                    IFRS coverage · {ifrsCoverage.mappedCount}/
                    {ifrsCoverage.attemptedCount} mapped
                    {ifrsCoverage.missingHighValue.length > 0
                      ? ` · ${ifrsCoverage.missingHighValue.length} high-value gap${ifrsCoverage.missingHighValue.length === 1 ? "" : "s"}`
                      : ""}
                  </span>
                </summary>
                <div className="space-y-2 border-t border-sky-200/70 px-3 py-2.5 text-xs dark:border-sky-900">
                  <p className="text-sky-900/80 dark:text-sky-200/80">
                    {data.taxonomy === "mixed"
                      ? "Mixed taxonomy: listed lines came from IFRS-full; other statement lines may still be US-GAAP."
                      : "IFRS-full companyfacts only — coverage is opportunistic vs a full US-GAAP filer."}
                  </p>
                  {ifrsCoverage.mapped.length > 0 && (
                    <div>
                      <p className="font-medium text-sky-950 dark:text-sky-100">
                        From IFRS
                      </p>
                      <p className="mt-0.5 leading-relaxed text-sky-900/90 dark:text-sky-200/90">
                        {ifrsCoverage.mapped.map((l) => l.label).join(" · ")}
                      </p>
                    </div>
                  )}
                  {ifrsCoverage.missingHighValue.length > 0 && (
                    <div>
                      <p className="font-medium text-amber-900 dark:text-amber-200">
                        High-value missing
                      </p>
                      <p className="mt-0.5 leading-relaxed text-amber-900/90 dark:text-amber-200/90">
                        {ifrsCoverage.missingHighValue.map((l) => l.label).join(" · ")}
                      </p>
                    </div>
                  )}
                </div>
              </details>
            )}
          </div>

          <div className="no-print flex flex-wrap items-center gap-2">
            <WatchButton ticker={ticker} name={data.name} cik={cik} />
            {watchlist.length >= 2 &&
              watchlist.some(
                (e) => e.ticker.toUpperCase() === ticker.toUpperCase()
              ) && (
                <span
                  className="hidden font-mono text-[10px] text-zinc-400 sm:inline dark:text-zinc-500"
                  title="Press J or ] for next watchlist company, K or [ for previous. Disabled while typing."
                >
                  J/K watchlist
                </span>
              )}
            {showFreqControls && (
              // Not tabs — this picks the reporting period for the panel below,
              // so it is a two-option group of toggle buttons.
              <div
                className={btnSegmentedToolbar}
                role="group"
                aria-label="Reporting period"
              >
                {(["annual", "quarterly"] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    aria-pressed={freq === f}
                    onClick={() => setFreq(f)}
                    className={btnSegmentedToolbarItem(freq === f)}
                  >
                    {f}
                  </button>
                ))}
              </div>
            )}
            {tab === "compare" && (
              <button
                type="button"
                onClick={() => {
                  try {
                    const url = window.location.href;
                    void navigator.clipboard.writeText(url).then(() => {
                      setCompareLinkCopied(true);
                      window.setTimeout(() => setCompareLinkCopied(false), 2000);
                    });
                  } catch {
                    // private mode / denied clipboard
                  }
                }}
                className={btnToolbar}
                title="Copy a bookmarkable compare link (#compare?vs=…)"
              >
                {compareLinkCopied ? "Link copied" : "Copy compare link"}
              </button>
            )}
            {tab === "overview" && (
              <button
                type="button"
                onClick={() => window.print()}
                className={btnToolbar}
                title="Print or save as PDF (browser print dialog)"
              >
                Print / PDF
              </button>
            )}
            <a
              href={`/api/research/excel/${cik}?ticker=${encodeURIComponent(ticker)}`}
              className={btnToolbarPrimary}
              download
            >
              <span className="sm:hidden">Excel</span>
              <span className="hidden sm:inline">Download Excel</span>
            </a>
          </div>
        </div>

        <div className="print-only mt-2 border-b border-zinc-300 pb-3 text-sm text-zinc-600">
          {ticker} · tear sheet · {new Date().toISOString().slice(0, 10)}
        </div>

        <div className="mt-8">
          {tab === "overview" && (
            <div className="mx-auto max-w-4xl space-y-3">
              {modeBanner && (
                <div
                  className="no-print rounded-xl border border-sky-300/70 bg-sky-50/80 px-4 py-3 dark:border-sky-800 dark:bg-sky-950/40"
                  role="status"
                >
                  <p className="text-sm font-semibold tracking-tight text-sky-950 dark:text-sky-100">
                    {modeBanner.title}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-sky-900/80 dark:text-sky-200/80">
                    {modeBanner.body}
                  </p>
                </div>
              )}
              {loadedAt != null && (
                <DataAsOf
                  className="no-print px-0.5"
                  items={[
                    {
                      label: "Session data",
                      at: loadedAt,
                      source: "SEC + market",
                    },
                  ]}
                />
              )}

              {/* 1 — Analyst read (open by default) */}
              <OverviewSection
                title="Analyst read"
                subtitle="Narrative from the filed numbers. Not investment advice."
                summary={summaryLoading ? "Loading…" : undefined}
                defaultOpen
              >
                <Summary
                  insights={data.insights}
                  narrative={data.narrative}
                  summary={summary}
                  loading={summaryLoading}
                  parts="analyst"
                  hideChrome
                />
              </OverviewSection>

              {/* 2 — What the numbers say */}
              <OverviewSection
                title="What the numbers say"
                subtitle="Growing, slowing, and catalysts from recent quarters."
                summary={
                  [
                    data.insights.growing.length
                      ? `${data.insights.growing.length} growing`
                      : null,
                    data.insights.slowing.length
                      ? `${data.insights.slowing.length} slowing`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "Insights"
                }
              >
                <Summary
                  insights={data.insights}
                  narrative={data.narrative}
                  summary={summary}
                  loading={summaryLoading}
                  parts="numbers"
                  hideChrome
                />
              </OverviewSection>

              {/* 3 — Street vs reported */}
              <OverviewSection
                title="Street vs reported"
                subtitle="Consensus estimates compared with as-filed results."
              >
                <div className="no-print">
                  <StreetVsReported
                    fin={data}
                    currency={priceCurrency}
                    embedded
                  />
                </div>
              </OverviewSection>

              {/* Everything else, collapsed */}
              <OverviewSection
                title="Since last visit"
                subtitle="What moved in the filings since you were here."
              >
                <div className="no-print">
                  <WhatChanged fin={data} mode={sectorMode} embedded />
                </div>
              </OverviewSection>

              <OverviewSection
                title="Quality scorecard"
                subtitle="Composite grade from margins, returns, and cash conversion."
              >
                <div className="print-sheet">
                  <ScorecardCard fin={data} mode={sectorMode} embedded />
                </div>
              </OverviewSection>

              <OverviewSection
                title="Quality of earnings"
                subtitle="Cash conversion, accruals, and earnings quality checks."
              >
                <div className="no-print">
                  <QualityOfEarnings
                    fin={data}
                    currency={currency}
                    maxCols={5}
                    mode={sectorMode}
                    embedded
                  />
                </div>
              </OverviewSection>

              <OverviewSection
                title="Peers"
                subtitle="Sector and industry comparables from filings."
              >
                <div className="no-print">
                  <PeerStrip
                    ticker={data.ticker}
                    cik={data.cik}
                    name={data.name}
                    sector={profile.sector}
                    industry={profile.industry}
                    marketCap={profile.marketCap}
                    mode={sectorMode}
                    embedded
                  />
                </div>
              </OverviewSection>

              <OverviewSection
                title="At a glance"
                subtitle="Tear sheet: valuation, segments, ownership highlights."
              >
                <div className="print-sheet">
                  <TearSheet
                    fin={data}
                    marketPrice={profile.price}
                    priceCurrency={priceCurrency}
                    sic={profile.sic ?? null}
                    segments={segments}
                    ownership={ownership}
                    confidence={data.confidence ?? null}
                    mode={sectorMode}
                    embedded
                  />
                </div>
              </OverviewSection>

              {data.confidence && (
                <OverviewSection
                  title="Data confidence"
                  subtitle="Coverage and quality of the SEC tag mapping."
                >
                  <div className="no-print">
                    <ConfidenceBadges
                      confidence={data.confidence}
                      embedded
                    />
                  </div>
                </OverviewSection>
              )}

              <OverviewSection
                title="Research guide"
                subtitle="Optional checklist for a full first pass."
              >
                <div className="no-print">
                  <ResearchGuide ticker={ticker} />
                </div>
              </OverviewSection>

              {overviewRestatements.length > 0 && (
                <div className="no-print pt-2">
                  <RestatementsCallout
                    hits={overviewRestatements}
                    cik={cik}
                    currency={currency}
                  />
                </div>
              )}
            </div>
          )}
          {isStatementTab && (
            /* key={tab}: showAll/commonSize must reset per statement — the
               common-size denominator differs between the balance sheet and the rest. */
            <div className="no-print space-y-3">
              <PeriodBasisNote freq={freq} />
              <StatementTable
                key={tab}
                statement={set.statements[STATEMENT_INDEX[tab]]}
                periods={set.periods}
                quarterly={freq === "quarterly"}
                denominator={denominator}
                denominatorLabel={denominatorLabel}
                currency={currency}
                cik={cik}
                restatedPeriodEnds={
                  tabRestatements.length
                    ? restatedPeriodEnds(tabRestatements)
                    : undefined
                }
              />
              {tabRestatements.length > 0 && (
                <RestatementsCallout
                  hits={tabRestatements}
                  cik={cik}
                  currency={currency}
                />
              )}
            </div>
          )}
          {tab === "ratios" && (
            <div className="no-print space-y-10">
              <PeriodBasisNote freq={freq} />
              <RatiosTable fin={data} freq={freq} maxCols={8} mode={sectorMode} />
              <QualityOfEarnings
                fin={data}
                freq={freq}
                showFreqToggle={false}
                maxCols={8}
                currency={currency}
                mode={sectorMode}
              />
              {overviewRestatements.length > 0 && (
                <RestatementsCallout
                  hits={overviewRestatements}
                  cik={cik}
                  currency={currency}
                />
              )}
            </div>
          )}
          {tab === "valuation" && (
            <div className="no-print">
              <ValuationPanel
                fin={data}
                marketPrice={profile.price}
                priceCurrency={priceCurrency}
                sic={profile.sic ?? null}
                cik={cik}
                sector={profile.sector}
                industry={profile.industry}
                marketCap={profile.marketCap}
                segmentsPayload={segments}
                loadedAt={loadedAt}
              />
            </div>
          )}
          {tab === "segments" && (
            <div className="no-print">
              <SegmentsPanel cik={cik} initialData={segments} />
            </div>
          )}
          {tab === "ownership" && (
            <div className="no-print">
              <OwnershipPanel cik={cik} ticker={ticker} initialData={ownership} />
            </div>
          )}
          {tab === "charts" && (
            <div className="no-print">
              <ChartsPanel fin={data} currency={currency} />
            </div>
          )}
          {tab === "compare" && (
            <div className="no-print">
              <Compare base={data} />
            </div>
          )}
        </div>

        <footer className="no-print mt-16 border-t border-zinc-200 pt-6 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          {loadedAt != null && (
            <p
              className="mb-2 text-[11px] text-zinc-400 dark:text-zinc-500"
              title="When this browser session finished loading statements from the API — not the SEC fiscal period end. Period labels on tables show report dates."
            >
              Statements loaded {formatSessionTime(loadedAt)}
              {" · "}
              as of {formatSessionTime(loadedAt)} this session
              {cacheStatus ? ` · cache ${cacheStatus}` : ""}
            </p>
          )}
          Data from SEC EDGAR filings (including Form 4 and Schedule 13G/D). Prices from
          Yahoo Finance / Twelve Data. Politician trades from STOCK Act disclosures.
          Values as reported by the company or filer. Nothing here is investment advice.
        </footer>
      </div>
    </main>
  );
}
