"use client";

import { useEffect, useId, useState } from "react";
import type { CompanyFinancials } from "@/lib/research/edgar";
import { foundedYearFromDescription } from "@/lib/research/company-logo";
import { OPEN_CARD_BODY_CLASS, OPEN_CARD_CLASS } from "./OverviewSection";
import {
  buildCompanySnapshot,
  type AvgStat,
  type CompanySnapshot as Snapshot,
} from "@/lib/research/company-snapshot";
import type { StreetEstimates } from "@/lib/research/street-estimates";
import { fmtBig, fmtMoney } from "./currency";

export interface SnapshotProfile {
  sector: string | null;
  industry: string | null;
  description?: string | null;
  descriptionUrl?: string | null;
  website?: string | null;
  employees?: number | null;
  ceo?: string | null;
  headquarters?: string | null;
  founded?: number | null;
  marketCap: number | null;
  marketCapCurrency: string;
  marketCapIsDerived: boolean;
  price: number | null;
  priceCurrency: string | null;
}

function pct(value: number | null, digits = 1): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const n = value * 100;
  const abs = Math.abs(n);
  const body = abs >= 100 ? n.toFixed(0) : n.toFixed(digits);
  return body + "%";
}

function multiple(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  return value.toFixed(abs >= 100 ? 0 : 1);
}

function money(value: number | null, currency: string, derived = false): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return (derived ? "~" : "") + fmtBig(value, currency);
}

function shares(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  if (abs >= 1e9) return (abs / 1e9).toFixed(2) + "B";
  if (abs >= 1e6) return (abs / 1e6).toFixed(2) + "M";
  return abs.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function count(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return Math.round(value).toLocaleString("en-US");
}

function perShare(value: number | null, currency: string): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return fmtMoney(value, currency, value >= 100 ? 0 : 2);
}

function returnsTitle(stats: AvgStat[]): string {
  const years = stats.map((s) => s.years).filter((n) => n > 0);
  if (years.length === 0) return "Returns";
  const shortest = Math.min(...years);
  const widest = Math.max(...years);
  if (shortest === widest) return `Returns (${widest}yr avg)`;
  return `Returns (up to ${widest}yr)`;
}

type StatItem = { label: string; value: string; title?: string };

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[12px] text-zinc-500 dark:text-zinc-400">{label}</dt>
      <dd className="mt-0.5 text-sm text-zinc-900 dark:text-zinc-100">{value}</dd>
    </div>
  );
}

const cardClass =
  "rounded-xl border border-zinc-200 bg-white px-4 py-4 dark:border-zinc-800 dark:bg-zinc-950 sm:px-5";

