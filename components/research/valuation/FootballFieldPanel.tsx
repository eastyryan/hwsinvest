"use client";

import { useMemo } from "react";
import {
  assembleValuationBars,
  buildFootballField,
  type FootballBar,
} from "@/lib/research/valuation/football-field";
import ExpandableModel from "./ExpandableModel";
import FootballFieldChart from "./FootballFieldChart";
import { fmtPerShare } from "./fmt";

export type MethodRange = {
  low: number | null;
  mid: number | null;
  high: number | null;
};

export default function FootballFieldPanel({
  currentPrice,
  dcfGordon,
  dcfExit,
  compsPe,
  compsEvEbitda,
  analystTargets,
  precedents,
  lbo,
  tradingRange,
  monteCarlo,
}: {
  currentPrice: number | null;
  dcfGordon: number | null;
  dcfExit: number | null;
  compsPe: MethodRange | null;
  compsEvEbitda: MethodRange | null;
  analystTargets: MethodRange | null;
  precedents: MethodRange | null;
  lbo: MethodRange | null;
  tradingRange: MethodRange | null;
  monteCarlo?: MethodRange | null;
}) {
  const field = useMemo(() => {
    const bars: FootballBar[] = assembleValuationBars({
      dcf: {
        gordonPerShare: dcfGordon,
        exitPerShare: dcfExit,
      },
      compsPe: compsPe ?? undefined,
      compsEvEbitda: compsEvEbitda ?? undefined,
      analystTargets: analystTargets ?? undefined,
      precedents: precedents ?? undefined,
      lbo: lbo ?? undefined,
      monteCarlo: monteCarlo ?? undefined,
      tradingRange: tradingRange ?? undefined,
    });
    return buildFootballField({ currentPrice, bars });
  }, [
    currentPrice,
    dcfGordon,
    dcfExit,
    compsPe,
    compsEvEbitda,
    analystTargets,
    precedents,
    lbo,
    tradingRange,
    monteCarlo,
  ]);

  const summary =
    field.centralEstimate != null
      ? `Central ${fmtPerShare(field.centralEstimate)} · ${field.bars.length} methods`
      : field.bars.length
        ? `${field.bars.length} methods`
        : "Expand models below";

  return (
    <ExpandableModel
      title="Football field"
      subtitle="52-week range, analyst targets, comp P/E, and comp EV/EBITDA, then DCF and LBO. The central estimate averages analyst targets, comps, DCF, and LBO."
      summary={summary}
      defaultOpen={false}
    >
      <FootballFieldChart field={field} />
      <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
        DCF updates live. The 52-week range, comps, and the LBO band load with
        the page. Monte Carlo runs when you open it. Precedent bars stay empty
        until real deals are added.
      </p>
    </ExpandableModel>
  );
}
