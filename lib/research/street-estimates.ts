// Street / consensus estimates for seeding the DCF and street-vs-reported.
//
// No paid APIs. Nasdaq's public analyst endpoints expose consensus EPS
// forecasts, price targets, and quarterly earnings surprises without a key.
// Yahoo has richer modules (revenue growth) but is frequently blocked from
// datacenter IPs — we use Nasdaq as the reliable free path and degrade to
// null when it fails.
//
// Historical beat/miss: company/earnings-surprise (quarterly only).
// Forward estimates: analyst/earnings-forecast (yearly). Annual historical
// consensus-at-report-time is not on these free endpoints — we never invent it.

import { fetchJson, singleFlight } from "./http";
import { cached } from "./cache";
import { isValidTicker } from "./validate";

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const NASDAQ_HEADERS = {
  "User-Agent": BROWSER_UA,
  Accept: "application/json, text/plain, */*",
  Origin: "https://www.nasdaq.com",
  Referer: "https://www.nasdaq.com/",
};

export interface YearlyEpsForecast {
  fiscalEnd: string;
  consensus: number;
  high: number | null;
  low: number | null;
  nEstimates: number | null;
  /**
   * Nasdaq analyst revision counts for this vintage (not a full history series).
   * `up` / `down` = number of estimates revised higher / lower since prior print.
   * Null when the free endpoint omits the fields.
   */
  revisionsUp: number | null;
  revisionsDown: number | null;
}

/** Dispersion of a consensus row — range, not a time-series revision. */
export interface EpsDispersion {
  fiscalEnd: string;
  consensus: number;
  high: number | null;
  low: number | null;
  nEstimates: number | null;
  /** high − low when both exist. */
  range: number | null;
  /** (high − low) / |consensus| when computable. */
  rangePct: number | null;
  revisionsUp: number | null;
  revisionsDown: number | null;
  /** True when Nasdaq provided any up/down revision counts. */
  hasRevisionCounts: boolean;
}

/** Beat / miss / inline — only when both actual and consensus exist. */
export type EpsOutcome = "beat" | "miss" | "inline";

/**
 * One historical quarterly row from Nasdaq earnings-surprise.
 * Both actual and consensus are present → outcome is always set.
 */
export interface EpsSurpriseRow {
  fiscalPeriod: string;
  dateReported: string | null;
  actualEps: number;
  consensusEps: number;
  /** Percent surprise: (actual − consensus) / |consensus| × 100. */
  surprisePct: number | null;
  outcome: EpsOutcome;
}

/** Street EPS hops seed DCF *revenue* growth — they are not a revenue forecast. */
export const STREET_SEEDS = "eps-as-revenue-proxy" as const;

export type StreetSeedKind = typeof STREET_SEEDS;

/**
 * Nasdaq public analyst pages are unofficial, not NTM/IBES, and only seed
 * the DCF revenue-growth *assumption*. Margins stay from filings.
 */
export const STREET_DISCLAIMER =
  "Nasdaq public data is unofficial — not NTM/IBES. EPS consensus only seeds the DCF revenue-growth assumption; margins stay from filings.";

export interface StreetEstimates {
  ticker: string;
  source: string;
  /** Always true for this feed — Nasdaq's public pages, not a licensed tape. */
  unofficial: true;
  /** What the street numbers are allowed to seed. Never a full P&L forecast. */
  seeds: StreetSeedKind;
  disclaimer: string;
  yearlyEps: YearlyEpsForecast[];
  /**
   * YoY growth between consecutive yearly EPS forecasts, in order
   * (length = yearlyEps.length - 1).
   */
  epsGrowthPath: number[];
  /** First hop of the EPS path — default street seed for DCF year-1 growth. */
  year1EpsGrowth: number | null;
  /** Mean of the EPS growth hops (for fade end / context). */
  avgEpsGrowth: number | null;
  priceTarget: number | null;
  priceTargetLow: number | null;
  priceTargetHigh: number | null;
  buy: number | null;
  hold: number | null;
  sell: number | null;
  meanRating: string | null;
  /**
   * Recent quarterly earnings surprises (newest first).
   * Empty when the free surprise endpoint is blocked or has no rows.
   */
  surprises: EpsSurpriseRow[];
}

