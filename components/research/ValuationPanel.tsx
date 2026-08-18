"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CompanyFinancials } from "@/lib/research/edgar";
import {
  buildProjection,
  buildRevenueGrowthPath,
  historicalRevenueGrowth,
  PROJECTION_YEARS,
  type Assumptions,
} from "@/lib/research/excel-projection";
import { buildDcf, type DcfInputs } from "@/lib/research/excel-dcf";
import { sectorBeta } from "@/lib/research/dcf-sector";
import {
  buildSensitivityMatrix,
  UI_GROWTH_DELTAS,
  UI_WACC_DELTAS,
} from "@/lib/research/dcf-sensitivity";
import type { StreetEstimates } from "@/lib/research/street-estimates";
import {
  epsDispersionFromYearly,
  STREET_DISCLAIMER,
  totalRevisionCounts,
} from "@/lib/research/street-estimates";
import { fmtBig, fmtMoney } from "./currency";
import {
  btnCompact,
  btnSegmentedCompact,
  btnSegmentedCompactItem,
} from "./ui/buttonStyles";
import ExpandableModel from "./valuation/ExpandableModel";
import FootballFieldPanel from "./valuation/FootballFieldPanel";
import CompsModelPanel from "./valuation/CompsModelPanel";
import PrecedentsModelPanel from "./valuation/PrecedentsModelPanel";
import LboModelPanel from "./valuation/LboModelPanel";
import TradingRangePanel from "./valuation/TradingRangePanel";
import EvBridgeCard from "./valuation/EvBridgeCard";
import SotpPanel from "./valuation/SotpPanel";
import MergerPanel from "./valuation/MergerPanel";
import MonteCarloPanel from "./valuation/MonteCarloPanel";
import CreditPanel from "./valuation/CreditPanel";
import SectorPackPanel from "./valuation/SectorPackPanel";
import ModelPresetsBar from "./valuation/ModelPresetsBar";
import IcMemo from "./IcMemo";
import DataAsOf from "./DataAsOf";
import { fmtPerShare as fmtPs } from "./valuation/fmt";
import { rangeFromPoints } from "@/lib/research/valuation/football-field";
import type { SegmentsPayload } from "@/lib/research/segments";

type Preset = "history" | "street";

function fmtShares(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(2) + "M";
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function fmtPctInput(v: number): string {
  return (v * 100).toFixed(1);
}

function fmtPctDisplay(v: number | null | undefined, digits = 1): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return (v * 100).toFixed(digits) + "%";
}

function parsePct(s: string, fallback: number): number {
  const n = Number(s);
  if (!Number.isFinite(n)) return fallback;
  return n / 100;
}

function fill(v: number, years: number) {
  return Array.from({ length: years }, () => v);
}

function InputRow({
  label,
  value,
  onChange,
  suffix = "%",
  step = "0.1",
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  suffix?: string;
  step?: string;
  hint?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{label}</span>
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          step={step}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 font-mono text-sm tabular-nums dark:border-zinc-700 dark:bg-zinc-900"
        />
        {suffix && (
          <span className="text-xs text-zinc-500 dark:text-zinc-400">{suffix}</span>
        )}
      </div>
      {hint && (
        <span className="text-[10px] leading-snug text-zinc-500 dark:text-zinc-400">{hint}</span>
      )}
    </label>
  );
}

const ASSUMPTION_KEY = (ticker: string) => `valAssumptions:v1:${ticker.toUpperCase()}`;

interface SavedAssumptions {
  preset: Preset;
  beta: string | null;
  riskFree: string | null;
  erp: string | null;
  tg: string | null;
  y1g: string | null;
  gm: string | null;
  opex: string | null;
}

function loadSaved(ticker: string): SavedAssumptions | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(ASSUMPTION_KEY(ticker));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SavedAssumptions>;
    if (!parsed || typeof parsed !== "object") return null;
    return {
      preset: parsed.preset === "street" ? "street" : "history",
      beta: typeof parsed.beta === "string" ? parsed.beta : null,
      riskFree: typeof parsed.riskFree === "string" ? parsed.riskFree : null,
      erp: typeof parsed.erp === "string" ? parsed.erp : null,
      tg: typeof parsed.tg === "string" ? parsed.tg : null,
      y1g: typeof parsed.y1g === "string" ? parsed.y1g : null,
      gm: typeof parsed.gm === "string" ? parsed.gm : null,
      opex: typeof parsed.opex === "string" ? parsed.opex : null,
    };
  } catch {
    return null;
  }
}

function saveAssumptions(ticker: string, a: SavedAssumptions) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(ASSUMPTION_KEY(ticker), JSON.stringify(a));
  } catch {
    /* private mode */
  }
}

function clearSaved(ticker: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(ASSUMPTION_KEY(ticker));
  } catch {
    /* private mode */
  }
}

