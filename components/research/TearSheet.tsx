"use client";

import { useMemo, type ReactNode } from "react";
import type { CompanyFinancials } from "@/lib/research/edgar";
import { buildScorecard } from "@/lib/research/excel-scorecard";
import { buildProjection, PROJECTION_YEARS } from "@/lib/research/excel-projection";
import { buildDcf } from "@/lib/research/excel-dcf";
import { sectorBeta } from "@/lib/research/dcf-sector";
import type { SegmentsPayload } from "@/lib/research/segments";
import type { OwnershipPayload } from "@/lib/research/ownership";
import type { ConfidenceReport } from "@/lib/research/confidence";
import type { SectorMode } from "@/lib/research/sector-mode";
import { fmtBig, fmtMoney } from "./currency";

function gradeTone(grade: string): string {
  if (grade === "A") return "bg-emerald-600 text-white dark:bg-emerald-500";
  if (grade === "B") return "bg-sky-600 text-white dark:bg-sky-500";
  if (grade === "C") return "bg-amber-500 text-white dark:bg-amber-500";
  if (grade === "D") return "bg-orange-600 text-white dark:bg-orange-500";
  if (grade === "F") return "bg-red-600 text-white dark:bg-red-500";
  return "bg-zinc-400 text-white";
}

function Chip({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      className="rounded-lg border-[0.5px] border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
    >
      {children}
    </a>
  );
}