/** Reported annual diluted EPS column for alignment with forward yearly estimates. */
export interface ReportedAnnualEpsPeriod {
  key: string;
  label: string;
  end: string;
}

export interface AlignedYearlyEps {
  fiscalEnd: string;
  consensus: number;
  high: number | null;
  low: number | null;
  nEstimates: number | null;
  revisionsUp: number | null;
  revisionsDown: number | null;
  reportedEps: number | null;
  reportedLabel: string | null;
  /**
   * Always false for forward-consensus vs filed EPS: free APIs do not give
   * pre-report annual consensus for past years, so we never claim beat/miss.
   */
  canClaimBeatMiss: false;
}

export interface ReportedEpsPoint {
  eps: number;
  label: string;
  end: string;
}

interface NasdaqEarningsForecast {
  data?: {
    yearlyForecast?: {
      rows?: {
        fiscalEnd?: string;
        consensusEPSForecast?: number | string;
        highEPSForecast?: number | string;
        lowEPSForecast?: number | string;
        noOfEstimates?: number | string;
        /** Count of estimates revised up since last snapshot (when present). */
        up?: number | string;
        /** Count of estimates revised down since last snapshot (when present). */
        down?: number | string;
      }[];
    };
  };
}

interface NasdaqTargetPrice {
  data?: {
    consensusOverview?: {
      lowPriceTarget?: number;
      highPriceTarget?: number;
      priceTarget?: number;
      buy?: number;
      sell?: number;
      hold?: number;
    };
  };
}

interface NasdaqRatings {
  data?: {
    meanRatingType?: string;
  };
}

interface NasdaqEarningsSurprise {
  data?: {
    earningsSurpriseTable?: {
      rows?: {
        fiscalQtrEnd?: string;
        dateReported?: string;
        eps?: number | string;
        consensusForecast?: number | string;
        percentageSurprise?: number | string;
      }[];
    };
  };
}

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** Build growth hops from a sequence of yearly consensus EPS figures. */
export function epsGrowthPathFromYearly(
  yearly: YearlyEpsForecast[]
): number[] {
  const path: number[] = [];
  for (let i = 1; i < yearly.length; i++) {
    const prev = yearly[i - 1].consensus;
    const cur = yearly[i].consensus;
    if (prev > 0 && cur > 0) path.push(cur / prev - 1);
  }
  return path;
}

/**
 * High/low/# estimates dispersion for a yearly consensus row.
 * Labels range — not a multi-vintage revision path (free APIs rarely expose that).
 */
export function epsDispersionFromYearly(
  yearly: YearlyEpsForecast[]
): EpsDispersion[] {
  return yearly.map((y) => {
    const range =
      y.high != null && y.low != null && Number.isFinite(y.high) && Number.isFinite(y.low)
        ? y.high - y.low
        : null;
    const rangePct =
      range != null && Math.abs(y.consensus) > 1e-9
        ? range / Math.abs(y.consensus)
        : null;
    return {
      fiscalEnd: y.fiscalEnd,
      consensus: y.consensus,
      high: y.high,
      low: y.low,
      nEstimates: y.nEstimates,
      range,
      rangePct,
      revisionsUp: y.revisionsUp,
      revisionsDown: y.revisionsDown,
      hasRevisionCounts: y.revisionsUp != null || y.revisionsDown != null,
    };
  });
}

/** Aggregate revision counts across forward years (sum of up / down). */
export function totalRevisionCounts(yearly: YearlyEpsForecast[]): {
  up: number;
  down: number;
  hasAny: boolean;
} {
  let up = 0;
  let down = 0;
  let hasAny = false;
  for (const y of yearly) {
    if (y.revisionsUp != null) {
      up += y.revisionsUp;
      hasAny = true;
    }
    if (y.revisionsDown != null) {
      down += y.revisionsDown;
      hasAny = true;
    }
  }
  return { up, down, hasAny };
}

