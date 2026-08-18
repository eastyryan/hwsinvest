"use client";

import { useEffect, useMemo, useState } from "react";
import type { CompanyFinancials } from "@/lib/research/edgar";
import { companyOperatingMetrics } from "@/lib/research/valuation/metrics";
import {
  runSotp,
  seedSegmentsFromHistory,
  type SotPSegment,
} from "@/lib/research/valuation/sotp";
import ExpandableModel from "./ExpandableModel";
import { fmtMoney, fmtMult, fmtPerShare, fmtRange } from "./fmt";
import { btnCompact } from "../ui/buttonStyles";

export default function SotpPanel({
  fin,
  segmentsPayload,
  onRange,
}: {
  fin: CompanyFinancials;
  segmentsPayload?: {
    product?: { name: string; values: Record<string, number | null>; periods?: string[] }[] | null;
  } | null;
  onRange?: (r: { low: number | null; mid: number | null; high: number | null }) => void;
}) {
  const metrics = useMemo(() => companyOperatingMetrics(fin), [fin]);
  const seeded = useMemo(() => {
    const hist = segmentsPayload?.product?.map((p) => ({
      name: p.name,
      values: p.values,
      periods: p.periods ?? Object.keys(p.values),
    })) ?? null;
    const segs = seedSegmentsFromHistory(hist, 3);
    if (segs.length > 0) return segs;
    // Fallback: single segment = total revenue
    if (metrics.revenue != null && metrics.revenue > 0) {
      return [
        {
          id: "total",
          name: "Consolidated (placeholder)",
          revenue: metrics.revenue,
          multiple: 3,
          multipleType: "evSales" as const,
        },
      ];
    }
    return [] as SotPSegment[];
  }, [segmentsPayload, metrics.revenue]);

  const [segments, setSegments] = useState<SotPSegment[]>(seeded);
  const [overhead, setOverhead] = useState("0");

  useEffect(() => {
    setSegments(seeded);
  }, [fin.ticker]); // eslint-disable-line react-hooks/exhaustive-deps

  const result = useMemo(
    () =>
      runSotp({
        segments,
        netDebt: metrics.netDebt,
        shares: metrics.shares,
        corporateOverheadEv: Number(overhead) || 0,
      }),
    [segments, metrics, overhead]
  );

  useEffect(() => {
    if (result.perShare != null) {
      onRange?.({
        low: result.perShare * 0.9,
        mid: result.perShare,
        high: result.perShare * 1.1,
      });
    }
  }, [result.perShare, onRange]);

  return (
    <ExpandableModel
      title="Sum of the parts (SOTP)"
      subtitle="Segment EV from multiples; subtract net debt. Seeds from product segments when available."
      summary={
        result.perShare != null ? fmtPerShare(result.perShare) : "—"
      }
      defaultOpen={false}
    >
      <div className="space-y-3">
        <label className="flex items-center gap-2 text-xs">
          Corporate overhead EV haircut
          <input
            type="number"
            value={overhead}
            onChange={(e) => setOverhead(e.target.value)}
            className="w-28 rounded-lg border border-zinc-300 px-2 py-1 font-mono dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/70">
                <th className="px-3 py-2 text-left">Segment</th>
                <th className="px-3 py-2 text-right">Revenue</th>
                <th className="px-3 py-2 text-right">Multiple</th>
                <th className="px-3 py-2 text-right">Type</th>
                <th className="px-3 py-2 text-right">EV</th>
              </tr>
            </thead>
            <tbody>
              {segments.map((s, idx) => {
                const ev = result.segments[idx]?.enterpriseValue ?? null;
                return (
                  <tr
                    key={s.id}
                    className="border-b border-zinc-100 dark:border-zinc-800/60"
                  >
                    <td className="px-3 py-1.5">
                      <input
                        value={s.name}
                        onChange={(e) =>
                          setSegments((prev) =>
                            prev.map((x) =>
                              x.id === s.id ? { ...x, name: e.target.value } : x
                            )
                          )
                        }
                        className="w-full bg-transparent text-sm"
                      />
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      <input
                        type="number"
                        value={s.revenue ?? ""}
                        onChange={(e) =>
                          setSegments((prev) =>
                            prev.map((x) =>
                              x.id === s.id
                                ? {
                                    ...x,
                                    revenue: e.target.value
                                      ? Number(e.target.value)
                                      : null,
                                  }
                                : x
                            )
                          )
                        }
                        className="w-24 bg-transparent text-right font-mono text-xs"
                      />
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      <input
                        type="number"
                        step="0.1"
                        value={s.multiple}
                        onChange={(e) =>
                          setSegments((prev) =>
                            prev.map((x) =>
                              x.id === s.id
                                ? { ...x, multiple: Number(e.target.value) || 0 }
                                : x
                            )
                          )
                        }
                        className="w-16 bg-transparent text-right font-mono text-xs"
                      />
                    </td>
                    <td className="px-3 py-1.5 text-right text-xs">
                      {s.multipleType}
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono text-xs">
                      {fmtMoney(ev)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="grid gap-2 sm:grid-cols-3 text-xs">
          <p>
            Sum segment EV:{" "}
            <span className="font-mono font-medium">
              {fmtMoney(result.sumSegmentEv)}
            </span>
          </p>
          <p>
            Equity:{" "}
            <span className="font-mono font-medium">
              {fmtMoney(result.equityValue)}
            </span>
          </p>
          <p>
            Per share:{" "}
            <span className="font-mono font-medium">
              {fmtPerShare(result.perShare)}
            </span>
          </p>
        </div>
        <button
          type="button"
          className={btnCompact}
          onClick={() =>
            setSegments((prev) => [
              ...prev,
              {
                id: `seg-${Date.now()}`,
                name: "New segment",
                revenue: 0,
                multiple: 2,
                multipleType: "evSales",
              },
            ])
          }
        >
          Add segment
        </button>
        <p className="text-[11px] text-zinc-500">
          Free model: apply your own multiples. Segment seeds use reported
          product revenue when the Segments tab has data.
        </p>
        {result.notes.map((n) => (
          <p key={n} className="text-[11px] text-zinc-500">
            {n}
          </p>
        ))}
      </div>
    </ExpandableModel>
  );
}
