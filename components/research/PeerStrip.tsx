"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CaretDown, UsersThree } from "@phosphor-icons/react";
import type { PeersPayload, PeerScorecard, PeerAverages } from "@/lib/research/peers";
import { fmtPct } from "@/lib/research/format";
import type { SectorMode } from "@/lib/research/sector-mode";
import { isGrossMarginMeaningful } from "@/lib/research/sector-mode";

function fmtMargin(v: number | null): string {
  if (v == null) return "—";
  return (v * 100).toFixed(1) + "%";
}

function fmtYoy(v: number | null): string {
  if (v == null) return "—";
  return fmtPct(v);
}

function MetricCell({
  label,
  value,
  format,
  inverted = false,
}: {
  label: string;
  value: number | null;
  format: "yoy" | "pct";
  /** Dark filled card (set avg) — use light muted labels. */
  inverted?: boolean;
}) {
  const text = format === "yoy" ? fmtYoy(value) : fmtMargin(value);
  let tone = "";
  if (format === "yoy" && value != null) {
    if (value > 0) tone = inverted ? "text-emerald-300" : "text-emerald-700 dark:text-emerald-400";
    else if (value < 0) tone = inverted ? "text-red-300" : "text-red-700 dark:text-red-400";
  }
  return (
    <div>
      <p
        className={`text-[10px] uppercase tracking-wide ${
          inverted ? "opacity-70" : "text-zinc-500 dark:text-zinc-500"
        }`}
      >
        {label}
      </p>
      <p className={`mt-0.5 font-mono text-xs tabular-nums ${tone}`}>{text}</p>
    </div>
  );
}