export default function TearSheet({
  fin,
  marketPrice,
  priceCurrency = "USD",
  sic,
  segments,
  ownership,
  confidence,
  mode = "standard",
  embedded = false,
}: {
  fin: CompanyFinancials;
  marketPrice: number | null;
  priceCurrency?: string;
  sic: string | null;
  segments: SegmentsPayload | null;
  ownership: OwnershipPayload | null;
  confidence: ConfidenceReport | null;
  mode?: SectorMode;
  embedded?: boolean;
}) {
  const scorecard = useMemo(() => buildScorecard(fin, mode), [fin, mode]);

  const dcfSnap = useMemo(() => {
    const proj = buildProjection(fin, PROJECTION_YEARS);
    if (!proj) return null;
    const dcf = buildDcf(fin, proj, sectorBeta(sic), marketPrice);
    if (!dcf) return null;
    return dcf;
  }, [fin, sic, marketPrice]);

  const segmentSnap = useMemo(() => {
    const product =
      segments?.tables.find((t) => t.kind === "product") ??
      (segments?.history
        ? {
            rows: segments.history.rows,
            periods: segments.history.periods,
          }
        : null);
    if (!product) return null;
    const members = product.rows.filter(
      (r) =>
        !/^(net sales|total|revenue)/i.test(r.name) &&
        (r.values[0] ?? 0) > 0
    );
    if (members.length === 0) return null;
    const sorted = [...members].sort(
      (a, b) => (b.values[0] ?? 0) - (a.values[0] ?? 0)
    );
    const top = sorted[0];
    const services = members.find((r) => /service/i.test(r.name));
    return {
      topName: top.name,
      topPct: top.pctOfTotal[0],
      servicesPct: services?.pctOfTotal[0] ?? null,
      period: product.periods[0] ?? null,
      historyYears: segments?.history?.periods.length ?? product.periods.length,
    };
  }, [segments]);

  const insiderSnap = useMemo(() => {
    if (!ownership || ownership.insidersPending) return null;
    const s = ownership.insiders.summary;
    return {
      net90: s.netShares90d,
      buys: s.buys,
      sells: s.sells,
    };
  }, [ownership]);

  const currency = fin.currency || "USD";
  const upside =
    dcfSnap?.perShare != null && marketPrice != null && marketPrice > 0
      ? dcfSnap.perShare / marketPrice - 1
      : null;

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        {!embedded ? (
          <div>
            <h2 className="text-lg font-semibold tracking-tight">At a glance</h2>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Tear sheet from scorecard, valuation, segments, and ownership.
            </p>
          </div>
        ) : (
          <div />
        )}
        <div className="no-print flex flex-wrap gap-2">
          <Chip href="#valuation">Valuation</Chip>
          <Chip href="#segments">Segments</Chip>
          <Chip href="#ownership">Ownership</Chip>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Quality */}
        <div className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Quality grade
          </p>
          <div className="mt-2 flex items-center gap-3">
            <span
              className={`inline-flex h-11 w-11 items-center justify-center rounded-xl text-lg font-bold ${gradeTone(scorecard.grade)}`}
            >
              {scorecard.grade}
            </span>
            <div>
              <p className="font-mono text-lg font-semibold tabular-nums">
                {scorecard.composite != null
                  ? scorecard.composite.toFixed(0)
                  : "—"}
              </p>
              <p className="text-[10px] text-zinc-500">/ 100 composite</p>
            </div>
          </div>
        </div>

        {/* Valuation */}
        <div className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Model vs market
          </p>
          {dcfSnap?.perShare != null ? (
            <>
              <p className="mt-1 font-mono text-lg font-semibold tabular-nums">
                {fmtMoney(dcfSnap.perShare, currency)}
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {marketPrice != null
                  ? `Market ${fmtMoney(marketPrice, priceCurrency)}`
                  : "No market price"}
                {upside != null && (
                  <span
                    className={
                      upside >= 0
                        ? " text-emerald-700 dark:text-emerald-400"
                        : " text-red-700 dark:text-red-400"
                    }
                  >
                    {" "}
                    · {upside >= 0 ? "+" : ""}
                    {(upside * 100).toFixed(0)}%
                  </span>
                )}
              </p>
              {dcfSnap.reverse && (
                <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                  Market prices in{" "}
                  <span className="font-mono">
                    {(dcfSnap.reverse.impliedReturn * 100).toFixed(1)}%
                  </span>{" "}
                  implied return
                </p>
              )}
            </>
          ) : (
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              No DCF for this filer type
            </p>
          )}
        </div>

        {/* Segments */}
        <div className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Largest segment
          </p>
          {segmentSnap ? (
            <>
              <p className="mt-1 text-sm font-semibold leading-snug">
                {segmentSnap.topName}
              </p>
              <p className="font-mono text-lg font-semibold tabular-nums">
                {segmentSnap.topPct != null
                  ? segmentSnap.topPct.toFixed(1) + "%"
                  : "—"}
              </p>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                {segmentSnap.servicesPct != null
                  ? `Services ${segmentSnap.servicesPct.toFixed(1)}%`
                  : "No Services line"}
                {segmentSnap.historyYears > 1
                  ? ` · ${segmentSnap.historyYears}y mix`
                  : ""}
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              {segments === null
                ? "Loading segments…"
                : "No product breakdown tagged"}
            </p>
          )}
        </div>

        {/* Insiders + confidence */}
        <div className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Insider net ~90d
          </p>
          {insiderSnap ? (
            <>
              <p
                className={`mt-1 font-mono text-lg font-semibold tabular-nums ${
                  (insiderSnap.net90 ?? 0) > 0
                    ? "text-emerald-700 dark:text-emerald-400"
                    : (insiderSnap.net90 ?? 0) < 0
                      ? "text-red-700 dark:text-red-400"
                      : ""
                }`}
              >
                {insiderSnap.net90 == null
                  ? "—"
                  : (insiderSnap.net90 > 0 ? "+" : "") +
                    (Math.abs(insiderSnap.net90) >= 1e6
                      ? (insiderSnap.net90 / 1e6).toFixed(2) + "M"
                      : Math.abs(insiderSnap.net90) >= 1e3
                        ? (insiderSnap.net90 / 1e3).toFixed(1) + "K"
                        : String(Math.round(insiderSnap.net90)))}
              </p>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                {insiderSnap.buys} buys · {insiderSnap.sells} sells (recent Form 4s)
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              {ownership?.insidersPending
                ? "Form 4s loading…"
                : ownership === null
                  ? "Loading ownership…"
                  : "No recent Form 4s"}
            </p>
          )}
          {confidence && (
            <p className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">
              Data confidence{" "}
              <span className="font-mono font-medium text-zinc-700 dark:text-zinc-200">
                {confidence.score}
              </span>
              <span className="text-zinc-400"> · {confidence.grade}</span>
            </p>
          )}
        </div>
      </div>

      {dcfSnap?.enterpriseValue != null && (
        <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
          Enterprise value {fmtBig(dcfSnap.enterpriseValue, currency)} · WACC{" "}
          {(dcfSnap.wacc * 100).toFixed(1)}% · history-seeded model (edit on
          Valuation)
        </p>
      )}
    </section>
  );
}
