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
      tradingRange: tradingRange ?? undefined,
      analystTargets: analystTargets ?? undefined,
      compsPe: compsPe ?? undefined,
      compsEvEbitda: compsEvEbitda ?? undefined,
      precedents: precedents ?? undefined,
      monteCarlo: monteCarlo ?? undefined,
      dcf: {
        gordonPerShare: dcfGordon,
        exitPerShare: dcfExit,
      },
      lbo: lbo ?? undefined,
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
      subtitle="52-week range, analyst targets, comp P/E, comp EV/EBITDA, then DCF and LBO."
      summary={summary}
      defaultOpen={false}
    >
      <FootballFieldChart field={field} />
      <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
        52-week range and analyst targets load with this page. Comp P/E and
        EV/EBITDA fill in once peer comps finish. DCF updates as you change
        assumptions. Open precedents or Monte Carlo to add those bars. The
        52-week range is context and is left out of the central estimate.
      </p>
    </ExpandableModel>
  );
}
