"use client";

import { useEffect, useMemo, useState } from "react";
import type { CompanyFinancials } from "@/lib/research/edgar";
import { companyOperatingMetrics } from "@/lib/research/valuation/metrics";
import {
  precedentsAreActionable,
  runPrecedents,
  sectorIllustrativePrecedents,
  type PrecedentDeal,
} from "@/lib/research/valuation/precedents";
import ExpandableModel from "./ExpandableModel";
import { fmtMult, fmtPerShare, fmtPct, fmtRange } from "./fmt";
import { btnCompact } from "../ui/buttonStyles";

const NULL_RANGE = { low: null, mid: null, high: null };

export default function PrecedentsModelPanel({
  fin,
  sector,
  onRange,
}: {
  fin: CompanyFinancials;
  sector: string | null;
  onRange?: (r: { low: number | null; mid: number | null; high: number | null }) => void;
}) {
  const metrics = useMemo(() => companyOperatingMetrics(fin), [fin]);
  const [deals, setDeals] = useState<PrecedentDeal[]>([]);
  const [premium, setPremium] = useState("25");

  useEffect(() => {
    setDeals([]);
  }, [sector, fin.ticker]);

  const result = useMemo(() => {
    const uplift = Number(premium);
    return runPrecedents({
      deals,
      subjectRevenue: metrics.revenue,
      subjectEbitda: metrics.ebitda,
      subjectNetDebt: metrics.netDebt,
      subjectShares: metrics.shares,
      controlPremiumUplift:
        Number.isFinite(uplift) && uplift !== 0 ? uplift / 100 : undefined,
    });
  }, [deals, metrics, premium]);

  const actionable = precedentsAreActionable(deals);
  const hasIllustrative = deals.some((d) => d.illustrative === true);
  const exportRange = actionable ? result.range : NULL_RANGE;

  useEffect(() => {
    onRange?.(exportRange);
  }, [exportRange, onRange]);

  function updateDeal(id: string, patch: Partial<PrecedentDeal>) {
    setDeals((prev) =>
      prev.map((d) => {
        if (d.id !== id) return d;
        const wasIllustrative = d.illustrative === true;
        return {
          ...d,
          ...patch,
          illustrative: false,
          notes: wasIllustrative
            ? "Now treated as user-entered (edited template)."
            : d.notes,
        };
      })
    );
  }

  function addDeal() {
    setDeals((prev) => [
      ...prev,
      {
        id: `user-${Date.now()}`,
        target: "New deal",
        year: new Date().getFullYear(),
        evEbitda: 12,
        evSales: 3,
        illustrative: false,
        notes: "User-entered deal",
      },
    ]);
  }

  function loadTemplates() {
    const templates = sectorIllustrativePrecedents(sector);
    setDeals((prev) => {
      const ids = new Set(prev.map((d) => d.id));
      const extra = templates.filter((t) => !ids.has(t.id));
      return extra.length ? [...prev, ...extra] : prev;
    });
  }

  return (
    <ExpandableModel
      title="Precedent transactions"
      subtitle="M&A multiples applied to this company. There is no deal database — templates are a sandbox, not comps."
      summary={fmtRange(exportRange)}
      defaultOpen={false}
    >
      <div className="space-y-4">
        {hasIllustrative && (
          <div
            role="status"
            className="rounded-lg border-2 border-amber-500 bg-amber-100 px-3 py-3 text-sm font-semibold leading-snug text-amber-950 dark:border-amber-400 dark:bg-amber-950/70 dark:text-amber-100"
          >
            These are not real transactions. Do not use them for a price.
            Illustrative sector templates are a sandbox, not M&A comps.
          </div>
        )}

        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-zinc-500">
              Control premium uplift
            </span>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                step="1"
                value={premium}
                onChange={(e) => setPremium(e.target.value)}
                className="w-24 rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 font-mono text-sm dark:border-zinc-700 dark:bg-zinc-900"
              />
              <span className="text-xs text-zinc-500">%</span>
            </div>
          </label>
          <button type="button" onClick={addDeal} className={btnCompact}>
            Add deal
          </button>
          <button type="button" onClick={loadTemplates} className={btnCompact}>
            Load illustrative sector templates (not real deals)
          </button>
        </div>

        {deals.length === 0 && (
          <div className="rounded-lg border border-dashed border-zinc-300 px-4 py-6 text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">
            <p className="font-medium text-zinc-800 dark:text-zinc-100">
              No deal database
            </p>
            <p className="mt-1 leading-snug">
              There is no M&A deal database. This table starts empty. Sector
              templates are a sandbox for playing with multiples — they are not
              transaction comps.
            </p>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-zinc-200 bg-zinc-50/60 p-3 dark:border-zinc-800 dark:bg-zinc-900/40">
            <p className="text-[11px] font-medium uppercase text-zinc-500">
              EV / EBITDA implied
            </p>
            <p className="mt-1 font-mono text-sm font-semibold">
              {fmtPerShare(result.implied.evEbitda.perShare)}
            </p>
            <p className="font-mono text-[11px] text-zinc-500">
              @ {fmtMult(result.implied.evEbitda.multiple)}
            </p>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-zinc-50/60 p-3 dark:border-zinc-800 dark:bg-zinc-900/40">
            <p className="text-[11px] font-medium uppercase text-zinc-500">
              EV / Sales implied
            </p>
            <p className="mt-1 font-mono text-sm font-semibold">
              {fmtPerShare(result.implied.evSales.perShare)}
            </p>
            <p className="font-mono text-[11px] text-zinc-500">
              @ {fmtMult(result.implied.evSales.multiple)}
            </p>
          </div>
        </div>

        {deals.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/70">
                  <th className="px-3 py-2 text-left">Target</th>
                  <th className="px-3 py-2 text-right">Year</th>
                  <th className="px-3 py-2 text-right">EV/EBITDA</th>
                  <th className="px-3 py-2 text-right">EV/Sales</th>
                  <th className="px-3 py-2 text-left">Flag</th>
                </tr>
              </thead>
              <tbody>
                {deals.map((d) => (
                  <tr
                    key={d.id}
                    className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/60"
                  >
                    <td className="px-3 py-1.5">
                      <input
                        value={d.target}
                        onChange={(e) =>
                          updateDeal(d.id, { target: e.target.value })
                        }
                        className="w-full min-w-[8rem] rounded border border-transparent bg-transparent px-1 py-0.5 text-sm hover:border-zinc-300 focus:border-zinc-400 dark:hover:border-zinc-600"
                      />
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      <input
                        type="number"
                        value={d.year ?? ""}
                        onChange={(e) =>
                          updateDeal(d.id, {
                            year: e.target.value ? Number(e.target.value) : undefined,
                          })
                        }
                        className="w-16 rounded border border-transparent bg-transparent px-1 py-0.5 text-right font-mono text-xs hover:border-zinc-300 dark:hover:border-zinc-600"
                      />
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      <input
                        type="number"
                        step="0.1"
                        value={d.evEbitda ?? ""}
                        onChange={(e) =>
                          updateDeal(d.id, {
                            evEbitda: e.target.value
                              ? Number(e.target.value)
                              : null,
                          })
                        }
                        className="w-16 rounded border border-transparent bg-transparent px-1 py-0.5 text-right font-mono text-xs hover:border-zinc-300 dark:hover:border-zinc-600"
                      />
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      <input
                        type="number"
                        step="0.1"
                        value={d.evSales ?? ""}
                        onChange={(e) =>
                          updateDeal(d.id, {
                            evSales: e.target.value
                              ? Number(e.target.value)
                              : null,
                          })
                        }
                        className="w-16 rounded border border-transparent bg-transparent px-1 py-0.5 text-right font-mono text-xs hover:border-zinc-300 dark:hover:border-zinc-600"
                      />
                    </td>
                    <td className="px-3 py-1.5 text-[10px]">
                      {d.illustrative ? (
                        <span className="font-medium text-amber-800 dark:text-amber-200">
                          illustrative
                        </span>
                      ) : (
                        <span className="font-medium text-emerald-800 dark:text-emerald-200">
                          {d.notes ===
                          "Now treated as user-entered (edited template)."
                            ? "now treated as user-entered"
                            : "user-entered"}
                        </span>
                      )}
                      {d.premiumPct != null
                        ? ` · prem ${fmtPct(d.premiumPct / 100)}`
                        : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-[11px] leading-snug text-zinc-500 dark:text-zinc-400">
          There is no CapIQ-style deal feed. Add real transactions, or load
          sector templates only as a sandbox. Control premium is applied to
          enterprise value.
        </p>
        {result.notes.slice(0, 4).map((n) => (
          <p key={n} className="text-[11px] text-zinc-500 dark:text-zinc-400">
            {n}
          </p>
        ))}
      </div>
    </ExpandableModel>
  );
}
