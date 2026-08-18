"use client";

import { useEffect, useMemo, useState } from "react";
import { runMonteCarloDcf } from "@/lib/research/valuation/monte-carlo-dcf";
import ExpandableModel from "./ExpandableModel";
import { fmtPerShare } from "./fmt";
import { btnCompact } from "../ui/buttonStyles";

export default function MonteCarloPanel({
  fcf,
  wacc,
  terminalGrowth,
  debt,
  cash,
  shares,
  basePerShare,
  onRange,
}: {
  fcf: number[];
  wacc: number;
  terminalGrowth: number;
  debt: number;
  cash: number;
  shares: number | null;
  basePerShare: number | null;
  onRange?: (r: {
    low: number | null;
    mid: number | null;
    high: number | null;
  }) => void;
}) {
  const [sims, setSims] = useState("1000");
  const [fcfShock, setFcfShock] = useState("15");
  const [waccShock, setWaccShock] = useState("1");
  const [gShock, setGShock] = useState("0.5");
  const [runId, setRunId] = useState(0);

  const result = useMemo(() => {
    if (!fcf.length || runId === 0) return null;
    return runMonteCarloDcf({
      fcf,
      wacc,
      terminalGrowth,
      debt,
      cash,
      shares,
      fcfShockStd: (Number(fcfShock) || 15) / 100,
      waccShockStd: (Number(waccShock) || 1) / 100,
      growthShockStd: (Number(gShock) || 0.5) / 100,
      simulations: Number(sims) || 1000,
      seed: 42 + runId,
    });
  }, [
    fcf,
    wacc,
    terminalGrowth,
    debt,
    cash,
    shares,
    fcfShock,
    waccShock,
    gShock,
    sims,
    runId,
  ]);

  useEffect(() => {
    if (!result) return;
    onRange?.({
      low: result.p5,
      mid: result.medianPerShare,
      high: result.p95,
    });
  }, [result, onRange]);

  return (
    <ExpandableModel
      title="Monte Carlo DCF"
      subtitle="Shock FCF path, WACC, and terminal growth — distribution of per-share values."
      summary={
        result?.medianPerShare != null
          ? `P50 ${fmtPerShare(result.medianPerShare)}`
          : "Run simulation"
      }
      defaultOpen={false}
    >
      <div className="grid gap-3 sm:grid-cols-4">
        {(
          [
            ["Simulations", sims, setSims],
            ["FCF shock %", fcfShock, setFcfShock],
            ["WACC shock pp", waccShock, setWaccShock],
            ["g shock pp", gShock, setGShock],
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
      <button
        type="button"
        className={`${btnCompact} mt-3`}
        onClick={() => setRunId((n) => n + 1)}
      >
        Run Monte Carlo
      </button>
      {basePerShare != null && (
        <p className="mt-2 text-xs text-zinc-500">
          Base Gordon DCF: {fmtPerShare(basePerShare)}
        </p>
      )}
      {result && (
        <div className="mt-4 grid gap-2 sm:grid-cols-3 text-sm">
          <p>
            Mean:{" "}
            <span className="font-mono">{fmtPerShare(result.meanPerShare)}</span>
          </p>
          <p>
            Median:{" "}
            <span className="font-mono">
              {fmtPerShare(result.medianPerShare)}
            </span>
          </p>
          <p>
            Stdev:{" "}
            <span className="font-mono">{fmtPerShare(result.stdPerShare)}</span>
          </p>
          <p>
            P5: <span className="font-mono">{fmtPerShare(result.p5)}</span>
          </p>
          <p>
            P25–P75:{" "}
            <span className="font-mono">
              {fmtPerShare(result.p25)} – {fmtPerShare(result.p75)}
            </span>
          </p>
          <p>
            P95: <span className="font-mono">{fmtPerShare(result.p95)}</span>
          </p>
        </div>
      )}
      <p className="mt-3 text-[11px] text-zinc-500">
        Independent shocks; no correlation structure. Educational — not a full
        risk model. Feeds football field as P5–P50–P95 when run. n=
        {result?.simulations ?? "—"}.
      </p>
    </ExpandableModel>
  );
}
