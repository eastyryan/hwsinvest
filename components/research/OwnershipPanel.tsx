"use client";

import { useEffect, useState, type ReactNode } from "react";
import { CaretDown } from "@phosphor-icons/react";
import { btnSegmentedCompact, btnSegmentedCompactItem } from "./ui/buttonStyles";
import type {
  OwnershipPayload,
  InsiderTrade,
  InstitutionalHolding,
  PoliticianTrade,
  PersonShareChange,
  Side,
} from "@/lib/research/ownership";

function fmtShares(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  const sign = n < 0 ? "−" : "";
  if (abs >= 1e9) return sign + (abs / 1e9).toFixed(2) + "B";
  if (abs >= 1e6) return sign + (abs / 1e6).toFixed(2) + "M";
  if (abs >= 1e3) return sign + (abs / 1e3).toFixed(1) + "K";
  return sign + abs.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function fmtMoney(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  const sign = n < 0 ? "−" : "";
  if (abs >= 1e9) return sign + "$" + (abs / 1e9).toFixed(2) + "B";
  if (abs >= 1e6) return sign + "$" + (abs / 1e6).toFixed(2) + "M";
  if (abs >= 1e3) return sign + "$" + (abs / 1e3).toFixed(1) + "K";
  return sign + "$" + abs.toFixed(0);
}

function fmtPct(n: number | null | undefined, digits = 3): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const sign = n > 0 ? "+" : n < 0 ? "" : "";
  return sign + n.toFixed(digits) + "%";
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  // Prefer the raw ISO date so SSR and client match; Form 4 dates are YYYY-MM-DD.
  if (/^\d{4}-\d{2}-\d{2}/.test(iso)) return iso.slice(0, 10);
  return iso;
}

function sideClass(side: Side): string {
  if (side === "buy") return "text-emerald-700 dark:text-emerald-400";
  if (side === "sell") return "text-red-700 dark:text-red-400";
  return "text-zinc-500 dark:text-zinc-400";
}

function sideLabel(side: Side): string {
  if (side === "buy") return "Buy";
  if (side === "sell") return "Sell";
  return "Other";
}

function SidePill({ side }: { side: Side }) {
  const base =
    side === "buy"
      ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
      : side === "sell"
        ? "bg-red-50 text-red-800 dark:bg-red-950/50 dark:text-red-300"
        : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300";
  return (
    <span className={`inline-block rounded-md px-1.5 py-0.5 text-xs font-medium ${base}`}>
      {sideLabel(side)}
    </span>
  );
}

