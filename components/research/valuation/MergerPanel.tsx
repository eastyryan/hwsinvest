"use client";

import { useMemo, useState } from "react";
import type { CompanyFinancials } from "@/lib/research/edgar";
import { companyOperatingMetrics } from "@/lib/research/valuation/metrics";
import { runMerger } from "@/lib/research/valuation/merger";
import ExpandableModel from "./ExpandableModel";
import { fmtMoney, fmtPct, fmtPerShare } from "./fmt";

export default function MergerPanel({
  fin,
  marketPrice,
}: {
  fin: CompanyFinancials;
  marketPrice: number | null;
}) {
  const m = useMemo(() => companyOperatingMetrics(fin), [fin]);
  const [targetNi, setTargetNi] = useState("");
  const [targetShares, setTargetShares] = useState("");
  const [offer, setOffer] = useState("");
  const [cashPct, setCashPct] = useState("50");
  const [rate, setRate] = useState("5");
  const [syn, setSyn] = useState("0");
  const [fees, setFees] = useState("0");

  const result = useMemo(() => {
    if (
      m.netIncome == null ||
      m.shares == null ||
      !targetNi ||
      !targetShares ||
      !offer
    )
      return null;
    const cash = (Number(cashPct) || 0) / 100;
    return runMerger({
      acquirerNetIncome: m.netIncome,
      acquirerShares: m.shares,
      targetNetIncome: Number(targetNi),
      targetShares: Number(targetShares),
      offerPricePerShare: Number(offer),
      targetSharesOutstanding: Number(targetShares),
      cashPercent: cash,
      stockPercent: 1 - cash,
      newDebtInterestRate: (Number(rate) || 0) / 100,
      taxRate: 0.21,
      synergiesPretax: Number(syn) || 0,
      dealFees: Number(fees) || 0,
      acquirerPricePerShare: marketPrice ?? undefined,
    });
  }, [m, targetNi, targetShares, offer, cashPct, rate, syn, fees, marketPrice]);

  return (
    <ExpandableModel
      title="M&A accretion / dilution"
      subtitle="Simple cash/stock deal EPS impact. Acquirer = this company; enter target terms."
      summary={
        result
          ? `${result.accretionPct >= 0 ? "Accretive" : "Dilutive"} ${fmtPct(result.accretionPct)}`
          : "Enter target"
      }
      defaultOpen={false}
    >
      <div className="grid gap-3 sm:grid-cols-3">
        {(
          [
            ["Target NI", targetNi, setTargetNi],
            ["Target shares", targetShares, setTargetShares],
            ["Offer $/sh", offer, setOffer],
            ["Cash %", cashPct, setCashPct],
            ["Debt rate %", rate, setRate],
            ["Synergies pretax", syn, setSyn],
            ["Deal fees", fees, setFees],
          ] as const
        ).map(([label, val, set]) => (
          <label key={label} className="flex flex-col gap-1 text-xs">
            <span className="text-zinc-500">{label}</span>
            <input
              type="number"
              value={val}
              onChange={(e) => set(e.target.value)}
              className="rounded-lg border border-zinc-300 px-2 py-1.5 font-mono dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
        ))}
      </div>
      {result && (
        <div className="mt-4 grid gap-2 sm:grid-cols-2 text-sm">
          <p>
            Consideration:{" "}
            <span className="font-mono">{fmtMoney(result.consideration)}</span>
          </p>
          <p>
            New shares:{" "}
            <span className="font-mono">
              {result.newSharesIssued?.toFixed(0) ?? "—"}
            </span>
          </p>
          <p>
            Standalone EPS:{" "}
            <span className="font-mono">{fmtPerShare(result.standaloneEps)}</span>
          </p>
          <p>
            Pro forma EPS:{" "}
            <span className="font-mono">{fmtPerShare(result.proFormaEps)}</span>
          </p>
          <p className="sm:col-span-2 font-semibold">
            Accretion / dilution: {fmtPct(result.accretionPct)}
          </p>
        </div>
      )}
      <p className="mt-3 text-[11px] text-zinc-500">
        Educational model — no purchase accounting, no amortization of
        intangibles, no full BS. Acquirer NI/shares from latest annual filing.
      </p>
    </ExpandableModel>
  );
}
