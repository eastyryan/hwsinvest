"use client";

import { useMemo } from "react";
import type { CompanyFinancials } from "@/lib/research/edgar";
import { companyOperatingMetrics, lastLine } from "@/lib/research/valuation/metrics";
import {
  buildBankPack,
  buildInsurerPack,
  buildReitPack,
  describeSectorModel,
  detectSectorPack,
} from "@/lib/research/valuation/sector-packs";
import ExpandableModel from "./ExpandableModel";
import { fmtMult, fmtPct, fmtMoney } from "./fmt";

export default function SectorPackPanel({
  fin,
  marketPrice,
  sector,
  industry,
  sic,
}: {
  fin: CompanyFinancials;
  marketPrice: number | null;
  sector: string | null;
  industry: string | null;
  sic: string | null;
}) {
  const kind = detectSectorPack(sector, industry, sic);
  const m = useMemo(() => companyOperatingMetrics(fin), [fin]);
  const equity = lastLine(fin.annual, "equity");
  const goodwill = lastLine(fin.annual, "goodwill");
  const da = lastLine(fin.annual, "da");
  const deposits = lastLine(fin.annual, "deposits");
  const netInterestIncome = lastLine(fin.annual, "netInterestIncome");
  const totalAssets = lastLine(fin.annual, "totalAssets");
  const loanLikeReceivables = lastLine(fin.annual, "receivables");
  const capex = lastLine(fin.annual, "capex");
  const premiumsEarned = lastLine(fin.annual, "premiumsEarned");
  const policyBenefits = lastLine(fin.annual, "policyBenefits");

  const bank =
    kind === "bank"
      ? buildBankPack({
          price: marketPrice,
          shares: m.shares,
          equity,
          goodwill,
          netIncome: m.netIncome,
          deposits,
          netInterestIncome,
          totalAssets,
          loanLikeReceivables,
        })
      : null;
  const reit =
    kind === "reit"
      ? buildReitPack({
          price: marketPrice,
          shares: m.shares,
          netIncome: m.netIncome,
          da,
          capex,
        })
      : null;
  const insurer =
    kind === "insurer"
      ? buildInsurerPack({
          price: marketPrice,
          shares: m.shares,
          premiumsEarned,
          policyBenefits,
          equity,
        })
      : null;

  const special = kind === "bank" || kind === "reit" || kind === "insurer";

  const summary =
    kind === "bank"
      ? bank?.priceToBook != null
        ? `P/B ${fmtMult(bank.priceToBook)}`
        : "Bank pack"
      : kind === "reit"
        ? reit?.priceToFfo != null
          ? `P/FFO ${fmtMult(reit.priceToFfo)}`
          : "REIT pack"
        : kind === "insurer"
          ? insurer?.combinedRatioProxy != null
            ? `Combined ${fmtPct(insurer.combinedRatioProxy)}`
            : insurer?.priceToBook != null
              ? `P/B ${fmtMult(insurer.priceToBook)}`
              : "Insurer pack"
          : "Standard";

  return (
    <ExpandableModel
      title="Sector pack"
      subtitle="Free filing-based metrics for banks / REITs / insurers when a generic DCF misleads."
      summary={summary}
      defaultOpen={false}
    >
      <p className="text-xs text-zinc-500">
        Detected pack: <span className="font-medium text-zinc-800 dark:text-zinc-200">{kind}</span>
        {sector ? ` · ${sector}` : ""}
        {industry ? ` · ${industry}` : ""}
      </p>
      <p className="mt-1 text-[11px] text-zinc-500">{describeSectorModel(kind)}</p>
      {special && (
        <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
          Industrial DCF on the Valuation tab is illustrative for these names.
        </p>
      )}
      {bank && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2 text-sm">
          <p>Book equity: <span className="font-mono">{fmtMoney(bank.bookEquity)}</span></p>
          <p>Tangible book proxy: <span className="font-mono">{fmtMoney(bank.tangibleBookProxy)}</span></p>
          <p>ROE: <span className="font-mono">{fmtPct(bank.roe)}</span></p>
          <p>P/B: <span className="font-mono">{fmtMult(bank.priceToBook)}</span></p>
          <p>P/TBV: <span className="font-mono">{fmtMult(bank.priceToTangibleBook)}</span></p>
          <p>Deposits: <span className="font-mono">{fmtMoney(bank.deposits)}</span></p>
          <p>Net interest income: <span className="font-mono">{fmtMoney(bank.netInterestIncome)}</span></p>
          <p>NIM proxy: <span className="font-mono">{fmtPct(bank.nimProxy)}</span></p>
          <p>Loan-like receivables: <span className="font-mono">{fmtMoney(bank.loanLikeReceivables)}</span></p>
          {bank.notes.map((n) => (
            <p key={n} className="sm:col-span-2 text-[11px] text-zinc-500">{n}</p>
          ))}
        </div>
      )}
      {reit && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2 text-sm">
          <p>FFO proxy (NI+D&A): <span className="font-mono">{fmtMoney(reit.ffoProxy)}</span></p>
          <p>P/FFO: <span className="font-mono">{fmtMult(reit.priceToFfo)}</span></p>
          <p>AFFO proxy (FFO − |capex|): <span className="font-mono">{fmtMoney(reit.affoProxy)}</span></p>
          <p>P/AFFO: <span className="font-mono">{fmtMult(reit.priceToAffo)}</span></p>
          {reit.notes.map((n) => (
            <p key={n} className="sm:col-span-2 text-[11px] text-zinc-500">{n}</p>
          ))}
        </div>
      )}
      {insurer && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2 text-sm">
          <p>Premiums earned: <span className="font-mono">{fmtMoney(insurer.premiumsEarned)}</span></p>
          <p>Policyholder benefits: <span className="font-mono">{fmtMoney(insurer.policyBenefits)}</span></p>
          <p>Combined ratio proxy: <span className="font-mono">{fmtPct(insurer.combinedRatioProxy)}</span></p>
          <p>Book equity: <span className="font-mono">{fmtMoney(insurer.bookEquity)}</span></p>
          <p>P/B: <span className="font-mono">{fmtMult(insurer.priceToBook)}</span></p>
          {insurer.notes.map((n) => (
            <p key={n} className="sm:col-span-2 text-[11px] text-zinc-500">{n}</p>
          ))}
        </div>
      )}
      {kind === "standard" || kind === "unknown" ? (
        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
          Standard corporate pack — use DCF, comps, and EV bridge. No special
          bank/REIT/insurer adjustments applied.
        </p>
      ) : null}
    </ExpandableModel>
  );
}