function mean(xs: number[]): number | null {
  if (xs.length === 0) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

/**
 * Clamp a street growth reading into a range a human would type into the DCF.
 * Extremes (pre-revenue biotech, tiny EPS base) get discarded.
 */
export function clampStreetGrowth(g: number | null): number | null {
  if (g == null || !Number.isFinite(g)) return null;
  if (g < -0.4 || g > 0.6) return null;
  return g;
}

/**
 * Classify actual vs consensus. Only call when both numbers exist.
 * Default tolerance is half a cent — below that we treat as inline.
 */
export function classifyEpsOutcome(
  actual: number,
  consensus: number,
  absTol = 0.005
): EpsOutcome {
  const diff = actual - consensus;
  if (Math.abs(diff) <= absTol) return "inline";
  return diff > 0 ? "beat" : "miss";
}

/**
 * Percent surprise: (actual − consensus) / |consensus| × 100.
 * Null when consensus is ~0 (undefined % surprise).
 */
export function computeSurprisePct(
  actual: number,
  consensus: number
): number | null {
  if (!Number.isFinite(actual) || !Number.isFinite(consensus)) return null;
  if (Math.abs(consensus) < 1e-9) return null;
  return ((actual - consensus) / Math.abs(consensus)) * 100;
}

/** Extract a four-digit year from labels like "Sep 2026", "FY2025", "2026". */
export function fiscalYearFromLabel(label: string): number | null {
  if (!label) return null;
  const m = label.match(/(?:FY)?(\d{4})\b/i) ?? label.match(/\b(\d{4})\b/);
  if (!m) return null;
  const y = Number(m[1]);
  return y >= 1990 && y <= 2100 ? y : null;
}

/**
 * Parse Nasdaq surprise table rows into typed surprises with outcomes.
 * Drops rows missing either actual or consensus — never invents beat/miss.
 */
export function parseSurpriseRows(
  rows: {
    fiscalQtrEnd?: string;
    dateReported?: string;
    eps?: number | string;
    consensusForecast?: number | string;
    percentageSurprise?: number | string;
  }[]
): EpsSurpriseRow[] {
  const out: EpsSurpriseRow[] = [];
  for (const row of rows) {
    const actualEps = num(row.eps);
    const consensusEps = num(row.consensusForecast);
    if (actualEps == null || consensusEps == null) continue;
    const fromApi = num(row.percentageSurprise);
    const surprisePct =
      fromApi != null ? fromApi : computeSurprisePct(actualEps, consensusEps);
    out.push({
      fiscalPeriod: row.fiscalQtrEnd?.trim() || "—",
      dateReported: row.dateReported?.trim() || null,
      actualEps,
      consensusEps,
      surprisePct,
      outcome: classifyEpsOutcome(actualEps, consensusEps),
    });
  }
  return out;
}

/** Newest-first periods → first non-null diluted EPS. */
export function latestReportedEps(
  periods: ReportedAnnualEpsPeriod[],
  values: Record<string, number | null>
): ReportedEpsPoint | null {
  for (const p of periods) {
    const v = values[p.key];
    if (v != null && Number.isFinite(v)) {
      return { eps: v, label: p.label, end: p.end };
    }
  }
  return null;
}

/**
 * Align forward yearly consensus to filed annual diluted EPS by period-end year.
 * When both exist we show them side-by-side but never claim beat/miss
 * (forward consensus is not pre-report consensus for a completed year).
 */
export function alignYearlyWithReported(
  yearly: YearlyEpsForecast[],
  periods: ReportedAnnualEpsPeriod[],
  values: Record<string, number | null>
): AlignedYearlyEps[] {
  return yearly.map((y) => {
    const year = fiscalYearFromLabel(y.fiscalEnd);
    let reportedEps: number | null = null;
    let reportedLabel: string | null = null;
    if (year != null) {
      for (const p of periods) {
        const endYear = fiscalYearFromLabel(p.end) ?? fiscalYearFromLabel(p.label);
        if (endYear === year) {
          const v = values[p.key];
          if (v != null && Number.isFinite(v)) {
            reportedEps = v;
            reportedLabel = p.label;
            break;
          }
        }
      }
    }
    return {
      fiscalEnd: y.fiscalEnd,
      consensus: y.consensus,
      high: y.high,
      low: y.low,
      nEstimates: y.nEstimates,
      revisionsUp: y.revisionsUp,
      revisionsDown: y.revisionsDown,
      reportedEps,
      reportedLabel,
      canClaimBeatMiss: false as const,
    };
  });
}

export async function getStreetEstimates(
  ticker: string
): Promise<StreetEstimates | null> {
  if (!isValidTicker(ticker)) return null;
  const t = ticker.toUpperCase();
  // v4: honesty fields (unofficial / eps-as-revenue-proxy / disclaimer).
  const key = `street:v4:${t}`;

  try {
    return await singleFlight(key, () =>
      cached(key, { ttl: 3_600, tags: ["street", `ticker:${t}`], nullTtl: 300 }, async () => {
        const [forecast, target, ratings, surprise] = await Promise.all([
          fetchJson<NasdaqEarningsForecast>(
            `https://api.nasdaq.com/api/analyst/${encodeURIComponent(t)}/earnings-forecast`,
            {
              source: "Nasdaq analyst",
              headers: NASDAQ_HEADERS,
              timeoutMs: 10_000,
              retries: 1,
              nullOn: [404, 403, 429],
            }
          ),
          fetchJson<NasdaqTargetPrice>(
            `https://api.nasdaq.com/api/analyst/${encodeURIComponent(t)}/targetprice`,
            {
              source: "Nasdaq analyst",
              headers: NASDAQ_HEADERS,
              timeoutMs: 10_000,
              retries: 1,
              nullOn: [404, 403, 429],
            }
          ),
          fetchJson<NasdaqRatings>(
            `https://api.nasdaq.com/api/analyst/${encodeURIComponent(t)}/ratings`,
            {
              source: "Nasdaq analyst",
              headers: NASDAQ_HEADERS,
              timeoutMs: 8_000,
              retries: 1,
              nullOn: [404, 403, 429],
            }
          ),
          fetchJson<NasdaqEarningsSurprise>(
            `https://api.nasdaq.com/api/company/${encodeURIComponent(t)}/earnings-surprise`,
            {
              source: "Nasdaq earnings surprise",
              headers: NASDAQ_HEADERS,
              timeoutMs: 10_000,
              retries: 1,
              nullOn: [404, 403, 429],
            }
          ),
        ]);

        const yearlyEps: YearlyEpsForecast[] = [];
        for (const row of forecast?.data?.yearlyForecast?.rows ?? []) {
          const consensus = num(row.consensusEPSForecast);
          // Positive-only for DCF growth seeding (negative bases blow up YoY hops).
          if (consensus == null || consensus <= 0) continue;
          yearlyEps.push({
            fiscalEnd: row.fiscalEnd || "",
            consensus,
            high: num(row.highEPSForecast),
            low: num(row.lowEPSForecast),
            nEstimates: num(row.noOfEstimates),
            revisionsUp: num(row.up),
            revisionsDown: num(row.down),
          });
        }

        const surprises = parseSurpriseRows(
          surprise?.data?.earningsSurpriseTable?.rows ?? []
        );

        const path = epsGrowthPathFromYearly(yearlyEps);
        const overview = target?.data?.consensusOverview;
        const out: StreetEstimates = {
          ticker: t,
          source: "Nasdaq analyst consensus",
          unofficial: true,
          seeds: STREET_SEEDS,
          disclaimer: STREET_DISCLAIMER,
          yearlyEps,
          epsGrowthPath: path,
          year1EpsGrowth: clampStreetGrowth(path[0] ?? null),
          avgEpsGrowth: clampStreetGrowth(mean(path)),
          priceTarget: num(overview?.priceTarget),
          priceTargetLow: num(overview?.lowPriceTarget),
          priceTargetHigh: num(overview?.highPriceTarget),
          buy: num(overview?.buy),
          hold: num(overview?.hold),
          sell: num(overview?.sell),
          meanRating: ratings?.data?.meanRatingType ?? null,
          surprises,
        };

        const hasAnything =
          yearlyEps.length > 0 ||
          surprises.length > 0 ||
          out.priceTarget != null ||
          out.meanRating != null;
        return hasAnything ? out : null;
      })
    );
  } catch {
    return null;
  }
}
