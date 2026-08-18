"use client";

import { useMemo } from "react";
import type { CompanyFinancials } from "@/lib/research/edgar";
import { companyOperatingMetrics } from "@/lib/research/valuation/metrics";
import {
  buildEvBridgeFromMetrics,
  type EvSharesSource,
} from "@/lib/research/valuation/ev-bridge";
import { fmtMoney, fmtPerShare } from "./fmt";
import ExpandableModel from "./ExpandableModel";

function shareBasisLabel(src: EvSharesSource): string {
  if (src === "diluted") return "diluted";
  if (src === "basic") return "basic";
  if (src === "derived-diluted") return "derived";
  return "unspecified";
}

function fmtShareCount(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(2)}M`;
  return `${sign}${abs.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

export default function EvBridgeCard({
  fin,
  marketPrice,
}: {
  fin: CompanyFinancials;
  marketPrice: number | null;
}) {
  const bridge = useMemo(() => {
    const m = companyOperatingMetrics(fin);
    return buildEvBridgeFromMetrics(m, marketPrice);
  }, [fin, marketPrice]);

  const summary =
    bridge.enterpriseValue != null
      ? `EV ${fmtMoney(bridge.enterpriseValue)}`
      : "Incomplete";

  const carved =
    bridge.cashUnrestricted != null &&
    bridge.restrictedCash != null &&
    bridge.cash != null &&
    bridge.cashUnrestricted !== bridge.cash;
  const cashLabel = carved
    ? "(−) Cash (unrestricted)"
    : "(−) Cash & equivalents";
  const cashVal = bridge.cashUnrestricted ?? bridge.cash;

  const moneyRows: Array<[string, number | null, boolean]> = [
    ["Market capitalization", bridge.marketCap, false],
    ["(+) Total debt", bridge.debt, false],
    ["(+) Lease liabilities", bridge.leases, false],
    ["(+) Minority interest", bridge.minorityInterest, false],
    ["(+) Preferred equity", bridge.preferredEquity, false],
    ["(+) Pension deficit", bridge.pensionDeficit, false],
    [cashLabel, cashVal, false],
    ["Restricted cash (not subtracted)", bridge.restrictedCash, false],
    ["Short-term investments (not in EV)", bridge.stInvestments, false],
    ["Enterprise value", bridge.enterpriseValue, true],
    ["Net debt (incl. leases)", bridge.netDebt, false],
  ];

  return (
    <ExpandableModel
      title="Enterprise value bridge"
      subtitle="Market cap + debt + leases + NCI + preferred + pension deficit − unrestricted cash, from filings and last price."
      summary={summary}
      defaultOpen={false}
    >
      <div className="space-y-3">
        <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full border-collapse text-sm">
            <tbody>
              <tr className="border-b border-zinc-100 dark:border-zinc-800/60">
                <td className="px-3 py-2 text-left text-xs text-zinc-600 dark:text-zinc-300">
                  Shares ({shareBasisLabel(bridge.sharesSource)})
                </td>
                <td className="px-3 py-2 text-right font-mono text-xs tabular-nums">
                  {fmtShareCount(bridge.shares)}
                </td>
              </tr>
              {moneyRows.map(([label, val, emphasize]) => (
                <tr
                  key={label}
                  className={`border-b border-zinc-100 dark:border-zinc-800/60 ${
                    emphasize ? "font-semibold" : ""
                  }`}
                >
                  <td className="px-3 py-2 text-left text-xs text-zinc-600 dark:text-zinc-300">
                    {label}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-xs tabular-nums">
                    {fmtMoney(val)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {marketPrice != null && (
          <p className="text-xs text-zinc-500">
            Price used: {fmtPerShare(marketPrice)} · shares:{" "}
            {fmtShareCount(bridge.shares)} {shareBasisLabel(bridge.sharesSource)}{" "}
            · complete: {bridge.complete ? "yes" : "no"}
          </p>
        )}
        <ul className="list-inside list-disc text-[11px] text-zinc-500 dark:text-zinc-400">
          {bridge.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      </div>
    </ExpandableModel>
  );
}
