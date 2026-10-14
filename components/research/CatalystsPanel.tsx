"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Catalyst, CatalystKind, ShortInterestPrint } from "@/lib/research/catalysts";
import { prettyDay } from "@/lib/research/catalysts";
import type { MacroPrint } from "@/lib/research/macro-calendar";

const KIND_LABEL: Record<CatalystKind, string> = {
  Earnings: "Earnings",
  Deal: "Deal",
  Agreement: "Agreement",
  Leadership: "Leadership",
  Presentation: "Showing",
  Meeting: "Meeting",
  Accounting: "Accounting",
  Financing: "Financing",
  Offering: "Offering",
  Impairment: "Impairment",
  Restructuring: "Restructuring",
  Listing: "Listing",
  Control: "Control",
  Dividend: "Dividend",
  Governance: "Governance",
  Bankruptcy: "Bankruptcy",
  Other: "Event",
};

interface Payload {
  events: Catalyst[];
  notes: string[];
  macro: MacroPrint[];
  macroNote: string;
  shortInterest?: ShortInterestPrint | null;
}

function fmtShortShares(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  return Math.round(n).toLocaleString("en-US");
}

function shortInterestCopy(row: ShortInterestPrint): string {
  const change =
    row.changePct == null
      ? null
      : `${row.changePct > 0 ? "Up" : row.changePct < 0 ? "Down" : "Unchanged"} ${Math.abs(row.changePct * 100).toFixed(1)}% from ${row.priorSettlementDate ?? "the prior settlement"}`;
  const cover =
    row.daysToCover != null ? `${row.daysToCover.toFixed(1)} days to cover` : null;
  return [
    `${fmtShortShares(row.shares)} shares short as of ${row.settlementDate}`,
    change,
    cover,
  ]
    .filter(Boolean)
    .join(". ")
    .concat(".");
}

function printCell(value: string | null): string {
  return value ?? "—";
}

function MacroTable({ rows }: { rows: MacroPrint[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[36rem] text-left text-sm">
        <thead>
          <tr className="border-b border-zinc-200 text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
            <th className="py-2 pr-3 font-medium">When</th>
            <th className="py-2 pr-3 font-medium">Release</th>
            <th className="py-2 pr-3 text-right font-medium">Expectation</th>
            <th className="py-2 pr-3 text-right font-medium">Last</th>
            <th className="py-2 text-right font-medium">Actual</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/80"
            >
              <td className="py-2.5 pr-3 align-top font-mono text-xs whitespace-nowrap text-zinc-500 dark:text-zinc-400">
                <span className="block text-zinc-800 dark:text-zinc-200">
                  {prettyDay(row.date)}
                </span>
                <span className="block">{row.timeEt}</span>
              </td>
              <td className="py-2.5 pr-3 align-top text-zinc-900 dark:text-zinc-100">
                {row.title}
              </td>
              <td className="py-2.5 pr-3 text-right align-top font-mono text-xs tabular-nums text-zinc-800 dark:text-zinc-200">
                {printCell(row.forecast)}
              </td>
              <td className="py-2.5 pr-3 text-right align-top font-mono text-xs tabular-nums text-zinc-800 dark:text-zinc-200">
                {printCell(row.previous)}
              </td>
              <td className="py-2.5 text-right align-top font-mono text-xs tabular-nums text-zinc-800 dark:text-zinc-200">
                {printCell(row.actual)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EventList({ events }: { events: Catalyst[] }) {
  return (
    <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
      {events.map((event) => (
        <li key={event.id} className="flex items-baseline justify-between gap-3 py-2.5">
          <div className="min-w-0">
            <p className="text-sm text-zinc-900 dark:text-zinc-100">
              <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400">
                {prettyDay(event.date)}
              </span>
              <span className="mx-2 text-[10px] font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                {KIND_LABEL[event.kind]}
              </span>
              <span>{event.title}</span>
            </p>
            {event.detail && (
              <p className="mt-0.5 text-xs leading-snug text-zinc-500 dark:text-zinc-400">
                {event.detail}
              </p>
            )}
          </div>
          {event.url ? (
            <a
              href={event.url}
              target="_blank"
              rel="noopener noreferrer"
              className="w-14 shrink-0 text-right text-xs font-medium text-sky-700 underline underline-offset-2 hover:text-sky-900 dark:text-sky-400 dark:hover:text-sky-300"
            >
              Filing
            </a>
          ) : (
            <span className="w-14 shrink-0" aria-hidden />
          )}
        </li>
      ))}
    </ul>
  );
}

export default function CatalystsPanel({
  cik,
  ticker,
  sector,
  industry,
  sic,
}: {
  cik: string;
  ticker: string;
  sector: string | null;
  industry: string | null;
  sic: string | null;
}) {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    const qs = new URLSearchParams();
    if (ticker) qs.set("ticker", ticker);
    if (sector) qs.set("sector", sector);
    if (industry) qs.set("industry", industry);
    if (sic) qs.set("sic", sic);
    setData(null);
    setError(null);
    fetch(`/api/research/catalysts/${encodeURIComponent(cik)}?${qs.toString()}`, {
      signal: ctrl.signal,
    })
      .then(async (res) => {
        const json = (await res.json()) as Payload & { error?: string };
        if (!res.ok) throw new Error(json.error || "Could not load catalysts.");
        setData(json);
      })
      .catch((e: unknown) => {
        if (ctrl.signal.aborted) return;
        setError(e instanceof Error ? e.message : "Could not load catalysts.");
      });
    return () => ctrl.abort();
  }, [cik, ticker, sector, industry, sic]);

  if (error) {
    return <p className="text-sm text-red-700 dark:text-red-400">{error}</p>;
  }
  if (!data) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400" aria-busy="true">
        Loading catalysts…
      </p>
    );
  }

  const upcoming = data.events.filter((event) => event.when === "upcoming");
  const recent = data.events.filter((event) => event.when === "recent");

  return (
    <div className="space-y-6">
      {upcoming.length > 0 && (
        <section>
          <h3 className="text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Coming up
          </h3>
          <EventList events={upcoming} />
        </section>
      )}

      <section>
        <h3 className="text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Recently filed
        </h3>
        {recent.length > 0 ? (
          <EventList events={recent} />
        ) : (
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
            No material 8-Ks, 6-Ks, or similar filings in the last 15 months.
            A company that does not file those looks quiet here.
          </p>
        )}
      </section>

      {data.shortInterest && (
        <section>
          <h3 className="text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Short interest
          </h3>
          <p className="mt-2 text-sm text-zinc-900 dark:text-zinc-100">
            {shortInterestCopy(data.shortInterest)}
          </p>
          <p className="mt-1 text-xs leading-snug text-zinc-500 dark:text-zinc-400">
            Nasdaq settlement print of shares sold short.
          </p>
        </section>
      )}

      <section>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Macro
          </h3>
          <Link
            href="/members/research/calendar"
            className="text-xs font-medium text-sky-700 underline underline-offset-2 hover:text-sky-900 dark:text-sky-400 dark:hover:text-sky-300"
          >
            Full calendar
          </Link>
        </div>
        <p className="mt-1 text-xs leading-snug text-zinc-500 dark:text-zinc-400">
          {data.macroNote}
        </p>
        {data.macro.length > 0 ? (
          <div className="mt-3">
            <MacroTable rows={data.macro} />
          </div>
        ) : (
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
            No high-importance US releases on this week&apos;s calendar.
          </p>
        )}
      </section>

      {data.notes.length > 0 && (
        <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
          {data.notes.join(" ")}
        </p>
      )}
    </div>
  );
}