export default function ValuationPanel({
  fin,
  marketPrice,
  priceCurrency = "USD",
  sic,
  cik,
  sector = null,
  industry = null,
  marketCap = null,
  segmentsPayload = null,
  loadedAt = null,
}: {
  fin: CompanyFinancials;
  marketPrice: number | null;
  priceCurrency?: string;
  sic: string | null;
  cik: string;
  sector?: string | null;
  industry?: string | null;
  marketCap?: number | null;
  segmentsPayload?: SegmentsPayload | null;
  loadedAt?: number | null;
}) {
  const betaRef = sectorBeta(sic);
  const baseProj = useMemo(() => buildProjection(fin), [fin]);

  const historyDefaults = useMemo(() => {
    if (!baseProj) return null;
    const dcf = buildDcf(fin, baseProj, betaRef, marketPrice);
    if (!dcf) return null;
    const a = baseProj.actuals;
    return {
      beta: dcf.inputs.beta,
      riskFree: dcf.inputs.riskFree,
      erp: dcf.inputs.equityRiskPremium,
      terminalGrowth: dcf.inputs.terminalGrowth,
      weightEquity: dcf.inputs.weightEquity,
      preTaxKd: dcf.inputs.preTaxCostOfDebt,
      taxRate: dcf.inputs.taxRate,
      exitMultiple: dcf.inputs.exitMultiple,
      year1Growth: baseProj.assumptions.revenueGrowth[0],
      grossMargin: baseProj.assumptions.grossMargin[0],
      opexPct: baseProj.assumptions.opexPctRevenue[0],
      sector: dcf.sector,
      // Raw history used to seed the model (unclamped where available).
      historyNotes: {
        revenueGrowth: a.revenueGrowth,
        grossMargin: a.grossMargin,
        opexPct: a.opexPctRevenue,
        taxRate: a.taxRate,
        capexPct: a.capexPctRevenue,
        interestRate: a.interestRate,
      },
    };
  }, [baseProj, fin, betaRef, marketPrice]);

  const saved = useMemo(() => loadSaved(fin.ticker), [fin.ticker]);

  const [preset, setPreset] = useState<Preset>(saved?.preset ?? "history");
  // undefined = still loading; null = loaded, none available
  const [street, setStreet] = useState<StreetEstimates | null | undefined>(
    undefined
  );
  const [streetError, setStreetError] = useState<string | null>(null);
  const streetLoading = street === undefined;

  const [beta, setBeta] = useState<string | null>(saved?.beta ?? null);
  const [riskFree, setRiskFree] = useState<string | null>(saved?.riskFree ?? null);
  const [erp, setErp] = useState<string | null>(saved?.erp ?? null);
  const [tg, setTg] = useState<string | null>(saved?.tg ?? null);
  const [y1g, setY1g] = useState<string | null>(saved?.y1g ?? null);
  const [gm, setGm] = useState<string | null>(saved?.gm ?? null);
  const [opex, setOpex] = useState<string | null>(saved?.opex ?? null);

  // Ranges fed into the football field as each expandable model computes.
  const [compsRange, setCompsRange] = useState<{
    low: number | null;
    mid: number | null;
    high: number | null;
  } | null>(null);
  const [precedentsRange, setPrecedentsRange] = useState<{
    low: number | null;
    mid: number | null;
    high: number | null;
  } | null>(null);
  const [lboRange, setLboRange] = useState<{
    low: number | null;
    mid: number | null;
    high: number | null;
  } | null>(null);
  const [tradingRange, setTradingRange] = useState<{
    low: number | null;
    mid: number | null;
    high: number | null;
  } | null>(null);
  const [sotpRange, setSotpRange] = useState<{
    low: number | null;
    mid: number | null;
    high: number | null;
  } | null>(null);
  const [mcRange, setMcRange] = useState<{
    low: number | null;
    mid: number | null;
    high: number | null;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/research/estimates/${encodeURIComponent(fin.ticker)}`
        );
        if (res.status === 404) {
          if (!cancelled) {
            setStreet(null);
            setStreetError(null);
          }
          return;
        }
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Failed to load estimates");
        if (!cancelled) {
          setStreet(json.estimates ?? null);
          setStreetError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setStreet(null);
          setStreetError(
            e instanceof Error ? e.message : "Street estimates unavailable"
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fin.ticker]);

  // Persist assumptions so revisiting the ticker restores the user's model.
  // Skip the first paint so "Reset to defaults" can clear storage without being
  // immediately rewritten with the prior snapshot.
  const skipSave = useRef(true);
  useEffect(() => {
    if (skipSave.current) {
      skipSave.current = false;
      return;
    }
    saveAssumptions(fin.ticker, {
      preset,
      beta,
      riskFree,
      erp,
      tg,
      y1g,
      gm,
      opex,
    });
  }, [fin.ticker, preset, beta, riskFree, erp, tg, y1g, gm, opex]);

  if (!baseProj || !historyDefaults) {
    return (
      <section className="space-y-2">
        <h2 className="text-lg font-semibold tracking-tight">Valuation</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          A forward DCF needs a revenue base and a gross-profit / operating-income
          structure. Banks, insurers, and some trusts don&apos;t fit that model, so
          no valuation is shown.
        </p>
      </section>
    );
  }

  // Street preset: seed growth from free consensus EPS path (best free proxy
  // for multi-year growth). Margins stay historical — free data is not a full
  // P&L bridge. WACC build-up stays model defaults either way.
  const streetData = street ?? null;
  const streetYear1 =
    streetData?.year1EpsGrowth != null
      ? streetData.year1EpsGrowth
      : historyDefaults.year1Growth;

  const activeDefaults =
    preset === "street" && streetData?.year1EpsGrowth != null
      ? {
          ...historyDefaults,
          year1Growth: streetYear1,
          // Terminal growth stays model long-run — not multi-year street avg.
          terminalGrowth: historyDefaults.terminalGrowth,
        }
      : historyDefaults;

  const betaStr = beta ?? String(activeDefaults.beta);
  const rfStr = riskFree ?? fmtPctInput(activeDefaults.riskFree);
  const erpStr = erp ?? fmtPctInput(activeDefaults.erp);
  const tgStr = tg ?? fmtPctInput(activeDefaults.terminalGrowth);
  const y1gStr = y1g ?? fmtPctInput(activeDefaults.year1Growth);
  const gmStr = gm ?? fmtPctInput(activeDefaults.grossMargin);
  const opexStr = opex ?? fmtPctInput(activeDefaults.opexPct);

  const years = PROJECTION_YEARS;
  const y1 = parsePct(y1gStr, activeDefaults.year1Growth);
  // Prefer multi-year street hops when preset is street; otherwise history/y1.
  // Never force every company to end the explicit horizon at a hard 3%.
  const useStreetPath =
    preset === "street" &&
    streetData != null &&
    (streetData.epsGrowthPath.length > 0 || streetData.year1EpsGrowth != null);
  const growthBuilt = buildRevenueGrowthPath({
    years,
    historical: historicalRevenueGrowth(fin.annual),
    streetPath: useStreetPath ? streetData!.epsGrowthPath : null,
    streetYear1: useStreetPath
      ? (streetData!.year1EpsGrowth ?? y1)
      : y1g != null
        ? y1
        : null,
  });
  // If the user typed year-1 and we're not on multi-year street path, rebuild
  // around that typed value (street-y1 / history fade rules).
  const revPath =
    y1g != null && !(useStreetPath && streetData!.epsGrowthPath.length > 0)
      ? buildRevenueGrowthPath({
          years,
          historical: null,
          streetYear1: y1,
        }).path
      : growthBuilt.path;

  const overrides: Partial<Assumptions> = {
    revenueGrowth: revPath,
    grossMargin: fill(parsePct(gmStr, activeDefaults.grossMargin), years),
    opexPctRevenue: fill(parsePct(opexStr, activeDefaults.opexPct), years),
  };

  const projection = buildProjection(fin, years, overrides)!;
  const dcfOverrides: Partial<DcfInputs> = {
    beta: Number(betaStr) || activeDefaults.beta,
    riskFree: parsePct(rfStr, activeDefaults.riskFree),
    equityRiskPremium: parsePct(erpStr, activeDefaults.erp),
    terminalGrowth: parsePct(tgStr, activeDefaults.terminalGrowth),
    weightEquity: activeDefaults.weightEquity,
    preTaxCostOfDebt: activeDefaults.preTaxKd,
    taxRate: activeDefaults.taxRate,
    exitMultiple: activeDefaults.exitMultiple,
  };
  const dcf = buildDcf(fin, projection, betaRef, marketPrice, dcfOverrides)!;

  // In-UI sensitivity: tighter steps than the Excel sheet, pure client recompute
  // from the live FCF path so it tracks assumption edits without a download.
  const sensitivity = buildSensitivityMatrix({
    fcf: dcf.fcf,
    baseWacc: dcf.wacc,
    baseGrowth: dcf.inputs.terminalGrowth,
    debt: dcf.debt,
    cash: dcf.cash,
    shares: dcf.shares,
    waccDeltas: UI_WACC_DELTAS,
    growthDeltas: UI_GROWTH_DELTAS,
  });

  const currency = fin.currency || "USD";
  const upside =
    dcf.perShare != null && marketPrice != null && marketPrice > 0
      ? dcf.perShare / marketPrice - 1
      : null;
  const targetUpside =
    streetData?.priceTarget != null && marketPrice != null && marketPrice > 0
      ? streetData.priceTarget / marketPrice - 1
      : null;

  function clearEdits() {
    setBeta(null);
    setRiskFree(null);
    setErp(null);
    setTg(null);
    setY1g(null);
    setGm(null);
    setOpex(null);
  }

  /** Drop overrides and localStorage so the next visit uses model defaults. */
  function resetToDefaults() {
    clearSaved(fin.ticker);
    setPreset("history");
    clearEdits();
  }

  function applyPreset(p: Preset) {
    setPreset(p);
    clearEdits();
  }

  const streetDispersion =
    streetData?.yearlyEps?.length
      ? epsDispersionFromYearly(streetData.yearlyEps)[0]
      : null;
  const streetRevisions = streetData?.yearlyEps?.length
    ? totalRevisionCounts(streetData.yearlyEps)
    : { up: 0, down: 0, hasAny: false };

  const excelParams = new URLSearchParams({
    ticker: fin.ticker,
    preset,
    g: String(revPath[0] ?? parsePct(y1gStr, activeDefaults.year1Growth)),
    gm: String(parsePct(gmStr, activeDefaults.grossMargin)),
    opex: String(parsePct(opexStr, activeDefaults.opexPct)),
    beta: String(Number(betaStr) || activeDefaults.beta),
    rf: String(parsePct(rfStr, activeDefaults.riskFree)),
    erp: String(parsePct(erpStr, activeDefaults.erp)),
    tg: String(parsePct(tgStr, activeDefaults.terminalGrowth)),
  });
  // Full multi-year path so Excel Assumptions match the web DCF (not a 3% slam).
  excelParams.set("gpath", revPath.map((g) => g.toFixed(6)).join(","));
  const excelHref = `/api/research/excel/${cik}?${excelParams.toString()}`;

  const hn = historyDefaults.historyNotes;
  const streetAvailable = streetData?.year1EpsGrowth != null;

  const dcfRange = rangeFromPoints([dcf.perShare, dcf.exitPerShare]);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Valuation</h2>
          <p className="mt-1 max-w-[75ch] text-xs text-zinc-500 dark:text-zinc-400">
            Multi-method free suite: football field, DCF, Monte Carlo, comps,
            SOTP, precedents, LBO, credit, M&A A/D, sector packs, EV bridge, and
            52-week range. Collapsed by default. Not a recommendation.
          </p>
          <DataAsOf
            className="mt-2"
            items={[
              {
                label: "Filings",
                at: loadedAt,
                source: "SEC EDGAR",
              },
              {
                label: "Model",
                at: Date.now(),
                source: "live assumptions",
              },
            ]}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={btnCompact}
            onClick={() => window.print()}
            title="Print IC one-pager (print-only sheet)"
          >
            Print IC one-pager
          </button>
          <a
            href={excelHref}
            download
            className={`${btnCompact} border-zinc-900 text-zinc-900 hover:bg-zinc-900 hover:text-white dark:border-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-100 dark:hover:text-zinc-900`}
          >
            Download Excel with these assumptions
          </a>
        </div>
      </div>

      <div className="print-only">
        <IcMemo
          fin={fin}
          marketPrice={marketPrice}
          priceCurrency={priceCurrency}
          dcfPerShare={dcf.perShare}
          centralEstimate={
            rangeFromPoints([
              dcf.perShare,
              dcf.exitPerShare,
              compsRange?.mid,
              tradingRange?.mid,
              sotpRange?.mid,
            ]).mid
          }
        />
      </div>

      <FootballFieldPanel
        currentPrice={marketPrice}
        dcfGordon={dcf.perShare}
        dcfExit={dcf.exitPerShare}
        comps={compsRange}
        precedents={precedentsRange}
        lbo={lboRange}
        tradingRange={tradingRange}
        sotp={sotpRange}
        monteCarlo={mcRange}
      />

      <EvBridgeCard fin={fin} marketPrice={marketPrice} />
      <SectorPackPanel
        fin={fin}
        marketPrice={marketPrice}
        sector={sector}
        industry={industry}
        sic={sic}
      />

      <ExpandableModel
        title="DCF (discounted cash flow)"
        subtitle="Unlevered FCF, CAPM WACC, Gordon + exit-multiple terminals, sensitivity, reverse DCF."
        summary={
          dcf.perShare != null
            ? `Gordon ${fmtPs(dcf.perShare)}${
                dcf.exitPerShare != null
                  ? ` · Exit ${fmtPs(dcf.exitPerShare)}`
                  : ""
              }`
            : dcfRange.mid != null
              ? fmtPs(dcfRange.mid)
              : "Open to model"
        }
        defaultOpen={false}
      >
      <ModelPresetsBar
        ticker={fin.ticker}
        capture={() => ({
          kind: "dcf",
          preset,
          beta,
          riskFree,
          erp,
          tg,
          y1g,
          gm,
          opex,
        })}
        onLoad={(payload) => {
          if (payload.preset === "street" || payload.preset === "history") {
            setPreset(payload.preset);
          }
          if (typeof payload.beta === "string" || payload.beta === null)
            setBeta(payload.beta as string | null);
          if (typeof payload.riskFree === "string" || payload.riskFree === null)
            setRiskFree(payload.riskFree as string | null);
          if (typeof payload.erp === "string" || payload.erp === null)
            setErp(payload.erp as string | null);
          if (typeof payload.tg === "string" || payload.tg === null)
            setTg(payload.tg as string | null);
          if (typeof payload.y1g === "string" || payload.y1g === null)
            setY1g(payload.y1g as string | null);
          if (typeof payload.gm === "string" || payload.gm === null)
            setGm(payload.gm as string | null);
          if (typeof payload.opex === "string" || payload.opex === null)
            setOpex(payload.opex as string | null);
        }}
      />
      {/* Presets */}
      <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold tracking-tight">Assumption source</p>
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              Pick a starting point, then edit any cell.
            </p>
          </div>
          <div
            className={btnSegmentedCompact}
            role="group"
            aria-label="Assumption preset"
          >
            {(
              [
                ["history", "Company history"],
                ["street", "Street consensus"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                aria-pressed={preset === key}
                disabled={key === "street" && !streetAvailable && !streetLoading}
                onClick={() => applyPreset(key)}
                className={`${btnSegmentedCompactItem(preset === key)} disabled:cursor-not-allowed disabled:opacity-40`}
              >
                {label}
                {key === "street" && streetLoading ? "…" : ""}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-900/50">
            <p className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
              From company history (filings)
            </p>
            <ul className="mt-1.5 space-y-0.5 text-[11px] leading-snug text-zinc-500 dark:text-zinc-400">
              <li>
                Revenue growth seed:{" "}
                <span className="font-mono text-zinc-700 dark:text-zinc-200">
                  {fmtPctDisplay(hn.revenueGrowth)}
                </span>{" "}
                (3y CAGR or last YoY, faded to ≤3%)
              </li>
              <li>
                Gross margin:{" "}
                <span className="font-mono text-zinc-700 dark:text-zinc-200">
                  {fmtPctDisplay(hn.grossMargin)}
                </span>{" "}
                · OpEx/rev:{" "}
                <span className="font-mono text-zinc-700 dark:text-zinc-200">
                  {fmtPctDisplay(hn.opexPct)}
                </span>
              </li>
              <li>
                Tax rate:{" "}
                <span className="font-mono text-zinc-700 dark:text-zinc-200">
                  {fmtPctDisplay(hn.taxRate)}
                </span>{" "}
                · Capex/rev:{" "}
                <span className="font-mono text-zinc-700 dark:text-zinc-200">
                  {fmtPctDisplay(hn.capexPct)}
                </span>
              </li>
              <li>
                Beta:{" "}
                <span className="font-mono text-zinc-700 dark:text-zinc-200">
                  {historyDefaults.beta}
                </span>
                {historyDefaults.sector
                  ? ` (${historyDefaults.sector} SIC seed)`
                  : " (neutral 1.1)"}
              </li>
            </ul>
          </div>

          <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-900/50">
            <p className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
              From street consensus
            </p>
            <p className="mt-0.5 text-[10px] leading-snug text-zinc-500 dark:text-zinc-400">
              {STREET_DISCLAIMER}
            </p>
            {streetLoading && (
              <p className="mt-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                Loading analyst consensus…
              </p>
            )}
            {!streetLoading && !streetData && (
              <p className="mt-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                {streetError ||
                  "No free street estimates for this ticker. History preset still works."}
              </p>
            )}
            {streetData && (
              <ul className="mt-1.5 space-y-0.5 text-[11px] leading-snug text-zinc-500 dark:text-zinc-400">
                <li>
                  Consensus EPS growth (Y1→Y2):{" "}
                  <span className="font-mono text-zinc-700 dark:text-zinc-200">
                    {fmtPctDisplay(streetData.year1EpsGrowth)}
                  </span>
                  {streetData.avgEpsGrowth != null && (
                    <>
                      {" "}
                      · multi-year avg{" "}
                      <span className="font-mono text-zinc-700 dark:text-zinc-200">
                        {fmtPctDisplay(streetData.avgEpsGrowth)}
                      </span>
                    </>
                  )}
                </li>
                {streetData.yearlyEps.length > 0 && (
                  <li className="font-mono text-[10px]">
                    EPS{" "}
                    {streetData.yearlyEps
                      .slice(0, 4)
                      .map((y) => `${y.fiscalEnd || "FY"} $${y.consensus.toFixed(2)}`)
                      .join(" → ")}
                  </li>
                )}
                {streetDispersion &&
                  (streetDispersion.high != null ||
                    streetDispersion.low != null ||
                    streetDispersion.nEstimates != null) && (
                    <li>
                      Dispersion (range, not revision history):{" "}
                      <span className="font-mono text-zinc-700 dark:text-zinc-200">
                        {streetDispersion.low != null || streetDispersion.high != null
                          ? `$${streetDispersion.low?.toFixed(2) ?? "—"}–$${streetDispersion.high?.toFixed(2) ?? "—"}`
                          : "—"}
                      </span>
                      {streetDispersion.nEstimates != null && (
                        <>
                          {" "}
                          · {streetDispersion.nEstimates} est.
                        </>
                      )}
                      {streetRevisions.hasAny && (
                        <>
                          {" "}
                          · rev {streetRevisions.up}↑/{streetRevisions.down}↓
                        </>
                      )}
                    </li>
                  )}
                {streetData.surprises?.[0] && (
                  <li>
                    Last quarter ({streetData.surprises[0].fiscalPeriod}):{" "}
                    <span className="font-mono text-zinc-700 dark:text-zinc-200">
                      ${streetData.surprises[0].actualEps.toFixed(2)}
                    </span>{" "}
                    actual vs{" "}
                    <span className="font-mono text-zinc-700 dark:text-zinc-200">
                      ${streetData.surprises[0].consensusEps.toFixed(2)}
                    </span>{" "}
                    est. —{" "}
                    <span
                      className={
                        streetData.surprises[0].outcome === "beat"
                          ? "text-emerald-700 dark:text-emerald-400"
                          : streetData.surprises[0].outcome === "miss"
                            ? "text-red-700 dark:text-red-400"
                            : "text-zinc-700 dark:text-zinc-200"
                      }
                    >
                      {streetData.surprises[0].outcome}
                      {streetData.surprises[0].surprisePct != null
                        ? ` ${streetData.surprises[0].surprisePct > 0 ? "+" : ""}${streetData.surprises[0].surprisePct.toFixed(1)}%`
                        : ""}
                    </span>
                  </li>
                )}
                <li>
                  Price target:{" "}
                  <span className="font-mono text-zinc-700 dark:text-zinc-200">
                    {streetData.priceTarget != null
                      ? fmtMoney(streetData.priceTarget, priceCurrency)
                      : "—"}
                  </span>
                  {streetData.priceTargetLow != null &&
                    streetData.priceTargetHigh != null && (
                      <span>
                        {" "}
                        (range {fmtMoney(streetData.priceTargetLow, priceCurrency)}–
                        {fmtMoney(streetData.priceTargetHigh, priceCurrency)})
                      </span>
                    )}
                  {targetUpside != null && (
                    <span
                      className={
                        targetUpside >= 0
                          ? " text-emerald-700 dark:text-emerald-400"
                          : " text-red-700 dark:text-red-400"
                      }
                    >
                      {" "}
                      {targetUpside >= 0 ? "+" : ""}
                      {(targetUpside * 100).toFixed(1)}% vs market
                    </span>
                  )}
                </li>
                <li>
                  Rating:{" "}
                  <span className="font-mono text-zinc-700 dark:text-zinc-200">
                    {streetData.meanRating || "—"}
                  </span>
                  {streetData.buy != null && (
                    <span>
                      {" "}
                      ({streetData.buy} buy / {streetData.hold ?? 0} hold /{" "}
                      {streetData.sell ?? 0} sell)
                    </span>
                  )}
                </li>
                <li className="text-[10px]">
                  Source: {streetData.source} (unofficial).{" "}
                  {streetData.disclaimer ?? STREET_DISCLAIMER}
                </li>
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Headline cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Model value / share
            <span className="ml-1 font-normal text-zinc-400">
              ({preset === "street" ? "street" : "history"})
            </span>
          </p>
          <p className="mt-1 font-mono text-xl font-semibold tabular-nums">
            {dcf.perShare != null ? fmtMoney(dcf.perShare, currency) : "—"}
          </p>
          {upside != null && (
            <p
              className={`mt-1 text-xs font-medium ${
                upside >= 0
                  ? "text-emerald-700 dark:text-emerald-400"
                  : "text-red-700 dark:text-red-400"
              }`}
            >
              {upside >= 0 ? "+" : ""}
              {(upside * 100).toFixed(1)}% vs market
            </p>
          )}
        </div>
        <div className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Market price
          </p>
          <p className="mt-1 font-mono text-xl font-semibold tabular-nums">
            {marketPrice != null ? fmtMoney(marketPrice, priceCurrency) : "—"}
          </p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            WACC {(dcf.wacc * 100).toFixed(1)}%
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Street price target
          </p>
          <p className="mt-1 font-mono text-xl font-semibold tabular-nums">
            {streetData?.priceTarget != null
              ? fmtMoney(streetData.priceTarget, priceCurrency)
              : "—"}
          </p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            {streetData?.meanRating ?? "No consensus target"}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Exit-multiple check
          </p>
          <p className="mt-1 font-mono text-xl font-semibold tabular-nums">
            {dcf.exitPerShare != null ? fmtMoney(dcf.exitPerShare, currency) : "—"}
          </p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            {dcf.inputs.exitMultiple}× final EBITDA
          </p>
        </div>
      </div>

      {/* Reverse DCF */}
      {dcf.reverse && (
        <div className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
          <h3 className="text-sm font-semibold tracking-tight">Reverse DCF</h3>
          <p className="mt-1 max-w-[70ch] text-xs text-zinc-500 dark:text-zinc-400">
            Holding this free-cash-flow path fixed, what is today&apos;s price
            pricing in?
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg bg-zinc-50 p-4 dark:bg-zinc-900/50">
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Implied return (at model terminal growth)
              </p>
              <p className="mt-1 font-mono text-2xl font-semibold tabular-nums">
                {(dcf.reverse.impliedReturn * 100).toFixed(1)}%
                {dcf.reverse.returnClamped ? "*" : ""}
              </p>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Discount rate that makes our FCF path worth market EV
              </p>
            </div>
            <div className="rounded-lg bg-zinc-50 p-4 dark:bg-zinc-900/50">
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Implied perpetual growth (at model WACC)
              </p>
              <p className="mt-1 font-mono text-2xl font-semibold tabular-nums">
                {(dcf.reverse.impliedGrowth * 100).toFixed(1)}%
                {dcf.reverse.growthClamped ? "*" : ""}
              </p>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Long-run growth that justifies market EV at{" "}
                {(dcf.wacc * 100).toFixed(1)}% WACC
              </p>
            </div>
          </div>
          {(dcf.reverse.returnClamped || dcf.reverse.growthClamped) && (
            <p className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">
              * Clamped to a searchable bound — the market price sits outside a
              sensible range for this cash-flow path.
            </p>
          )}
        </div>
      )}

      {/* Assumptions */}
      <div className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold tracking-tight">Assumptions</h3>
            <p className="mt-0.5 text-[10px] text-zinc-500 dark:text-zinc-400">
              Saved for {fin.ticker.toUpperCase()} in this browser (localStorage).
              Excel export uses the values shown below.
            </p>
          </div>
          <button
            type="button"
            onClick={resetToDefaults}
            className={btnCompact}
          >
            Reset to defaults
          </button>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <InputRow
            label="Year-1 revenue growth"
            value={y1gStr}
            onChange={setY1g}
            hint={
              preset === "street" && streetData?.year1EpsGrowth != null
                ? `Street EPS path → year-1 ${fmtPctDisplay(revPath[0])} · year-5 ${fmtPctDisplay(revPath[revPath.length - 1])} (not a hard 3% slam)`
                : `History seed ${fmtPctDisplay(hn.revenueGrowth)}; path ends ~${fmtPctDisplay(revPath[revPath.length - 1])}`
            }
          />
          <InputRow
            label="Gross margin"
            value={gmStr}
            onChange={setGm}
            hint={`From filings: ${fmtPctDisplay(hn.grossMargin)}`}
          />
          <InputRow
            label="OpEx % of revenue"
            value={opexStr}
            onChange={setOpex}
            hint={`From filings: ${fmtPctDisplay(hn.opexPct)} (includes D&A)`}
          />
          <InputRow
            label="Terminal growth"
            value={tgStr}
            onChange={setTg}
            hint="Gordon growth; must stay below WACC"
          />
          <InputRow
            label="Beta"
            value={betaStr}
            onChange={setBeta}
            suffix=""
            step="0.05"
            hint={
              historyDefaults.sector
                ? `Sector ref: ${historyDefaults.sector}`
                : "Neutral default 1.1"
            }
          />
          <InputRow label="Risk-free rate" value={rfStr} onChange={setRiskFree} />
          <InputRow label="Equity risk premium" value={erpStr} onChange={setErp} />
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Cost of equity / WACC
            </span>
            <p className="font-mono text-sm tabular-nums">
              {(dcf.costOfEquity * 100).toFixed(1)}% / {(dcf.wacc * 100).toFixed(1)}%
            </p>
            <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
              Equity weight {(dcf.inputs.weightEquity * 100).toFixed(0)}% · after-tax
              Kd {(dcf.afterTaxCostOfDebt * 100).toFixed(1)}%
            </span>
          </div>
        </div>
      </div>

      {/* FCF path */}
      <div>
        <h3 className="mb-2 text-sm font-semibold tracking-tight">
          Projected unlevered free cash flow
        </h3>
        <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/70">
                <th className="px-4 py-2.5 text-left font-medium text-zinc-500 dark:text-zinc-400">
                  Year
                </th>
                {dcf.labels.map((l) => (
                  <th
                    key={l}
                    className="px-4 py-2.5 text-right font-mono text-xs font-medium text-zinc-500 dark:text-zinc-400"
                  >
                    {l}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(
                [
                  ["Revenue", projection.revenue],
                  ["EBIT", dcf.ebit],
                  ["NOPAT", dcf.nopat],
                  ["FCF", dcf.fcf],
                  ["PV of FCF", dcf.pvFcf],
                ] as const
              ).map(([label, row]) => (
                <tr
                  key={label}
                  className="border-b border-zinc-100 last:border-b-0 dark:border-zinc-800/60"
                >
                  <th scope="row" className="px-4 py-2 text-left font-medium">
                    {label}
                  </th>
                  {row.map((v, i) => (
                    <td
                      key={i}
                      className="px-4 py-2 text-right font-mono text-xs tabular-nums"
                    >
                      {fmtBig(v, currency)}
                    </td>
                  ))}
                </tr>
              ))}
              <tr className="border-b border-zinc-100 last:border-b-0 dark:border-zinc-800/60">
                <th
                  scope="row"
                  className="px-4 py-2 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400"
                >
                  Rev growth
                </th>
                {revPath.map((g, i) => (
                  <td
                    key={i}
                    className="px-4 py-2 text-right font-mono text-xs tabular-nums text-zinc-500 dark:text-zinc-400"
                  >
                    {fmtPctDisplay(g)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
          Shares {fmtShares(dcf.shares)} · Net debt{" "}
          {fmtBig(dcf.debt - dcf.cash, currency)} · TV share of EV{" "}
          {(dcf.tvShareOfEv * 100).toFixed(0)}%
        </p>
      </div>

      {/* Sensitivity — live client matrix; Excel export keeps its own wider grid */}
      <div>
        <h3 className="mb-2 text-sm font-semibold tracking-tight">
          Sensitivity — value per share
        </h3>
        <p className="mb-2 max-w-[75ch] text-xs text-zinc-500 dark:text-zinc-400">
          Rows = WACC (base ±1% in 0.5% steps), columns = terminal growth (base
          ±0.5% in 0.25% steps). Same fixed FCF path as the headline DCF. Click a
          growth header or cell to adopt that terminal growth.
        </p>
        <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">
              DCF value per share sensitivity to WACC and terminal growth. Base
              case is highlighted.
            </caption>
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/70">
                <th
                  scope="col"
                  className="sticky left-0 z-10 bg-zinc-50 px-3 py-2 text-left text-xs font-medium text-zinc-500 dark:bg-zinc-900/70 dark:text-zinc-400"
                >
                  WACC ↓ / g →
                </th>
                {sensitivity.growthAxis.map((g, gi) => {
                  const isBaseG = gi === sensitivity.baseGrowthIndex;
                  return (
                    <th
                      key={g}
                      scope="col"
                      className={`px-2 py-2 text-right font-mono text-[11px] font-medium ${
                        isBaseG
                          ? "text-zinc-800 dark:text-zinc-100"
                          : "text-zinc-500 dark:text-zinc-400"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setTg(fmtPctInput(g))}
                        title={`Set terminal growth to ${(g * 100).toFixed(2)}%`}
                        className={`rounded px-1 py-0.5 tabular-nums transition-colors motion-reduce:transition-none hover:bg-zinc-200/80 hover:text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50 ${
                          isBaseG ? "font-semibold" : ""
                        }`}
                      >
                        {(g * 100).toFixed(2)}%
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {sensitivity.waccAxis.map((w, wi) => {
                const isBaseW = wi === sensitivity.baseWaccIndex;
                return (
                  <tr
                    key={w}
                    className="border-b border-zinc-100 last:border-b-0 dark:border-zinc-800/60"
                  >
                    <th
                      scope="row"
                      className={`sticky left-0 z-10 bg-white px-3 py-1.5 text-left font-mono text-[11px] font-medium dark:bg-zinc-950 ${
                        isBaseW
                          ? "text-zinc-800 dark:text-zinc-100"
                          : "text-zinc-500 dark:text-zinc-400"
                      }`}
                    >
                      {(w * 100).toFixed(2)}%
                      {isBaseW ? (
                        <span className="ml-1 text-[9px] font-sans font-normal uppercase tracking-wide text-zinc-400">
                          base
                        </span>
                      ) : null}
                    </th>
                    {sensitivity.values[wi].map((v, gi) => {
                      const isBase =
                        wi === sensitivity.baseWaccIndex &&
                        gi === sensitivity.baseGrowthIndex;
                      const g = sensitivity.growthAxis[gi];
                      return (
                        <td
                          key={gi}
                          className={`px-2 py-1.5 text-right font-mono text-xs tabular-nums ${
                            isBase
                              ? "bg-zinc-900 font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900"
                              : "text-zinc-800 dark:text-zinc-200"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => setTg(fmtPctInput(g))}
                            title={
                              isBase
                                ? "Base case"
                                : `Adopt terminal growth ${(g * 100).toFixed(2)}%`
                            }
                            aria-label={
                              v != null
                                ? `${fmtMoney(v, currency, 2)} at WACC ${(w * 100).toFixed(2)}% and growth ${(g * 100).toFixed(2)}%${isBase ? " (base case)" : ""}`
                                : `Undefined at WACC ${(w * 100).toFixed(2)}% and growth ${(g * 100).toFixed(2)}%`
                            }
                            className={`w-full rounded px-1 py-0.5 text-right transition-colors motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-zinc-400 ${
                              isBase
                                ? "hover:bg-zinc-800 dark:hover:bg-zinc-200"
                                : "hover:bg-zinc-100 dark:hover:bg-zinc-900"
                            }`}
                          >
                            {v != null && Number.isFinite(v)
                              ? fmtMoney(v, currency, 2)
                              : "—"}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {dcf.shares == null && (
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            Diluted share count unavailable — per-share sensitivity omitted.
          </p>
        )}
      </div>
      </ExpandableModel>

      <CompsModelPanel
        ticker={fin.ticker}
        cik={cik}
        sector={sector}
        industry={industry}
        marketCap={marketCap}
        onRange={setCompsRange}
      />
      <PrecedentsModelPanel
        fin={fin}
        sector={sector}
        onRange={setPrecedentsRange}
      />
      <LboModelPanel fin={fin} onRange={setLboRange} />
      <TradingRangePanel
        fin={fin}
        marketPrice={marketPrice}
        onRange={setTradingRange}
      />
      <SotpPanel
        fin={fin}
        segmentsPayload={
          segmentsPayload?.history
            ? {
                product: segmentsPayload.history.rows.map((row) => {
                  const periods = segmentsPayload.history!.periods;
                  const values: Record<string, number | null> = {};
                  periods.forEach((p, i) => {
                    values[p] = row.values[i] ?? null;
                  });
                  return { name: row.name, values, periods };
                }),
              }
            : null
        }
        onRange={setSotpRange}
      />
      <MonteCarloPanel
        fcf={dcf.fcf}
        wacc={dcf.wacc}
        terminalGrowth={dcf.inputs.terminalGrowth}
        debt={dcf.debt}
        cash={dcf.cash}
        shares={dcf.shares}
        basePerShare={dcf.perShare}
        onRange={setMcRange}
      />
      <CreditPanel fin={fin} />
      <MergerPanel fin={fin} marketPrice={marketPrice} />
    </section>
  );
}
