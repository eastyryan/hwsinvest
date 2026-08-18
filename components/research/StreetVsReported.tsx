"use client";

import { useEffect, useMemo, useState } from "react";
import type { CompanyFinancials, StatementSet } from "@/lib/research/edgar";
import {
  alignYearlyWithReported,
  epsDispersionFromYearly,
  latestReportedEps,
  totalRevisionCounts,
  STREET_DISCLAIMER,
  type EpsOutcome,
  type StreetEstimates,
} from "@/lib/research/street-estimates";
import { fmtMoney } from "./currency";

function findLine(set: StatementSet, key: string) {
  for (const st of set.statements) {
    const l = st.lines.find((line) => line.key === key);
    if (l) return l;
  }
  return undefined;
}

function fmtEps(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const sign = n < 0 ? "−" : "";
  return `${sign}$${Math.abs(n).toFixed(2)}`;
}

function outcomeTone(o: EpsOutcome): string {
  if (o === "beat") return "text-emerald-700 dark:text-emerald-400";
  if (o === "miss") return "text-red-700 dark:text-red-400";
  return "text-zinc-600 dark:text-zinc-300";
}

function outcomeLabel(o: EpsOutcome): string {
  if (o === "beat") return "Beat";
  if (o === "miss") return "Miss";
  return "Inline";
}