function StatCard({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "up" | "down" | "neutral";
}) {
  const toneClass =
    tone === "up"
      ? "text-emerald-700 dark:text-emerald-400"
      : tone === "down"
        ? "text-red-700 dark:text-red-400"
        : "text-zinc-900 dark:text-zinc-100";
  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
      <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className={`mt-1 font-mono text-lg font-semibold tracking-tight ${toneClass}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{hint}</p>}
    </div>
  );
}

function toneFromNet(n: number | null | undefined): "up" | "down" | "neutral" {
  if (n == null || n === 0) return "neutral";
  return n > 0 ? "up" : "down";
}

function PeopleTable({
  people,
  mode,
}: {
  people: PersonShareChange[];
  mode: "shares" | "dollars";
}) {
  if (people.length === 0) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">No holders to aggregate yet.</p>
    );
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">
          Share change by person. QoQ is ~90 days; YoY is ~365 days.
        </caption>
        <thead>
          <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/70">
            <th className="px-4 py-2.5 text-left font-medium text-zinc-500 dark:text-zinc-400">
              Name
            </th>
            <th className="px-4 py-2.5 text-left font-medium text-zinc-500 dark:text-zinc-400">
              Role
            </th>
            <th className="px-4 py-2.5 text-right font-medium text-zinc-500 dark:text-zinc-400">
              {mode === "shares" ? "Shares held" : "Trades"}
            </th>
            <th className="px-4 py-2.5 text-right font-medium text-zinc-500 dark:text-zinc-400">
              % of shares
            </th>
            <th className="px-4 py-2.5 text-right font-medium text-zinc-500 dark:text-zinc-400">
              {mode === "shares" ? "Net QoQ" : "Est. net QoQ $"}
            </th>
            <th className="px-4 py-2.5 text-right font-medium text-zinc-500 dark:text-zinc-400">
              {mode === "shares" ? "Net YoY" : "Est. net YoY $"}
            </th>
            <th className="px-4 py-2.5 text-right font-medium text-zinc-500 dark:text-zinc-400">
              % chg QoQ
            </th>
            <th className="px-4 py-2.5 text-right font-medium text-zinc-500 dark:text-zinc-400">
              % chg YoY
            </th>
          </tr>
        </thead>
        <tbody>
          {people.map((p) => (
            <tr
              key={p.name}
              className="border-b border-zinc-100 last:border-b-0 dark:border-zinc-800/60"
            >
              <th scope="row" className="px-4 py-2 text-left font-medium">
                {p.name}
              </th>
              <td className="px-4 py-2 text-zinc-500 dark:text-zinc-400">{p.role || "—"}</td>
              <td className="px-4 py-2 text-right font-mono tabular-nums">
                {mode === "shares" ? fmtShares(p.sharesHeld) : p.tradeCount}
              </td>
              <td className="px-4 py-2 text-right font-mono tabular-nums">
                {p.pctOfShares != null ? p.pctOfShares.toFixed(3) + "%" : "—"}
              </td>
              <td
                className={`px-4 py-2 text-right font-mono tabular-nums ${sideClass(
                  (p.netSharesQoQ ?? 0) > 0 ? "buy" : (p.netSharesQoQ ?? 0) < 0 ? "sell" : "other"
                )}`}
              >
                {mode === "shares"
                  ? fmtShares(p.netSharesQoQ)
                  : fmtMoney(p.netSharesQoQ)}
              </td>
              <td
                className={`px-4 py-2 text-right font-mono tabular-nums ${sideClass(
                  (p.netSharesYoY ?? 0) > 0 ? "buy" : (p.netSharesYoY ?? 0) < 0 ? "sell" : "other"
                )}`}
              >
                {mode === "shares"
                  ? fmtShares(p.netSharesYoY)
                  : fmtMoney(p.netSharesYoY)}
              </td>
              <td
                className={`px-4 py-2 text-right font-mono tabular-nums ${sideClass(
                  (p.pctChangeQoQ ?? 0) > 0 ? "buy" : (p.pctChangeQoQ ?? 0) < 0 ? "sell" : "other"
                )}`}
              >
                {fmtPct(p.pctChangeQoQ)}
              </td>
              <td
                className={`px-4 py-2 text-right font-mono tabular-nums ${sideClass(
                  (p.pctChangeYoY ?? 0) > 0 ? "buy" : (p.pctChangeYoY ?? 0) < 0 ? "sell" : "other"
                )}`}
              >
                {fmtPct(p.pctChangeYoY)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function InsiderTradesTable({ trades }: { trades: InsiderTrade[] }) {
  if (trades.length === 0) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        No recent Form 4 transactions found for this company.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">Recent insider Form 4 transactions.</caption>
        <thead>
          <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/70">
            <th className="px-4 py-2.5 text-left font-medium text-zinc-500 dark:text-zinc-400">
              Date
            </th>
            <th className="px-4 py-2.5 text-left font-medium text-zinc-500 dark:text-zinc-400">
              Insider
            </th>
            <th className="px-4 py-2.5 text-left font-medium text-zinc-500 dark:text-zinc-400">
              Side
            </th>
            <th className="px-4 py-2.5 text-left font-medium text-zinc-500 dark:text-zinc-400">
              Type
            </th>
            <th className="px-4 py-2.5 text-right font-medium text-zinc-500 dark:text-zinc-400">
              Shares
            </th>
            <th className="px-4 py-2.5 text-right font-medium text-zinc-500 dark:text-zinc-400">
              Price
            </th>
            <th className="px-4 py-2.5 text-right font-medium text-zinc-500 dark:text-zinc-400">
              Value
            </th>
            <th className="px-4 py-2.5 text-right font-medium text-zinc-500 dark:text-zinc-400">
              After
            </th>
          </tr>
        </thead>
        <tbody>
          {trades.map((t, i) => (
            <tr
              key={`${t.accession}-${t.date}-${t.transactionCode}-${i}`}
              className="border-b border-zinc-100 last:border-b-0 dark:border-zinc-800/60"
            >
              <td className="whitespace-nowrap px-4 py-2 font-mono text-xs tabular-nums">
                <a
                  href={t.filingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline-offset-2 hover:underline"
                >
                  {fmtDate(t.date)}
                </a>
              </td>
              <td className="px-4 py-2">
                <div className="font-medium">{t.name}</div>
                {t.role && (
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">{t.role}</div>
                )}
              </td>
              <td className="px-4 py-2">
                <SidePill side={t.side} />
              </td>
              <td className="px-4 py-2 text-zinc-600 dark:text-zinc-300">
                <span className="font-mono text-xs">{t.transactionCode}</span>
                <span className="ml-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                  {t.codeLabel}
                </span>
              </td>
              <td className="px-4 py-2 text-right font-mono tabular-nums">
                {fmtShares(t.shares)}
              </td>
              <td className="px-4 py-2 text-right font-mono tabular-nums">
                {t.price != null ? "$" + t.price.toFixed(2) : "—"}
              </td>
              <td className="px-4 py-2 text-right font-mono tabular-nums">
                {fmtMoney(t.value)}
              </td>
              <td className="px-4 py-2 text-right font-mono tabular-nums">
                {fmtShares(t.sharesAfter)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function InstitutionalTable({
  holdings,
  emptyMessage,
}: {
  holdings: InstitutionalHolding[];
  emptyMessage: string;
}) {
  if (holdings.length === 0) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">{emptyMessage}</p>
    );
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">Institutional ownership holdings.</caption>
        <thead>
          <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/70">
            <th className="px-4 py-2.5 text-left font-medium text-zinc-500 dark:text-zinc-400">
              As of
            </th>
            <th className="px-4 py-2.5 text-left font-medium text-zinc-500 dark:text-zinc-400">
              Shareholder
            </th>
            <th className="px-4 py-2.5 text-left font-medium text-zinc-500 dark:text-zinc-400">
              Source
            </th>
            <th className="px-4 py-2.5 text-right font-medium text-zinc-500 dark:text-zinc-400">
              Shares
            </th>
            <th className="px-4 py-2.5 text-right font-medium text-zinc-500 dark:text-zinc-400">
              % of shares
            </th>
            <th className="px-4 py-2.5 text-right font-medium text-zinc-500 dark:text-zinc-400">
              Δ shares
            </th>
            <th className="px-4 py-2.5 text-right font-medium text-zinc-500 dark:text-zinc-400">
              Δ % pts
            </th>
          </tr>
        </thead>
        <tbody>
          {holdings.map((h) => (
            <tr
              key={h.accession + h.name}
              className="border-b border-zinc-100 last:border-b-0 dark:border-zinc-800/60"
            >
              <td className="whitespace-nowrap px-4 py-2 font-mono text-xs tabular-nums">
                {h.filingUrl ? (
                  <a
                    href={h.filingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline-offset-2 hover:underline"
                  >
                    {fmtDate(h.filingDate)}
                  </a>
                ) : (
                  fmtDate(h.filingDate)
                )}
              </td>
              <td className="px-4 py-2 font-medium">{h.name}</td>
              <td className="px-4 py-2 font-mono text-xs text-zinc-500 dark:text-zinc-400">
                {h.form}
              </td>
              <td className="px-4 py-2 text-right font-mono tabular-nums">
                {fmtShares(h.shares)}
              </td>
              <td className="px-4 py-2 text-right font-mono tabular-nums">
                {h.pctOfClass != null ? h.pctOfClass.toFixed(2) + "%" : "—"}
              </td>
              <td
                className={`px-4 py-2 text-right font-mono tabular-nums ${sideClass(
                  (h.sharesChangeFromPrior ?? 0) > 0
                    ? "buy"
                    : (h.sharesChangeFromPrior ?? 0) < 0
                      ? "sell"
                      : "other"
                )}`}
              >
                {fmtShares(h.sharesChangeFromPrior)}
              </td>
              <td
                className={`px-4 py-2 text-right font-mono tabular-nums ${sideClass(
                  (h.pctChangeFromPrior ?? 0) > 0
                    ? "buy"
                    : (h.pctChangeFromPrior ?? 0) < 0
                      ? "sell"
                      : "other"
                )}`}
              >
                {fmtPct(h.pctChangeFromPrior, 2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PoliticianTable({ trades }: { trades: PoliticianTrade[] }) {
  if (trades.length === 0) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        No STOCK Act disclosures found for this ticker in the open dataset.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">Politician and official stock disclosures.</caption>
        <thead>
          <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/70">
            <th className="px-4 py-2.5 text-left font-medium text-zinc-500 dark:text-zinc-400">
              Date
            </th>
            <th className="px-4 py-2.5 text-left font-medium text-zinc-500 dark:text-zinc-400">
              Filer
            </th>
            <th className="px-4 py-2.5 text-left font-medium text-zinc-500 dark:text-zinc-400">
              Side
            </th>
            <th className="px-4 py-2.5 text-left font-medium text-zinc-500 dark:text-zinc-400">
              Type
            </th>
            <th className="px-4 py-2.5 text-right font-medium text-zinc-500 dark:text-zinc-400">
              Amount
            </th>
            <th className="px-4 py-2.5 text-left font-medium text-zinc-500 dark:text-zinc-400">
              Owner
            </th>
          </tr>
        </thead>
        <tbody>
          {trades.map((t, i) => (
            <tr
              key={`${t.name}-${t.date}-${t.transactionType}-${i}`}
              className="border-b border-zinc-100 last:border-b-0 dark:border-zinc-800/60"
            >
              <td className="whitespace-nowrap px-4 py-2 font-mono text-xs tabular-nums">
                {t.docUrl ? (
                  <a
                    href={t.docUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline-offset-2 hover:underline"
                  >
                    {fmtDate(t.date)}
                  </a>
                ) : (
                  fmtDate(t.date)
                )}
              </td>
              <td className="px-4 py-2">
                <div className="font-medium">{t.name}</div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400">
                  {[t.chamber, t.party, t.state].filter(Boolean).join(" · ") || "—"}
                </div>
              </td>
              <td className="px-4 py-2">
                <SidePill side={t.side} />
              </td>
              <td className="px-4 py-2 text-xs text-zinc-600 dark:text-zinc-300">
                {t.transactionType}
              </td>
              <td className="px-4 py-2 text-right font-mono text-xs tabular-nums">
                {t.amountLabel || fmtMoney(t.amountMid)}
              </td>
              <td className="px-4 py-2 text-xs text-zinc-500 dark:text-zinc-400">
                {t.owner || "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Collapsed-by-default block for nested ownership subsections. */
function ExpandableBlock({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
      >
        <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{title}</span>
        <CaretDown
          size={14}
          weight="bold"
          aria-hidden
          className={`shrink-0 text-zinc-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="space-y-3 border-t border-zinc-200 px-4 py-3 dark:border-zinc-800">
          {children}
        </div>
      )}
    </div>
  );
}

