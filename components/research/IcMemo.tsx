"use client";

import type { CompanyFinancials } from "@/lib/research/edgar";
import { companyOperatingMetrics } from "@/lib/research/valuation/metrics";
import { fmtBig, fmtMoney } from "./currency";

/**
 * Printable IC-style one-pager. Trigger window.print() from parent.
 * Uses current company facts only (free) — paste valuation conclusions manually if needed.
 */
export default function IcMemo({
  fin,
  marketPrice,
  priceCurrency = "USD",
  dcfPerShare,
  centralEstimate,
  notes = [],
}: {
  fin: CompanyFinancials;
  marketPrice: number | null;
  priceCurrency?: string;
  dcfPerShare?: number | null;
  centralEstimate?: number | null;
  notes?: string[];
}) {
  const m = companyOperatingMetrics(fin);
  const upside =
    dcfPerShare != null && marketPrice != null && marketPrice > 0
      ? dcfPerShare / marketPrice - 1
      : null;

  return (
    <article className="ic-memo space-y-6 text-zinc-900">
      <header className="border-b border-zinc-300 pb-4">
        <p className="text-xs font-medium uppercase tracking-widest text-zinc-500">
          Investment committee one-pager · free model pack
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          {fin.ticker} — {fin.name}
        </h1>
        <p className="mt-1 text-sm text-zinc-600">
          {marketPrice != null
            ? `Market ${fmtMoney(marketPrice, priceCurrency)}`
            : "Market price n/a"}
          {dcfPerShare != null
            ? ` · DCF (Gordon) ${fmtMoney(dcfPerShare, priceCurrency)}`
            : ""}
          {centralEstimate != null
            ? ` · Central ${fmtMoney(centralEstimate, priceCurrency)}`
            : ""}
          {upside != null ? ` · Implied ${(upside * 100).toFixed(1)}%` : ""}
        </p>
        <p className="mt-1 text-[11px] text-zinc-500">
          Generated {new Date().toISOString().slice(0, 10)} · Not investment advice ·
          As-filed SEC metrics
        </p>
      </header>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Snapshot (latest annual)
        </h2>
        <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(
            [
              ["Revenue", m.revenue],
              ["EBITDA", m.ebitda],
              ["Net income", m.netIncome],
              ["Net debt", m.netDebt],
            ] as const
          ).map(([label, v]) => (
            <div key={label} className="rounded border border-zinc-200 p-2">
              <p className="text-[10px] uppercase text-zinc-500">{label}</p>
              <p className="font-mono text-sm font-medium">
                {v != null ? fmtBig(v, fin.currency || "USD") : "—"}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Thesis bullets
        </h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-700">
          <li>Business quality: margins and FCF conversion (see QoE tab).</li>
          <li>
            Intrinsic: DCF path uses unlevered FCF + CAPM WACC; stress sensitivity
            grid before sizing.
          </li>
          <li>
            Relative: trading comps / 52-week range are market-backed; precedent
            multiples may be illustrative templates.
          </li>
          <li>
            Risks: as-filed data can lag restatements; banks/REITs need sector
            packs not a generic DCF.
          </li>
          {notes.slice(0, 4).map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Decision
        </h2>
        <p className="mt-2 text-sm text-zinc-600">
          ☐ Watch &nbsp; ☐ Accumulate &nbsp; ☐ Trim &nbsp; ☐ Pass
        </p>
        <p className="mt-4 text-xs text-zinc-500">
          Sign-off: __________________ Date: __________
        </p>
      </section>
    </article>
  );
}