function fmtSurprisePct(pct: number | null): string {
  if (pct == null || !Number.isFinite(pct)) return "—";
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

export default function StreetVsReported({
  fin,
  currency = "USD",
  embedded = false,
}: {
  fin: CompanyFinancials;
  currency?: string;
  /** Hide title when parent accordion already names the section. */
  embedded?: boolean;
}) {
  const [street, setStreet] = useState<StreetEstimates | null | undefined>(
    undefined
  );
  const [error, setError] = useState<string | null>(null);
  const loading = street === undefined;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/research/estimates/${encodeURIComponent(fin.ticker)}`
        );
        if (res.status === 404) {
          if (!cancelled) {
            setStreet(null);
            setError(null);
          }
          return;
        }
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Failed to load estimates");
        if (!cancelled) {
          setStreet(json.estimates ?? null);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setStreet(null);
          setError(
            e instanceof Error ? e.message : "Street estimates unavailable"
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fin.ticker]);

  const epsLine = useMemo(
    () => findLine(fin.annual, "epsDiluted"),
    [fin.annual]
  );

  const lastActual = useMemo(() => {
    if (!epsLine) return null;
    return latestReportedEps(fin.annual.periods, epsLine.values);
  }, [epsLine, fin.annual.periods]);

  const alignedYearly = useMemo(() => {
    if (!street?.yearlyEps.length || !epsLine) {
      return (
        street?.yearlyEps.map((y) => ({
          fiscalEnd: y.fiscalEnd,
          consensus: y.consensus,
          high: y.high,
          low: y.low,
          nEstimates: y.nEstimates,
          revisionsUp: y.revisionsUp,
          revisionsDown: y.revisionsDown,
          reportedEps: null as number | null,
          reportedLabel: null as string | null,
          canClaimBeatMiss: false as const,
        })) ?? []
      );
    }
    return alignYearlyWithReported(
      street.yearlyEps,
      fin.annual.periods,
      epsLine.values
    );
  }, [street, epsLine, fin.annual.periods]);

  const surprises = street?.surprises ?? [];
  const hasStreetData =
    street != null &&
    (surprises.length > 0 ||
      street.yearlyEps.length > 0 ||
      street.priceTarget != null);

  const dispersion = useMemo(
    () => (street?.yearlyEps?.length ? epsDispersionFromYearly(street.yearlyEps) : []),
    [street]
  );
  const revisionTotals = useMemo(
    () =>
      street?.yearlyEps?.length
        ? totalRevisionCounts(street.yearlyEps)
        : { up: 0, down: 0, hasAny: false },
    [street]
  );
  const nearDispersion = dispersion[0] ?? null;

  return (
    <section className="space-y-3">
      {!embedded && (
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            Street vs reported
          </h2>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Quarterly beat/miss from free Nasdaq consensus vs reported EPS.
            Forward annual figures are estimates only — beat/miss is never claimed
            without both actual and pre-report consensus. {STREET_DISCLAIMER}
          </p>
        </div>
      )}

      {loading && (
        <div className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-5 dark:border-zinc-800 dark:bg-zinc-900/40">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Loading street estimates…
          </p>
        </div>
      )}

      {!loading && !hasStreetData && (
        <div className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-5 dark:border-zinc-800 dark:bg-zinc-900/40">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {error ||
              "No free street estimates or earnings surprises for this ticker (API blocked or coverage missing)."}
          </p>
          {lastActual && (
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
              Latest reported diluted EPS ({lastActual.label}):{" "}
              <span className="font-mono tabular-nums">
                {fmtEps(lastActual.eps)}
              </span>
            </p>
          )}
        </div>
      )}

      {!loading && hasStreetData && street && (
        <div className="space-y-4">
          <p className="text-[11px] leading-snug text-zinc-500 dark:text-zinc-400">
            {street.disclaimer ?? STREET_DISCLAIMER}
          </p>
          {/* Context strip: last actual + price target */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Latest reported diluted EPS
              </p>
              <p className="mt-1 font-mono text-xl font-semibold tabular-nums">
                {lastActual ? fmtEps(lastActual.eps) : "—"}
              </p>
              <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                {lastActual
                  ? `${lastActual.label} · from filings`
                  : "No annual diluted EPS in filings"}
              </p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Street price target
              </p>
              <p className="mt-1 font-mono text-xl font-semibold tabular-nums">
                {street.priceTarget != null
                  ? fmtMoney(street.priceTarget, currency)
                  : "—"}
              </p>
              <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                {street.priceTargetLow != null &&
                street.priceTargetHigh != null
                  ? `Range ${fmtMoney(street.priceTargetLow, currency)}–${fmtMoney(street.priceTargetHigh, currency)}`
                  : street.meanRating
                    ? `Mean rating: ${street.meanRating}`
                    : "Consensus target"}
              </p>
            </div>
            {surprises[0] && (
              <div className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
                <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  Last quarter vs street
                </p>
                <p
                  className={`mt-1 font-mono text-xl font-semibold tabular-nums ${outcomeTone(surprises[0].outcome)}`}
                >
                  {outcomeLabel(surprises[0].outcome)}{" "}
                  <span className="text-base font-medium">
                    {fmtSurprisePct(surprises[0].surprisePct)}
                  </span>
                </p>
                <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                  {surprises[0].fiscalPeriod}: actual{" "}
                  <span className="font-mono">
                    {fmtEps(surprises[0].actualEps)}
                  </span>{" "}
                  vs est.{" "}
                  <span className="font-mono">
                    {fmtEps(surprises[0].consensusEps)}
                  </span>
                </p>
              </div>
            )}
          </div>

          {/* Historical quarterly surprises */}
          {surprises.length > 0 ? (
            <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
              <table className="w-full min-w-[28rem] text-left text-sm">
                <caption className="sr-only">
                  Quarterly EPS actual versus consensus
                </caption>
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50 text-xs font-medium text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-400">
                    <th className="px-4 py-2.5 font-medium">Fiscal quarter</th>
                    <th className="px-4 py-2.5 font-medium">Reported</th>
                    <th className="px-4 py-2.5 font-medium text-right">
                      Actual EPS
                    </th>
                    <th className="px-4 py-2.5 font-medium text-right">
                      Consensus
                    </th>
                    <th className="px-4 py-2.5 font-medium text-right">
                      Surprise
                    </th>
                    <th className="px-4 py-2.5 font-medium text-right">
                      Result
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {surprises.map((row) => (
                    <tr
                      key={`${row.fiscalPeriod}-${row.dateReported ?? ""}`}
                      className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/80"
                    >
                      <td className="px-4 py-2.5 font-medium">
                        {row.fiscalPeriod}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-zinc-500 dark:text-zinc-400">
                        {row.dateReported ?? "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                        {fmtEps(row.actualEps)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums text-zinc-600 dark:text-zinc-300">
                        {fmtEps(row.consensusEps)}
                      </td>
                      <td
                        className={`px-4 py-2.5 text-right font-mono tabular-nums ${outcomeTone(row.outcome)}`}
                      >
                        {fmtSurprisePct(row.surprisePct)}
                      </td>
                      <td
                        className={`px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide ${outcomeTone(row.outcome)}`}
                      >
                        {outcomeLabel(row.outcome)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              No historical quarterly surprises from the free API for this
              ticker. Forward estimates below are not labeled beat/miss.
            </p>
          )}

          {/* Consensus dispersion + revision counts (honest labels) */}
          {nearDispersion && (
            <div className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold tracking-tight text-zinc-800 dark:text-zinc-100">
                    Consensus dispersion
                    {revisionTotals.hasAny ? " & revisions" : ""}
                  </p>
                  <p className="mt-0.5 max-w-[70ch] text-[11px] leading-snug text-zinc-500 dark:text-zinc-400">
                    High/low is the range of current analyst estimates — not a
                    multi-period revision history.{" "}
                    {revisionTotals.hasAny
                      ? "Up/down counts are Nasdaq’s snapshot of how many estimates moved higher or lower since their prior print."
                      : "True prior-consensus time series is not on free endpoints."}
                  </p>
                </div>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-zinc-500">
                    Near year ({nearDispersion.fiscalEnd || "FY"})
                  </p>
                  <p className="mt-0.5 font-mono text-sm tabular-nums">
                    {fmtEps(nearDispersion.consensus)}
                    <span className="ml-1 text-xs text-zinc-500">
                      consensus
                    </span>
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-zinc-500">
                    High / low range
                  </p>
                  <p className="mt-0.5 font-mono text-sm tabular-nums">
                    {nearDispersion.low != null || nearDispersion.high != null
                      ? `${fmtEps(nearDispersion.low)} – ${fmtEps(nearDispersion.high)}`
                      : "—"}
                  </p>
                  {nearDispersion.rangePct != null && (
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                      Spread {(nearDispersion.rangePct * 100).toFixed(1)}% of
                      consensus
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-zinc-500">
                    # estimates
                  </p>
                  <p className="mt-0.5 font-mono text-sm tabular-nums">
                    {nearDispersion.nEstimates != null
                      ? nearDispersion.nEstimates
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-zinc-500">
                    Revisions (up / down)
                  </p>
                  <p className="mt-0.5 font-mono text-sm tabular-nums">
                    {revisionTotals.hasAny
                      ? `${revisionTotals.up} ↑ / ${revisionTotals.down} ↓`
                      : "—"}
                  </p>
                  <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                    {revisionTotals.hasAny
                      ? "Summed across forward years shown"
                      : "Not provided by free feed"}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Forward annual consensus */}
          {alignedYearly.length > 0 && (
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800">
              <div className="border-b border-zinc-200 px-4 py-2.5 dark:border-zinc-800">
                <p className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
                  Forward annual consensus EPS
                </p>
                <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                  Street forecast for upcoming fiscal years. Reported column
                  fills only when a filed annual period shares the same end
                  year — still not labeled beat/miss (pre-report consensus is
                  unavailable free). High/low is dispersion, not a revision
                  path.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[28rem] text-left text-sm">
                  <thead>
                    <tr className="border-b border-zinc-100 text-xs font-medium text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                      <th className="px-4 py-2 font-medium">Fiscal year end</th>
                      <th className="px-4 py-2 font-medium text-right">
                        Consensus
                      </th>
                      <th className="px-4 py-2 font-medium text-right">
                        High / low
                      </th>
                      <th className="px-4 py-2 font-medium text-right">
                        Reported (filed)
                      </th>
                      <th className="px-4 py-2 font-medium text-right">
                        # est.
                      </th>
                      <th className="px-4 py-2 font-medium text-right">
                        Rev ↑/↓
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {alignedYearly.map((y) => (
                      <tr
                        key={y.fiscalEnd}
                        className="border-b border-zinc-50 last:border-0 dark:border-zinc-900"
                      >
                        <td className="px-4 py-2 font-medium">
                          {y.fiscalEnd || "—"}
                        </td>
                        <td className="px-4 py-2 text-right font-mono tabular-nums">
                          {fmtEps(y.consensus)}
                        </td>
                        <td className="px-4 py-2 text-right font-mono text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
                          {y.high != null || y.low != null
                            ? `${fmtEps(y.low)} – ${fmtEps(y.high)}`
                            : "—"}
                        </td>
                        <td className="px-4 py-2 text-right font-mono tabular-nums text-zinc-600 dark:text-zinc-300">
                          {y.reportedEps != null ? (
                            <span title={y.reportedLabel ?? undefined}>
                              {fmtEps(y.reportedEps)}
                              {y.reportedLabel ? (
                                <span className="ml-1 text-[10px] text-zinc-400">
                                  {y.reportedLabel}
                                </span>
                              ) : null}
                            </span>
                          ) : (
                            <span className="text-zinc-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-right font-mono text-xs tabular-nums text-zinc-500">
                          {y.nEstimates != null ? y.nEstimates : "—"}
                        </td>
                        <td className="px-4 py-2 text-right font-mono text-xs tabular-nums text-zinc-500">
                          {y.revisionsUp != null || y.revisionsDown != null
                            ? `${y.revisionsUp ?? 0}/${y.revisionsDown ?? 0}`
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <p className="text-[10px] leading-snug text-zinc-500 dark:text-zinc-400">
            Source: {street.source} (unofficial)
            {surprises.length > 0 ? " · Nasdaq earnings surprise" : ""}.{" "}
            {street.disclaimer ?? STREET_DISCLAIMER} Quarterly beat/miss uses
            both actual and consensus from the surprise feed. Annual rows are
            forward estimates; filed EPS is context only. Revision ↑/↓ are
            snapshot counts, not a full estimate history.
          </p>
        </div>
      )}
    </section>
  );
}
