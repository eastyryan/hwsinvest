// Detect material restatements from raw SEC companyfacts.
//
// The normalizer keeps the most-recently-filed value for each period. This
// module surfaces when that winner *differs* from an earlier filing of the
// same period — the signal the normalizer deliberately discards.

import { fetchCompanyFacts } from "./edgar";
import { singleFlight } from "./http";
import { cached } from "./cache";
import { isValidCik } from "./validate";
import type { Fact } from "./edgar";

const REL_TOL = 0.01; // 1% — ignore rounding, catch real restatements

const CONCEPTS: { label: string; key: string; tags: string[] }[] = [
  {
    label: "Revenue",
    key: "revenue",
    tags: [
      "RevenueFromContractWithCustomerExcludingAssessedTax",
      "Revenues",
      "SalesRevenueNet",
    ],
  },
  { label: "Net income", key: "netIncome", tags: ["NetIncomeLoss", "ProfitLoss"] },
  { label: "Total assets", key: "totalAssets", tags: ["Assets"] },
  {
    label: "Stockholders' equity",
    key: "equity",
    tags: [
      "StockholdersEquity",
      "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest",
    ],
  },
  {
    label: "Operating cash flow",
    key: "ocf",
    tags: [
      "NetCashProvidedByUsedInOperatingActivities",
      "NetCashProvidedByUsedInOperatingActivitiesContinuingOperations",
    ],
  },
];

export interface RestatementHit {
  concept: string;
  periodEnd: string;
  firstVal: number;
  lastVal: number;
  firstFiled: string;
  lastFiled: string;
  /** Absolute relative change |last-first|/max(|first|,1). */
  relChange: number;
  /** Normalized statement line key when the concept maps (Revenue → revenue). */
  conceptKey?: string;
}

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
}

function isFullYear(f: Fact): boolean {
  if (!f.start) return true;
  const d = daysBetween(f.start, f.end);
  return d >= 340 && d <= 380;
}

function unitFacts(
  entry: { units: Record<string, Fact[]> } | undefined
): Fact[] {
  if (!entry?.units) return [];
  if (entry.units.USD?.length) return entry.units.USD;
  // Prefer any currency unit with the most facts.
  let best: Fact[] = [];
  for (const facts of Object.values(entry.units)) {
    if (facts?.length > best.length) best = facts;
  }
  return best;
}

/** Pure detection over a us-gaap map (for tests). */
export function findRestatements(
  gaap: Record<string, { units: Record<string, Fact[]> }>
): RestatementHit[] {
  const out: RestatementHit[] = [];
  for (const { label, key, tags } of CONCEPTS) {
    const tag = tags.find((t) => unitFacts(gaap[t]).length > 0);
    if (!tag) continue;
    const facts = unitFacts(gaap[tag]);

    const byEnd = new Map<string, Fact[]>();
    for (const f of facts) {
      if (!f.form?.startsWith("10-K") || f.fp !== "FY" || !f.filed || !isFullYear(f)) {
        continue;
      }
      const g = byEnd.get(f.end);
      if (g) g.push(f);
      else byEnd.set(f.end, [f]);
    }

    for (const [end, group] of byEnd) {
      if (group.length < 2) continue;
      const sorted = [...group].sort((a, b) => a.filed.localeCompare(b.filed));
      const first = sorted[0];
      const last = sorted[sorted.length - 1];
      const base = Math.max(Math.abs(first.val), 1);
      const rel = Math.abs(last.val - first.val) / base;
      if (rel > REL_TOL && first.val !== last.val) {
        out.push({
          concept: label,
          periodEnd: end,
          firstVal: first.val,
          lastVal: last.val,
          firstFiled: first.filed,
          lastFiled: last.filed,
          relChange: rel,
          conceptKey: key,
        });
      }
    }
  }
  out.sort((a, b) => b.relChange - a.relChange);
  return out;
}

/** Unique period-end dates that have at least one material restatement. */
export function restatedPeriodEnds(hits: RestatementHit[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const h of hits) {
    if (!seen.has(h.periodEnd)) {
      seen.add(h.periodEnd);
      out.push(h.periodEnd);
    }
  }
  return out;
}

/** Hits whose period end matches `periodEnd` (ISO date or period key). */
export function hitsForPeriod(
  hits: RestatementHit[],
  periodEnd: string
): RestatementHit[] {
  return hits.filter((h) => h.periodEnd === periodEnd);
}

/**
 * True when either year in a YoY pair was restated for a concept.
 * Growth across that pair mixes latest-filed and originally-filed vintages.
 */
export function yoyComparesRestatedVintages(
  periodKey: string,
  nextPeriodKey: string,
  hits: RestatementHit[]
): boolean {
  if (hits.length === 0) return false;
  return hits.some(
    (h) => h.periodEnd === periodKey || h.periodEnd === nextPeriodKey
  );
}

export async function getRestatements(cik: string): Promise<RestatementHit[]> {
  if (!isValidCik(cik)) return [];
  const key = `restatements:v1:${cik}`;
  try {
    return await singleFlight(key, () =>
      cached(key, { ttl: 21_600, tags: ["restatements", `cik:${cik}`] }, async () => {
        const raw = await fetchCompanyFacts(cik);
        const gaap = raw.facts?.["us-gaap"] ?? {};
        return findRestatements(gaap);
      })
    );
  } catch {
    return [];
  }
}