type OwnershipTab = "institutions" | "insiders" | "politicians";


/** Open-market purchase / sale only (Form 4 codes P and S). */
function isOpenMarket(t: InsiderTrade): boolean {
  return t.transactionCode === "P" || t.transactionCode === "S";
}

function filterInsiderPayload(
  data: OwnershipPayload,
  openMarketOnly: boolean
): OwnershipPayload {
  if (!openMarketOnly) return data;
  const trades = data.insiders.trades.filter(isOpenMarket);
  // Re-aggregate people from the filtered trade set client-side so the tables
  // stay consistent with the toggle (server still sends the full sample).
  const byName = new Map<
    string,
    {
      name: string;
      role: string | null;
      sharesHeld: number | null;
      net90: number;
      net365: number;
      count: number;
    }
  >();
  const now = Date.now();
  const day = 86_400_000;
  for (const t of trades) {
    const key = t.name.toLowerCase();
    let row = byName.get(key);
    if (!row) {
      row = {
        name: t.name,
        role: t.role,
        sharesHeld: t.sharesAfter,
        net90: 0,
        net365: 0,
        count: 0,
      };
      byName.set(key, row);
    }
    row.count++;
    if (row.sharesHeld == null && t.sharesAfter != null) row.sharesHeld = t.sharesAfter;
    const signed =
      t.shares == null
        ? 0
        : t.side === "buy"
          ? t.shares
          : t.side === "sell"
            ? -t.shares
            : 0;
    const age = now - Date.parse(t.date);
    if (Number.isFinite(age)) {
      if (age <= 95 * day) row.net90 += signed;
      if (age <= 370 * day) row.net365 += signed;
    }
  }
  const so =
    data.sharesOutstanding && data.sharesOutstanding > 0
      ? data.sharesOutstanding
      : null;
  const people = Array.from(byName.values())
    .map((r) => ({
      name: r.name,
      role: r.role,
      sharesHeld: r.sharesHeld,
      pctOfShares: so && r.sharesHeld != null ? (r.sharesHeld / so) * 100 : null,
      netSharesQoQ: r.net90 || null,
      netSharesYoY: r.net365 || null,
      pctChangeQoQ: so && r.net90 ? (r.net90 / so) * 100 : r.net90 === 0 ? 0 : null,
      pctChangeYoY: so && r.net365 ? (r.net365 / so) * 100 : r.net365 === 0 ? 0 : null,
      tradeCount: r.count,
    }))
    .sort((a, b) => Math.abs(b.netSharesYoY ?? 0) - Math.abs(a.netSharesYoY ?? 0));

  let buys = 0;
  let sells = 0;
  let other = 0;
  let net90 = 0;
  let net365 = 0;
  for (const t of trades) {
    if (t.side === "buy") buys++;
    else if (t.side === "sell") sells++;
    else other++;
    const signed =
      t.shares == null
        ? 0
        : t.side === "buy"
          ? t.shares
          : t.side === "sell"
            ? -t.shares
            : 0;
    const age = now - Date.parse(t.date);
    if (Number.isFinite(age)) {
      if (age <= 95 * day) net90 += signed;
      if (age <= 370 * day) net365 += signed;
    }
  }

  return {
    ...data,
    insiders: {
      trades,
      people,
      summary: {
        buys,
        sells,
        other,
        netShares90d: net90 || null,
        netShares365d: net365 || null,
        pctChange90d: so && net90 ? (net90 / so) * 100 : net90 === 0 ? 0 : null,
        pctChange365d: so && net365 ? (net365 / so) * 100 : net365 === 0 ? 0 : null,
      },
    },
  };
}