function Band({ title, hint, items }: { title: string; hint?: string; items: StatItem[] }) {
  return (
    <div className="border-t border-zinc-200 py-3 dark:border-zinc-800">
      <h3 className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100" title={hint}>
        {title}
      </h3>
      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
        {items.map((item) => (
          <div key={item.label} className="min-w-0" title={item.title}>
            <dt className="text-[11px] leading-4 text-zinc-500 dark:text-zinc-400">{item.label}</dt>
            <dd className="mt-0.5 font-mono text-[13px] tabular-nums text-zinc-900 dark:text-zinc-100">
              {item.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function forwardEps(street: StreetEstimates): number | null {
  const now = Date.now() - 30 * 86_400_000;
  const upcoming = street.yearlyEps.find((row) => {
    const t = Date.parse(row.fiscalEnd);
    return Number.isFinite(t) && t >= now;
  });
  return (upcoming ?? street.yearlyEps[0])?.consensus ?? null;
}

export default function CompanySnapshot({
  fin,
  profile,
  currency,
}: {
  fin: CompanyFinancials;
  name: string;
  profile: SnapshotProfile;
  currency: string;
}) {
  const headingId = useId();
  const [street, setStreet] = useState<StreetEstimates | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/research/estimates/${encodeURIComponent(fin.ticker)}`)
      .then(async (res) => {
        if (res.status === 404) return null;
        const json = await res.json();
        if (!res.ok) return null;
        return (json.estimates ?? null) as StreetEstimates | null;
      })
      .then((estimates) => {
        if (!cancelled) setStreet(estimates);
      })
      .catch(() => {
        if (!cancelled) setStreet(null);
      });
    return () => {
      cancelled = true;
    };
  }, [fin.ticker]);

  const snap: Snapshot = buildCompanySnapshot(fin, {
    price: profile.price,
    priceCurrency: profile.priceCurrency,
    marketCap: profile.marketCap,
    marketCapCurrency: profile.marketCapCurrency,
    filingCurrency: currency,
  });

  const priceCcy = profile.priceCurrency || currency;
  const nextEps = street ? forwardEps(street) : null;
  const forwardPe =
    snap.multiplesOk && profile.price != null && nextEps != null && nextEps > 0
      ? profile.price / nextEps
      : null;
  const growthHop = street?.epsGrowthPath[0] ?? null;
  const peg =
    forwardPe != null && growthHop != null && growthHop > 0
      ? forwardPe / (growthHop * 100)
      : null;
  const ltGrowth =
    street && street.epsGrowthPath.length > 0
      ? street.epsGrowthPath.reduce((sum, g) => sum + g, 0) / street.epsGrowthPath.length
      : null;

  const description = profile.description?.trim() || "";
  const founded =
    typeof profile.founded === "number" && Number.isFinite(profile.founded)
      ? profile.founded
      : foundedYearFromDescription(description);

  const valuationTitle =
    snap.flowBasis === "ttm" ? "Valuation (TTM)" : "Valuation (latest year)";

  const dividendGrowth: StatItem[] = [
    { label: "DPS growth 3Yr", value: pct(snap.dividends.growth3) },
    { label: "DPS growth 5Yr", value: pct(snap.dividends.growth5) },
    { label: "DPS growth 10Yr", value: pct(snap.dividends.growth10) },
  ].filter((item) => item.value !== "—");

  return (
    <>
    <section aria-labelledby={headingId} className={`${cardClass} ${OPEN_CARD_CLASS}`}>
      <h2 id={headingId} className="shrink-0 text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        About the company
      </h2>
      <div
        tabIndex={0}
        aria-labelledby={headingId}
        className={`mt-4 ${OPEN_CARD_BODY_CLASS}`}
      >
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
          <Fact label="Headquarters" value={profile.headquarters?.trim() || "—"} />
          <Fact label="Founded" value={founded != null ? String(founded) : "—"} />
          <Fact label="Sector" value={profile.sector?.trim() || "—"} />
          <Fact label="CEO" value={profile.ceo?.trim() || "—"} />
        </dl>
        <div className="mt-4">
          {description ? (
            <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
              {description}
            </p>
          ) : (
            <p className="text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
              No company description is on file.
            </p>
          )}
          {profile.descriptionUrl && (
            <p className="mt-3 text-[11px] text-zinc-400 dark:text-zinc-500">
              <a
                href={profile.descriptionUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline-offset-2 hover:underline"
              >
                Wikipedia
              </a>
              {" · "}
              <a
                href="https://creativecommons.org/licenses/by-sa/4.0/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline-offset-2 hover:underline"
              >
                CC BY-SA
              </a>
            </p>
          )}
        </div>
      </div>
    </section>

    <section aria-labelledby={`${headingId}-stats`} className={`${cardClass} ${OPEN_CARD_CLASS}`}>
      <div className="flex shrink-0 items-center justify-between gap-3">
        <h2 id={`${headingId}-stats`} className="text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Company statistics
        </h2>
        <span className="rounded-md border border-emerald-700/30 bg-emerald-50 px-2 py-0.5 font-mono text-[11px] font-semibold tracking-wide text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-950/40 dark:text-emerald-300">
          {currency}
        </span>
      </div>

      {!snap.multiplesOk && profile.price != null && (
        <p className="mt-2 shrink-0 text-xs text-amber-800 dark:text-amber-300">
          The quote is in {priceCcy} and the filings are in {currency}, so enterprise
          value and price multiples are left blank.
        </p>
      )}

      <div
        tabIndex={0}
        aria-labelledby={`${headingId}-stats`}
        className={`mt-2 ${OPEN_CARD_BODY_CLASS}`}
      >
        <Band
          title="Profile"
          items={[
            {
              label: "Market cap",
              value: money(snap.marketCap, profile.marketCapCurrency, profile.marketCapIsDerived),
              title: profile.marketCapIsDerived ? "Price times shares outstanding." : undefined,
            },
            { label: "EV", value: money(snap.enterpriseValue, currency) },
            { label: "Shares out", value: shares(snap.shares) },
            { label: "Revenue", value: money(snap.revenue, currency) },
            ...(profile.employees != null
              ? [{ label: "Employees", value: count(profile.employees) }]
              : []),
          ]}
        />
        <Band
          title={valuationTitle}
          items={[
            { label: "P/E", value: multiple(snap.valuation.pe) },
            { label: "P/B", value: multiple(snap.valuation.pb) },
            { label: "EV/Sales", value: multiple(snap.valuation.evSales) },
            { label: "EV/EBITDA", value: multiple(snap.valuation.evEbitda) },
            { label: "P/FCF", value: multiple(snap.valuation.pFcf) },
            { label: "EV/Gross profit", value: multiple(snap.valuation.evGrossProfit) },
          ]}
        />
        <Band
          title="Growth (CAGR)"
          items={[
            { label: "Rev 3Yr", value: pct(snap.growth.revenue3) },
            { label: "Rev 5Yr", value: pct(snap.growth.revenue5) },
            { label: "Rev 10Yr", value: pct(snap.growth.revenue10) },
            { label: "Dil EPS 3Yr", value: pct(snap.growth.eps3) },
            { label: "Dil EPS 5Yr", value: pct(snap.growth.eps5) },
            { label: "Dil EPS 10Yr", value: pct(snap.growth.eps10) },
            { label: "FCF 5Yr", value: pct(snap.growth.fcf5) },
            { label: "Shares 5Yr", value: pct(snap.growth.shares5) },
            { label: "EPS LT growth est", value: street === undefined ? "…" : pct(ltGrowth) },
          ]}
        />
        <Band
          title="Margins"
          items={[
            { label: "Gross", value: pct(snap.margins.gross) },
            { label: "EBITDA", value: pct(snap.margins.ebitda) },
            { label: "Operating", value: pct(snap.margins.operating) },
            { label: "Pre-tax", value: pct(snap.margins.pretax) },
            { label: "Net", value: pct(snap.margins.net) },
            { label: "FCF", value: pct(snap.margins.fcf) },
          ]}
        />
        <Band
          title="Valuation (forward)"
          hint="Forward P/E is the live price divided by Nasdaq's next yearly EPS consensus. PEG divides that P/E by the consensus growth rate in percent. That feed does not publish sales, EBITDA, or cash flow estimates."
          items={[
            {
              label: "Price target",
              value:
                street === undefined
                  ? "…"
                  : street?.priceTarget != null
                    ? fmtMoney(street.priceTarget, priceCcy)
                    : "—",
            },
            { label: "P/E", value: street === undefined ? "…" : multiple(forwardPe) },
            { label: "PEG", value: street === undefined ? "…" : multiple(peg) },
          ]}
        />
        <Band
          title="Dividends"
          items={[
            { label: "Yield", value: pct(snap.dividends.yield) },
            { label: "Payout", value: pct(snap.dividends.payout) },
            { label: "DPS", value: perShare(snap.dividends.dps, currency) },
            ...dividendGrowth,
          ]}
        />
        <Band
          title={returnsTitle([
            snap.returns.roa,
            snap.returns.rota,
            snap.returns.roe,
            snap.returns.roce,
            snap.returns.roic,
          ])}
          items={[
            { label: "ROA", value: pct(snap.returns.roa.avg) },
            { label: "ROTA", value: pct(snap.returns.rota.avg), title: "Operating income over average assets." },
            { label: "ROE", value: pct(snap.returns.roe.avg) },
            {
              label: "ROCE",
              value: pct(snap.returns.roce.avg),
              title: "Operating income over average equity plus debt.",
            },
            { label: "ROIC", value: pct(snap.returns.roic.avg) },
          ]}
        />
        <Band
          title="Financial health"
          items={[
            { label: "Cash", value: money(snap.health.cash, currency) },
            { label: "Net debt", value: money(snap.health.netDebt, currency) },
            { label: "Debt/Equity", value: multiple(snap.health.debtToEquity) },
            { label: "EBIT/Interest", value: multiple(snap.health.interestCoverage) },
          ]}
        />
      </div>
    </section>
    </>
  );
}
