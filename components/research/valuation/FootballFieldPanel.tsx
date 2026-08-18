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
  comps,
  precedents,
  lbo,
  tradingRange,
  sotp,
  monteCarlo,
}: {
  currentPrice: number | null;
  dcfGordon: number | null;
  dcfExit: number | null;
  comps: MethodRange | null;
  precedents: MethodRange | null;
  lbo: MethodRange | null;
  tradingRange: MethodRange | null;
  sotp?: MethodRange | null;
  monteCarlo?: MethodRange | null;
}) {
  const field = useMemo(() => {
    const bars: FootballBar[] = assembleValuationBars({
      dcf: {
        gordonPerShare: dcfGordon,
        exitPerShare: dcfExit,
      },
      comps: comps ?? undefined,
      precedents: precedents ?? undefined,
      lbo: lbo
        ? {
            entryEquityPerShare: lbo.low,
            exitEquityPerShare: lbo.high,
            irrMidPerShare: lbo.mid,
          }
        : undefined,
      sotp: sotp ?? undefined,
      monteCarlo: monteCarlo ?? undefined,
      tradingRange: tradingRange ?? undefined,
    });
    return buildFootballField({ currentPrice, bars });
  }, [
    currentPrice,
    dcfGordon,
    dcfExit,
    comps,
    precedents,
    lbo,
    tradingRange,
    sotp,
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
      subtitle="Triangulation across DCF, MC, comps, SOTP, precedents, LBO, and 52-week range — with provenance labels."
      summary={summary}
      defaultOpen={false}
    >
      <FootballFieldChart field={field} />
      <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
        DCF updates live. Comps, trading range, Monte Carlo, and SOTP appear
        after you open those sections (and run MC once). Illustrative bars are
        not real deal comps.
      </p>
    </ExpandableModel>
  );
}