function ownershipUrl(cik: string, ticker: string, mode: "quick" | "full" | "deep") {
  return `/api/research/ownership/${cik}?ticker=${encodeURIComponent(ticker)}&mode=${mode}`;
}

export default function OwnershipPanel({
  cik,
  ticker,
  initialData = null,
}: {
  cik: string;
  ticker: string;
  /** Optional prefetched payload (e.g. from CompanyView idle prefetch). */
  initialData?: OwnershipPayload | null;
}) {
  const [fetched, setFetched] = useState<OwnershipPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openMarketOnly, setOpenMarketOnly] = useState(false);
  const [ownershipTab, setOwnershipTab] = useState<OwnershipTab>("institutions");
  const [insidersLoading, setInsidersLoading] = useState(false);
  // Prefer parent prefetch when it lands; otherwise use our own fetch.
  // Prefer fuller modes when merging quick → full → deep.
  const data = (() => {
    if (!initialData) return fetched;
    if (!fetched) return initialData;
    const rank = { quick: 0, full: 1, deep: 2 } as const;
    return rank[fetched.mode] >= rank[initialData.mode] ? fetched : initialData;
  })();
  const loading = !data && !error;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      // Progressive: paint institutions/politicians from a quick response,
      // then enrich with Form 4s. Skip quick if parent already prefetched full.
      const hasFull =
        initialData &&
        (initialData.mode === "full" || initialData.mode === "deep") &&
        !initialData.insidersPending;
      if (hasFull) return;

      try {
        if (!initialData || initialData.insidersPending || initialData.mode === "quick") {
          if (!initialData) {
            const quickRes = await fetch(ownershipUrl(cik, ticker, "quick"));
            const quickJson = await quickRes.json();
            if (!quickRes.ok) throw new Error(quickJson.error ?? "Failed to load ownership");
            if (!cancelled) setFetched(quickJson);
          }
          if (!cancelled) setInsidersLoading(true);
          const fullRes = await fetch(ownershipUrl(cik, ticker, "full"));
          const fullJson = await fullRes.json();
          if (!fullRes.ok) throw new Error(fullJson.error ?? "Failed to load insiders");
          if (!cancelled) {
            setFetched(fullJson);
            setInsidersLoading(false);
          }
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Something went wrong");
          setInsidersLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [cik, ticker, initialData]);

  if (loading) {
    return (
      <div className="space-y-4" role="status" aria-live="polite">
        <div className="h-4 w-48 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/40"
            />
          ))}
        </div>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Loading shareholders and disclosures&hellip;
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50/60 p-5 dark:border-red-900/50 dark:bg-red-950/20">
        <p className="text-sm font-medium text-red-800 dark:text-red-300">
          Couldn&apos;t load ownership activity
        </p>
        <p className="mt-1 text-sm text-red-700/80 dark:text-red-400/80">{error}</p>
      </div>
    );
  }

  if (!data) return null;

  const view = filterInsiderPayload(data, openMarketOnly);
  const { insiders, institutions, politicians } = view;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Ownership activity</h2>
        <p className="mt-1 max-w-[75ch] text-xs text-zinc-500 dark:text-zinc-400">
          Insider Form 4 trades, large institutional beneficial owners (13G/D), and
          politician STOCK Act disclosures — with net share or estimated dollar change
          over the last quarter (~90d) and year (~365d). Not investment advice.
        </p>
        {data.sharesOutstanding != null && (
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            Shares outstanding basis:{" "}
            <span className="font-mono">{fmtShares(data.sharesOutstanding)}</span>
          </p>
        )}
      </div>

      {/* Full-width category tabs */}
      <div
        className="grid grid-cols-1 gap-2 sm:grid-cols-3"
        role="tablist"
        aria-label="Ownership categories"
      >
        {(
          [
            ["institutions", "Institutions", `≥${institutions.summary.thresholdPct ?? 1}% holders`],
            ["insiders", "Insiders", "Form 4 activity"],
            ["politicians", "Politicians", "STOCK Act"],
          ] as const
        ).map(([key, label, hint]) => {
          const active = ownershipTab === key;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={active}
              id={`ownership-tab-${key}`}
              aria-controls={`ownership-panel-${key}`}
              onClick={() => setOwnershipTab(key)}
              className={`flex min-h-[4.5rem] flex-col items-start justify-center rounded-xl border-2 px-4 py-3 text-left transition-colors ${
                active
                  ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                  : "border-zinc-900 bg-white text-zinc-900 hover:bg-zinc-50 dark:border-zinc-100 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900"
              }`}
            >
              <span className="text-base font-semibold tracking-tight sm:text-lg">{label}</span>
              <span
                className={`mt-0.5 text-xs ${
                  active ? "text-zinc-300 dark:text-zinc-600" : "text-zinc-500 dark:text-zinc-400"
                }`}
              >
                {hint}
              </span>
            </button>
          );
        })}
      </div>

      {ownershipTab === "institutions" && (
        <div
          id="ownership-panel-institutions"
          role="tabpanel"
          aria-labelledby="ownership-tab-institutions"
          className="space-y-3"
        >
          <p className="max-w-[75ch] text-xs text-zinc-500 dark:text-zinc-400">
            Every institutional holder reported at or above 1% of shares outstanding, primarily from
            13F holdings data. Δ shares / Δ % pts is the change vs the prior reported period for that
            holder. Related funds under the same complex can appear as separate lines.
          </p>
          <ExpandableBlock title="Summary stats">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <StatCard
                label={`Holders ≥${institutions.summary.thresholdPct ?? 1}%`}
                value={String(institutions.summary.filerCount)}
              />
              <StatCard
                label="Sum of ≥1% stakes"
                value={
                  institutions.summary.latestTotalPct != null
                    ? institutions.summary.latestTotalPct.toFixed(1) + "%"
                    : "—"
                }
                hint="Can double-count related entities"
              />
              <StatCard
                label="Total institutional ownership"
                value={
                  institutions.summary.totalInstitutionalPct != null
                    ? institutions.summary.totalInstitutionalPct.toFixed(1) + "%"
                    : "—"
                }
                hint="All institutions, not just ≥1%"
              />
            </div>
          </ExpandableBlock>
          <ExpandableBlock title="Position change by shareholder">
            <PeopleTable people={institutions.people} mode="shares" />
          </ExpandableBlock>
          <ExpandableBlock title={`Holdings ≥${institutions.summary.thresholdPct ?? 1}%`}>
            <InstitutionalTable
              holdings={institutions.holdings}
              emptyMessage="No institutional holders at or above 1% of shares outstanding were found for this ticker."
            />
          </ExpandableBlock>
          {(institutions.filings13g?.length ?? 0) > 0 && (
            <ExpandableBlock title="Schedule 13G / 13D filings">
              <p className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">
                Beneficial-ownership statements filed with the SEC (typically ≥5% holders). Complements
                the 13F list above.
              </p>
              <InstitutionalTable
                holdings={institutions.filings13g}
                emptyMessage="No recent Schedule 13G/D filings with parseable ownership detail."
              />
            </ExpandableBlock>
          )}
        </div>
      )}

      {ownershipTab === "insiders" && (
        <div
          id="ownership-panel-insiders"
          role="tabpanel"
          aria-labelledby="ownership-tab-insiders"
          className="space-y-3"
        >
          <p className="max-w-[75ch] text-xs text-zinc-500 dark:text-zinc-400">
            Officers, directors, and 10% owners from recent SEC Form 4 filings (latest ~28 per company
            under SEC rate limits — not every Form 4 ever filed). Net QoQ/YoY counts share-changing
            transactions; toggle open-market only to hide awards, tax withholding, and exercises.
          </p>
          {(insidersLoading || data.insidersPending) && (
            <p
              role="status"
              className="rounded-lg border border-zinc-200 bg-zinc-50/80 px-3 py-2 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-400"
            >
              Loading Form 4 filings in the background&hellip; institutions and politicians are ready
              now.
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <div
              className={btnSegmentedCompact}
              role="group"
              aria-label="Insider trade filter"
            >
              {(
                [
                  [false, "All Form 4"],
                  [true, "Open market only"],
                ] as const
              ).map(([om, label]) => (
                <button
                  key={label}
                  type="button"
                  aria-pressed={openMarketOnly === om}
                  onClick={() => setOpenMarketOnly(om)}
                  className={btnSegmentedCompactItem(openMarketOnly === om)}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Open market = Form 4 codes P (buy) and S (sell)
            </p>
          </div>
          <ExpandableBlock title="Summary stats">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="Buys"
                value={String(insiders.summary.buys)}
                hint="In recent Form 4 filings loaded"
              />
              <StatCard
                label="Sells"
                value={String(insiders.summary.sells)}
                hint="In recent Form 4 filings loaded"
              />
              <StatCard
                label="Net shares ~90d"
                value={fmtShares(insiders.summary.netShares90d)}
                hint={
                  insiders.summary.pctChange90d != null
                    ? `${fmtPct(insiders.summary.pctChange90d)} of shares out.`
                    : undefined
                }
                tone={toneFromNet(insiders.summary.netShares90d)}
              />
              <StatCard
                label="Net shares ~365d"
                value={fmtShares(insiders.summary.netShares365d)}
                hint={
                  insiders.summary.pctChange365d != null
                    ? `${fmtPct(insiders.summary.pctChange365d)} of shares out.`
                    : undefined
                }
                tone={toneFromNet(insiders.summary.netShares365d)}
              />
            </div>
          </ExpandableBlock>
          <ExpandableBlock title="Share change by person">
            <PeopleTable people={insiders.people} mode="shares" />
          </ExpandableBlock>
          <ExpandableBlock title="Recent Form 4 transactions">
            <InsiderTradesTable trades={insiders.trades} />
          </ExpandableBlock>
        </div>
      )}

      {ownershipTab === "politicians" && (
        <div
          id="ownership-panel-politicians"
          role="tabpanel"
          aria-labelledby="ownership-tab-politicians"
          className="space-y-3"
        >
          <p className="max-w-[75ch] text-xs text-zinc-500 dark:text-zinc-400">
            STOCK Act periodic transaction reports for members of Congress and some executive-branch
            officials. Amounts are disclosed as ranges — net figures use the midpoint of each range as
            an estimate, not exact share counts.
          </p>
          <ExpandableBlock title="Summary stats">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="Buys"
                value={String(politicians.summary.buys)}
                hint="In loaded STOCK Act disclosures"
              />
              <StatCard
                label="Sells"
                value={String(politicians.summary.sells)}
                hint="In loaded STOCK Act disclosures"
              />
              <StatCard
                label="Est. net $ ~90d"
                value={fmtMoney(politicians.summary.netAmountMid90d)}
                tone={toneFromNet(politicians.summary.netAmountMid90d)}
              />
              <StatCard
                label="Est. net $ ~365d"
                value={fmtMoney(politicians.summary.netAmountMid365d)}
                tone={toneFromNet(politicians.summary.netAmountMid365d)}
              />
            </div>
          </ExpandableBlock>
          <ExpandableBlock title="Estimated activity by person">
            <PeopleTable people={politicians.people} mode="dollars" />
          </ExpandableBlock>
          <ExpandableBlock title="Recent disclosures">
            <PoliticianTable trades={politicians.trades} />
          </ExpandableBlock>
        </div>
      )}

            <div className="rounded-xl border border-zinc-200 bg-zinc-50/40 p-4 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/30 dark:text-zinc-400">
        <p className="font-medium text-zinc-600 dark:text-zinc-300">Sources &amp; notes</p>
        <ul className="mt-2 list-disc space-y-1 pl-4">
          {data.sources.map((s) => (
            <li key={s}>{s}</li>
          ))}
          {data.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