function PeerCard({
  card,
  averages,
  showGross,
}: {
  card: PeerScorecard;
  averages?: PeerAverages;
  showGross: boolean;
}) {
  const body = (
    <div
      className={`rounded-xl border px-3 py-3 transition-colors ${
        card.isSubject
          ? "border-zinc-900 bg-zinc-50 dark:border-zinc-100 dark:bg-zinc-900/60"
          : "border-zinc-200 bg-white hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-600"
      }`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-mono text-xs font-bold text-zinc-900 dark:text-zinc-100">
          {card.ticker}
        </span>
        {card.isSubject && (
          <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            You
          </span>
        )}
      </div>
      <p
        className="mt-0.5 truncate text-[11px] text-zinc-500 dark:text-zinc-400"
        title={card.name}
      >
        {card.name}
      </p>
      <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-1">
        <MetricCell label="Rev YoY" value={card.revYoy} format="yoy" />
        {showGross && (
          <MetricCell label="Gross m." value={card.grossMargin} format="pct" />
        )}
        <MetricCell label="Op m." value={card.opMargin} format="pct" />
        <MetricCell label="FCF m." value={card.fcfMargin} format="pct" />
      </div>
      {averages && card.opMargin != null && averages.opMargin != null && (
        <p
          className={`mt-2 text-[10px] ${
            card.opMargin >= averages.opMargin
              ? "text-emerald-700 dark:text-emerald-400"
              : "text-zinc-500 dark:text-zinc-400"
          }`}
        >
          Op margin{" "}
          {card.opMargin >= averages.opMargin ? "at/above" : "below"} set avg
        </p>
      )}
    </div>
  );

  if (card.isSubject) return body;
  return (
    <Link href={`/members/research/${card.ticker.toLowerCase()}`} className="block min-w-[9.5rem]">
      {body}
    </Link>
  );
}

function AvgCard({
  averages,
  showGross,
}: {
  averages: PeerAverages;
  showGross: boolean;
}) {
  return (
    <div className="rounded-xl border border-zinc-900 bg-zinc-900 px-3 py-3 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-mono text-xs font-bold">AVG</span>
        <span className="text-[10px] font-medium uppercase tracking-wide opacity-70">
          Sector peers
        </span>
      </div>
      <p className="mt-0.5 truncate text-[11px] opacity-80">
        Set avg (n={averages.n})
      </p>
      <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-1">
        <MetricCell label="Rev YoY" value={averages.revYoy} format="yoy" inverted />
        {showGross && (
          <MetricCell label="Gross m." value={averages.grossMargin} format="pct" inverted />
        )}
        <MetricCell label="Op m." value={averages.opMargin} format="pct" inverted />
        <MetricCell label="FCF m." value={averages.fcfMargin} format="pct" inverted />
      </div>
    </div>
  );
}

/**
 * Peer comparison strip — collapsed until the user clicks.
 * Loading SEC financials for 5 peers is intentional on-demand only.
 */
export default function PeerStrip({
  ticker,
  cik,
  name,
  sector,
  industry,
  marketCap = null,
  mode = "standard",
  /** When true (overview accordion), load peers without a nested expand control. */
  embedded = false,
}: {
  ticker: string;
  cik: string;
  name: string;
  sector: string | null;
  industry: string | null;
  /** Optional subject market cap for peer proximity ranking. */
  marketCap?: number | null;
  mode?: SectorMode;
  embedded?: boolean;
}) {
  const showGross = isGrossMarginMeaningful(mode);
  const [open, setOpen] = useState(embedded);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PeersPayload | null>(null);

  useEffect(() => {
    if (embedded) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once when embedded mounts
  }, [embedded, ticker, cik]);

  async function load() {
    if (data) {
      setOpen(true);
      return;
    }
    setLoading(true);
    setError(null);
    setOpen(true);
    try {
      const qs = new URLSearchParams();
      qs.set("cik", cik);
      qs.set("name", name);
      if (sector) qs.set("sector", sector);
      if (industry) qs.set("industry", industry);
      if (marketCap != null && marketCap > 0) {
        qs.set("marketCap", String(marketCap));
      }
      const res = await fetch(
        `/api/research/peers/${encodeURIComponent(ticker)}?${qs.toString()}`
      );
      const json = (await res.json()) as PeersPayload & { error?: string };
      if (!res.ok || json.error) {
        throw new Error(json.error ?? "Failed to load peers");
      }
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load peers");
    } finally {
      setLoading(false);
    }
  }

  function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    void load();
  }

  const labelBits = [industry, sector].filter(Boolean);
  const context =
    labelBits.length > 0 ? labelBits.join(" · ") : "large-cap reference set";

  const showBody = embedded || open;

  return (
    <section className="space-y-3">
      {!embedded && (
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          disabled={loading}
          className="group flex w-full items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-left transition-colors hover:border-zinc-400 hover:bg-zinc-50 disabled:opacity-70 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-600 dark:hover:bg-zinc-900"
        >
          <span className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
              <UsersThree size={18} weight="bold" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                {loading ? "Loading peers…" : "Compare to sector peers"}
              </span>
              <span className="block truncate text-xs text-zinc-500 dark:text-zinc-400">
                {context}
                {data
                  ? ` · ${data.cards.length} names + set avg`
                  : " · click to load (not automatic)"}
              </span>
            </span>
          </span>
          <CaretDown
            size={16}
            weight="bold"
            aria-hidden
            className={`shrink-0 text-zinc-400 transition-transform duration-200 ${
              open ? "rotate-180" : ""
            }`}
          />
        </button>
      )}

      {showBody && (
        <div className="space-y-3">
          {loading && !data && (
            <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-36 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800"
                />
              ))}
            </div>
          )}

          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
              {error}
            </p>
          )}

          {data && (
            <>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {data.cards.map((c) => (
                  <div key={c.ticker} className="min-w-[9.5rem] shrink-0">
                    <PeerCard card={c} averages={data.averages} showGross={showGross} />
                  </div>
                ))}
                <div className="min-w-[9.5rem] shrink-0">
                  <AvgCard averages={data.averages} showGross={showGross} />
                </div>
              </div>
              {data.notes[0] && (
                <p className="text-[11px] leading-snug text-zinc-500 dark:text-zinc-400">
                  {data.notes[0]}{" "}
                  {data.notes[1] ? (
                    <span className="text-zinc-400 dark:text-zinc-500">{data.notes[1]}</span>
                  ) : null}
                </p>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
