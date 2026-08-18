"use client";

import { useMemo, useState } from "react";
import type { CompanyFinancials } from "@/lib/research/edgar";
import { companyOperatingMetrics } from "@/lib/research/valuation/metrics";
import { lastLine } from "@/lib/research/valuation/metrics";
import { runCreditCapacity } from "@/lib/research/valuation/credit";
import ExpandableModel from "./ExpandableModel";
import { fmtMoney, fmtMult, fmtPct } from "./fmt";

export default function CreditPanel({ fin }: { fin: CompanyFinancials }) {
  const m = useMemo(() => companyOperatingMetrics(fin), [fin]);
  const interest = lastLine(fin.annual, "interestExpense");
  const [maxLev, setMaxLev] = useState("3.5");
  const [minCov, setMinCov] = useState("3");
  const [rate, setRate] = useState("6");

  const result = useMemo(() => {
    if (m.ebitda == null || m.ebitda <= 0) return null;
    return runCreditCapacity({
      ebitda: m.ebitda,
      ebit: m.ebit,
      interestExpense: interest != null ? Math.abs(interest) : null,
      netDebt: m.netDebt,
      totalDebt: m.debt,
      maxLeverage: Number(maxLev) || 3.5,
      minCoverage: Number(minCov) || 3,
      assumedRate: (Number(rate) || 6) / 100,
    });
  }, [m, interest, maxLev, minCov, rate]);

  return (
    <ExpandableModel
      title="Debt capacity / credit"
      subtitle="Leverage and coverage headroom under simple free covenants."
      summary={
        result?.debtCapacityHeadroom != null
          ? `Headroom ${fmtMoney(result.debtCapacityHeadroom)}`
          : "—"
      }
      defaultOpen={false}
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-xs">
          Max Net Debt / EBITDA
          <input
            type="number"
            step="0.1"
            value={maxLev}
            onChange={(e) => setMaxLev(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-1.5 font-mono dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <label className="text-xs">
          Min EBIT / Interest
          <input
            type="number"
            step="0.1"
            value={minCov}
            onChange={(e) => setMinCov(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-1.5 font-mono dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <label className="text-xs">
          Assumed rate %
          <input
            type="number"
            step="0.1"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-1.5 font-mono dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
      </div>
      {result && (
        <div className="mt-4 grid gap-2 sm:grid-cols-2 text-sm">
          <p>
            Current leverage:{" "}
            <span className="font-mono">{fmtMult(result.currentLeverage)}</span>
          </p>
          <p>
            Current coverage:{" "}
            <span className="font-mono">{fmtMult(result.currentCoverage)}</span>
          </p>
          <p>
            Max debt @ leverage:{" "}
            <span className="font-mono">{fmtMoney(result.maxDebtAtLeverage)}</span>
          </p>
          <p>
            Max debt @ coverage:{" "}
            <span className="font-mono">{fmtMoney(result.maxDebtAtCoverage)}</span>
          </p>
          <p>
            Headroom:{" "}
            <span className="font-mono font-semibold">
              {fmtMoney(result.debtCapacityHeadroom)}
            </span>
          </p>
          <p>
            Binding:{" "}
            <span className="font-medium">{result.bindingConstraint}</span>
          </p>
        </div>
      )}
      {!result && (
        <p className="mt-3 text-sm text-zinc-500">Needs positive EBITDA.</p>
      )}
      <ul className="mt-3 list-inside list-disc text-[11px] text-zinc-500">
        {(result?.notes ?? []).map((n) => (
          <li key={n}>{n}</li>
        ))}
      </ul>
    </ExpandableModel>
  );
}
