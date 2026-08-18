"use client";

import { useEffect, useMemo, useState } from "react";
import type { CompanyFinancials } from "@/lib/research/edgar";
import { companyOperatingMetrics } from "@/lib/research/valuation/metrics";
import {
  defaultLboInputsFromMetrics,
  runLbo,
  type LboInputs,
} from "@/lib/research/valuation/lbo";
import ExpandableModel from "./ExpandableModel";
import { fmtMoney, fmtMult, fmtPct, fmtPerShare } from "./fmt";
import { btnCompact } from "../ui/buttonStyles";

function pctStr(v: number) {
  return (v * 100).toFixed(1);
}

export default function LboModelPanel({
  fin,
  onRange,
}: {
  fin: CompanyFinancials;
  onRange?: (r: { low: number | null; mid: number | null; high: number | null }) => void;
}) {
  const metrics = useMemo(() => companyOperatingMetrics(fin), [fin]);
  const defaults = useMemo(
    () => defaultLboInputsFromMetrics(metrics),
    [metrics]
  );

  const [entryMultiple, setEntryMultiple] = useState(
    String(defaults?.entryMultiple ?? 12)
  );
  const [exitMultiple, setExitMultiple] = useState(
    String(defaults?.exitMultiple ?? 12)
  );
  const [leverage, setLeverage] = useState(
    String(defaults?.leverageMultiple ?? 4.5)
  );
  const [growth, setGrowth] = useState(
    pctStr(defaults?.ebitdaGrowth ?? 0.05)
  );
  const [years, setYears] = useState(String(defaults?.years ?? 5));
  const [sweep, setSweep] = useState("100");

  useEffect(() => {
    if (!defaults) return;
    setEntryMultiple(String(defaults.entryMultiple));
    setExitMultiple(String(defaults.exitMultiple));
    setLeverage(String(defaults.leverageMultiple));
    setGrowth(pctStr(defaults.ebitdaGrowth));
    setYears(String(defaults.years));
  }, [fin.ticker]); // reset when company changes

  const result = useMemo(() => {
    if (!defaults) return null;
    const inputs: LboInputs = {
      ...defaults,
      entryMultiple: Number(entryMultiple) || defaults.entryMultiple,
      exitMultiple: Number(exitMultiple) || defaults.exitMultiple,
      leverageMultiple: Number(leverage) || defaults.leverageMultiple,
      ebitdaGrowth: (Number(growth) || 5) / 100,
      years: Math.round(Number(years) || 5),
      cashSweepPct: (Number(sweep) || 100) / 100,
    };
    return runLbo(inputs);
  }, [defaults, entryMultiple, exitMultiple, leverage, growth, years, sweep]);

  useEffect(() => {
    if (!result || !metrics.shares || metrics.shares <= 0) {
      onRange?.({ low: null, mid: null, high: null });
      return;
    }
    const entryPs = result.returns.equityIn / metrics.shares;
    const exitPs = result.returns.equityOut / metrics.shares;
    onRange?.({
      low: Math.min(entryPs, exitPs),
      mid: (entryPs + exitPs) / 2,
      high: Math.max(entryPs, exitPs),
    });
  }, [result, metrics.shares, onRange]);

  if (!defaults) {
    return (
      <ExpandableModel
        title="LBO model"
        subtitle="Leveraged buyout returns (IRR / MOIC) with debt schedule and cash sweep."
        summary="Unavailable"
        defaultOpen={false}
      >
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          LBO needs positive EBITDA from the latest annual filing.
        </p>
      </ExpandableModel>
    );
  }

  const su = result?.sourcesAndUses;
  const summary =
    result?.returns.irr != null
      ? `IRR ${fmtPct(result.returns.irr)} · MOIC ${
          result.returns.moic != null ? result.returns.moic.toFixed(2) + "×" : "—"
        }`
      : undefined;

  return (
    <ExpandableModel
      title="LBO model"
      subtitle="Sources & uses, dual-tranche debt, mandatory amort + cash sweep, exit equity, IRR & MOIC."
      summary={summary}
      defaultOpen={false}
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {(
            [
              ["Entry EV/EBITDA", entryMultiple, setEntryMultiple, "×"],
              ["Exit EV/EBITDA", exitMultiple, setExitMultiple, "×"],
              ["Leverage (Debt/EBITDA)", leverage, setLeverage, "×"],
              ["EBITDA growth", growth, setGrowth, "%"],
              ["Hold years", years, setYears, ""],
              ["Cash sweep", sweep, setSweep, "%"],
            ] as const
          ).map(([label, val, set, suf]) => (
            <label key={label} className="flex flex-col gap-1">
              <span className="text-[11px] font-medium text-zinc-500">{label}</span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  step="0.1"
                  value={val}
                  onChange={(e) => set(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-2 py-1.5 font-mono text-sm dark:border-zinc-700 dark:bg-zinc-900"
                />
                {suf && <span className="text-xs text-zinc-500">{suf}</span>}
              </div>
            </label>
          ))}
        </div>

        {result && su && (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="Entry EV" value={fmtMoney(su.entryEv)} />
              <Stat label="Sponsor equity" value={fmtMoney(su.sponsorEquity)} />
              <Stat
                label="IRR"
                value={fmtPct(result.returns.irr)}
                emphasize
              />
              <Stat
                label="MOIC"
                value={
                  result.returns.moic != null
                    ? result.returns.moic.toFixed(2) + "×"
                    : "—"
                }
                emphasize
              />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
                <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-200">
                  Sources
                </p>
                <ul className="mt-2 space-y-1 text-xs text-zinc-600 dark:text-zinc-400">
                  <li className="flex justify-between font-mono">
                    <span>Term loan</span>
                    <span>{fmtMoney(su.termLoan)}</span>
                  </li>
                  <li className="flex justify-between font-mono">
                    <span>Senior notes</span>
                    <span>{fmtMoney(su.notes)}</span>
                  </li>
                  <li className="flex justify-between font-mono">
                    <span>Sponsor equity</span>
                    <span>{fmtMoney(su.sponsorEquity)}</span>
                  </li>
                  <li className="flex justify-between border-t border-zinc-200 pt-1 font-mono font-medium dark:border-zinc-700">
                    <span>Total sources</span>
                    <span>{fmtMoney(su.totalSources)}</span>
                  </li>
                </ul>
              </div>
              <div className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
                <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-200">
                  Uses
                </p>
                <ul className="mt-2 space-y-1 text-xs text-zinc-600 dark:text-zinc-400">
                  <li className="flex justify-between font-mono">
                    <span>Purchase EV</span>
                    <span>{fmtMoney(su.entryEv)}</span>
                  </li>
                  <li className="flex justify-between font-mono">
                    <span>Fees</span>
                    <span>{fmtMoney(su.fees)}</span>
                  </li>
                  <li className="flex justify-between border-t border-zinc-200 pt-1 font-mono font-medium dark:border-zinc-700">
                    <span>Total uses</span>
                    <span>{fmtMoney(su.totalUses)}</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/70">
                    <th className="px-3 py-2 text-left">Year</th>
                    <th className="px-3 py-2 text-right">EBITDA</th>
                    <th className="px-3 py-2 text-right">Interest</th>
                    <th className="px-3 py-2 text-right">FCF</th>
                    <th className="px-3 py-2 text-right">Paydown</th>
                    <th className="px-3 py-2 text-right">Debt end</th>
                    <th className="px-3 py-2 text-right">Net debt / EBITDA</th>
                  </tr>
                </thead>
                <tbody>
                  {result.years.map((y) => (
                    <tr
                      key={y.year}
                      className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/60"
                    >
                      <td className="px-3 py-1.5 font-mono text-xs">{y.year}</td>
                      <td className="px-3 py-1.5 text-right font-mono text-xs tabular-nums">
                        {fmtMoney(y.ebitda)}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono text-xs tabular-nums">
                        {fmtMoney(y.interest)}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono text-xs tabular-nums">
                        {fmtMoney(y.fcf)}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono text-xs tabular-nums">
                        {fmtMoney(y.totalPaydown)}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono text-xs tabular-nums">
                        {fmtMoney(y.endingDebt)}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono text-xs tabular-nums">
                        {fmtMult(y.netDebtEbitda)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="rounded-lg bg-zinc-50 p-3 text-xs dark:bg-zinc-900/40">
              <p className="font-medium text-zinc-700 dark:text-zinc-200">Exit</p>
              <p className="mt-1 font-mono text-zinc-600 dark:text-zinc-400">
                EBITDA {fmtMoney(result.exit.ebitda)} × {fmtMult(Number(exitMultiple))} ={" "}
                EV {fmtMoney(result.exit.exitEv)} − debt {fmtMoney(result.exit.netDebt)} ={" "}
                equity {fmtMoney(result.exit.equityProceeds)}
                {metrics.shares && metrics.shares > 0
                  ? ` (${fmtPerShare(result.exit.equityProceeds / metrics.shares)} / sh)`
                  : ""}
              </p>
            </div>

            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              Simplified PE model: interest on opening balances, tax on EBT,
              reinvestment as % of EBITDA, mandatory term-loan amort then cash
              sweep. Not a full three-statement LBO. Entry EBITDA from filings:{" "}
              {fmtMoney(defaults.entryEbitda)}.
            </p>
            <button
              type="button"
              className={btnCompact}
              onClick={() => {
                if (!defaults) return;
                setEntryMultiple(String(defaults.entryMultiple));
                setExitMultiple(String(defaults.exitMultiple));
                setLeverage(String(defaults.leverageMultiple));
                setGrowth(pctStr(defaults.ebitdaGrowth));
                setYears(String(defaults.years));
                setSweep("100");
              }}
            >
              Reset LBO defaults
            </button>
          </>
        )}
      </div>
    </ExpandableModel>
  );
}

function Stat({
  label,
  value,
  emphasize,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50/60 p-3 dark:border-zinc-800 dark:bg-zinc-900/40">
      <p className="text-[11px] font-medium uppercase text-zinc-500">{label}</p>
      <p
        className={`mt-1 font-mono tabular-nums ${
          emphasize ? "text-base font-semibold" : "text-sm font-medium"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
