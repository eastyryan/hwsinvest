// SEC EDGAR XBRL data layer.
// Source of truth: https://data.sec.gov/api/xbrl/companyfacts/CIK{cik}.json
// EDGAR requires a User-Agent identifying the requester.

import { fetchJson, singleFlight, UpstreamError } from "./http";
import { cached, cachedWithMeta } from "./cache";
import { isValidCik, MAX_SEARCH_QUERY } from "./validate";

/** Non-crypto fingerprint hash — avoids `node:crypto` in the client bundle. */
function fingerprintHex(parts: string[]): string {
  let h = 2166136261;
  for (const part of parts) {
    for (let i = 0; i < part.length; i++) {
      h ^= part.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    h ^= 0xff;
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

const UA = "FinanceExplorer/1.0 (easton.ryan@hws.edu)";

/**
 * Cache-key fingerprint for the normalization layer.
 *
 * The Vercel Runtime Cache deliberately survives deployments, so a stale key
 * means a shipped fix has no effect until the TTL expires. That has now
 * happened twice in this codebase: once when `CostsAndExpenses` was removed
 * from the operating-expense tags, and again when the share-scale correction
 * was added and the served data did not change.
 *
 * So the fingerprint covers both halves of what produces a cached value: the
 * tag definitions, and the source of the functions that consume them. Editing
 * either changes the hash and orphans stale entries automatically.
 *
 * Hashing function source rather than a hand-maintained version number is
 * deliberate. A manual bump is a step that has to be remembered on exactly the
 * commits where forgetting it is most damaging, and it was in fact forgotten
 * the first time it mattered.
 *
 * Computed lazily: these are function declarations, so the value cannot be
 * built at module-evaluation time without tripping over initialization order.
 */
let fingerprintCache: string | null = null;

function schemaFingerprint(): string {
  if (fingerprintCache) return fingerprintCache;
  // Every function whose output can end up in a cached payload. A function
  // missing from this list is a silent staleness bug: the share-count guard was
  // added to latestSharesOutstanding, which nothing here referenced, so the
  // fingerprint did not move and production kept serving the old value. If you
  // add a function that shapes normalized output, add it here.
  const normalizerSource = [
    buildSeries,
    buildStatementSet,
    reconcileShareScale,
    repairQuarterEqualToYear,
    sanitizeShareCounts,
    latestSharesOutstanding,
    normalize,
    isAnnualFiling,
    latestByEnd,
    pickUnit,
    currencyOf,
  ]
    .map((fn) => fn.toString())
    .join("");
  fingerprintCache = fingerprintHex([
    JSON.stringify(STATEMENT_DEFS),
    JSON.stringify(IFRS_LINE_TAGS),
    normalizerSource,
  ]).slice(0, 12);
  return fingerprintCache;
}

/** Bad input from the caller, not an upstream failure — maps to a 400. */
export class InvalidCikError extends Error {
  constructor(cik: string) {
    super(`Invalid CIK: ${JSON.stringify(cik)}`);
    this.name = "InvalidCikError";
  }
}

/**
 * The company exists in EDGAR but has no structured companyfacts we can
 * normalize (neither us-gaap nor ifrs-full). Maps to a 404, not a 502.
 * Common for some foreign private issuers that file 20-F/40-F as PDF-only.
 */
export class NoFactsError extends Error {
  constructor(
    message = "No structured XBRL facts (US-GAAP or IFRS) available for this company"
  ) {
    super(message);
    this.name = "NoFactsError";
  }
}

/** SEC company page for a CIK — filings list when companyfacts is empty. */
export function secSubmissionsUrl(cik: string): string {
  const n = String(Number(cik));
  return `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${n}&type=&dateb=&owner=include&count=40`;
}

export interface Fact {
  start?: string;
  end: string;
  val: number;
  fy: number;
  fp: string;
  form: string;
  filed: string;
  frame?: string;
}

export interface PeriodCol {
  key: string; // ISO end date
  label: string; // "FY2025" or "Q1 '26"
  end: string;
}

export interface LineValues {
  key: string;
  label: string;
  values: Record<string, number | null>; // period key -> value
  yoy: Record<string, number | null>;
  qoq: Record<string, number | null>;
  style: "normal" | "subtotal" | "total";
  indent?: boolean;
  perShare?: boolean;
  shares?: boolean;
}

export interface Statement {
  title: string;
  lines: LineValues[];
}

export interface StatementSet {
  periods: PeriodCol[]; // newest first
  statements: Statement[];
}

export type FactsTaxonomy = "us-gaap" | "ifrs-full" | "mixed";

export interface CompanyFinancials {
  name: string;
  cik: string;
  ticker: string;
  /** ISO 4217 code the filer actually reports in. Not always USD. */
  currency: string;
  /** Cover-page shares outstanding — the correct market-cap input. */
  sharesOutstanding: number | null;
  /**
   * Which companyfacts taxonomy supplied statement figures.
   * `ifrs-full` / `mixed` mean at least some lines came from the IFRS bridge
   * (see lib/ifrs-tags.ts). Optional on hand-built fixtures; live normalize always sets it.
   */
  taxonomy?: FactsTaxonomy;
  /** True when any line value was taken from ifrs-full tags. */
  usedIfrsFacts?: boolean;
  /** Statement line keys filled from ifrs-full (empty when pure us-gaap). */
  ifrsLineKeys?: string[];
  annual: StatementSet;
  quarterly: StatementSet;
}

import { STATEMENT_DEFS } from "./line-defs";
import type { LineDef, Kind } from "./line-defs";
import { IFRS_LINE_TAGS, mergeUsGaapWithIfrs } from "./ifrs-tags";


// ---------------------------------------------------------------------------

function daysBetween(a: string, b: string): number {
  return (new Date(b).getTime() - new Date(a).getTime()) / 86400000;
}

const STANDARD_UNITS = ["USD", "USD/shares", "shares", "pure"];

/**
 * Pick the unit series to use, and report which unit it was.
 *
 * Previously this fell back to `Object.keys(units)[0]` and returned bare facts,
 * so a foreign-reporting filer's CAD/EUR figures flowed through the whole app
 * labeled as USD. The caller now records the currency actually used.
 */
function pickUnit(
  units: Record<string, Fact[]>
): { facts: Fact[]; unit: string } | null {
  for (const u of STANDARD_UNITS) {
    if (units[u]?.length) return { facts: units[u], unit: u };
  }
  for (const [unit, facts] of Object.entries(units)) {
    if (facts?.length) return { facts, unit };
  }
  return null;
}

/** "EUR/shares" -> "EUR"; "USD" -> "USD". Non-currency units return null. */
function currencyOf(unit: string): string | null {
  const base = unit.split("/")[0];
  return /^[A-Z]{3}$/.test(base) ? base : null;
}

/**
 * Does this fact come from an annual filing?
 *
 * Forms: 10-K (+ amendments / 10-KT), 20-F and 40-F for foreign private
 * issuers; `fp === "FY"` catches filers that restate a full year inside
 * another form. A trailing-twelve-month figure in a 10-Q is fp="Q2" and fails
 * both, which is the point.
 */
function isAnnualFiling(f: Fact): boolean {
  const form = f.form;
  return (
    form.startsWith("10-K") ||
    form.startsWith("20-F") ||
    form.startsWith("40-F") ||
    f.fp === "FY"
  );
}

/** Annual form used when stamping fiscal-year labels from filing metadata. */
function isAnnualFormLabel(form: string): boolean {
  return (
    form.startsWith("10-K") || form.startsWith("20-F") || form.startsWith("40-F")
  );
}

/** Dedupe facts by end date, preferring the most recently filed value. */
function latestByEnd(facts: Fact[]): Map<string, Fact> {
  const m = new Map<string, Fact>();
  for (const f of facts) {
    const prev = m.get(f.end);
    if (!prev || f.filed >= prev.filed) m.set(f.end, f);
  }
  return m;
}

interface TagSeries {
  annual: Map<string, number>; // end date -> value
  quarterly: Map<string, number>;
}

/**
 * Split a tag's facts into annual and quarterly series keyed by period end.
 * Exported for tests — not part of the module's intended public surface.
 */
export function buildSeries(facts: Fact[], kind: Kind, q4Mode: "subtract" | "average" = "subtract"): TagSeries {
  const annual = new Map<string, number>();
  const quarterly = new Map<string, number>();

  if (kind === "instant") {
    // Instant facts: quarterly = every reported balance date; annual = 10-K dates.
    const byEnd = latestByEnd(facts);
    const annualEnds = new Set(
      facts.filter(isAnnualFiling).map((f) => f.end)
    );
    for (const [end, f] of byEnd) {
      quarterly.set(end, f.val);
      if (annualEnds.has(end)) annual.set(end, f.val);
    }
    return { annual, quarterly };
  }

  // Flow facts. Two reporting styles coexist and both must be handled:
  //
  //   discrete — each 10-Q reports the 3 months just ended (start moves forward)
  //   YTD      — each 10-Q reports cumulatively from the fiscal year start
  //              (start is fixed; durations run ~90 / ~181 / ~273 / ~365)
  //
  // Cash-flow statements are very commonly YTD. The previous implementation
  // accepted only 75-105 and 340-380 day durations and discarded everything
  // else, so for YTD filers every quarter after Q1 vanished and the quarterly
  // Cash Flow Statement rendered blank with no error.
  //
  // Grouping by `start` separates the two styles cleanly: YTD facts within a
  // fiscal year all share one start date, while discrete facts each have their
  // own. Differencing consecutive members of a shared-start ladder recovers the
  // discrete quarters — and because a 10-K's annual fact shares that same start,
  // Q4 falls out of the same operation for free.
  const byStart = new Map<string, Fact[]>();
  const annualFacts: Fact[] = [];
  for (const f of facts) {
    if (!f.start) continue;
    const d = daysBetween(f.start, f.end);
    if (d < 60 || d > 400) continue; // not a quarter/YTD/annual window
    // A 365-day duration alone does not make a fact annual. Amazon reports
    // trailing-twelve-month figures inside its 10-Qs — 102 of them, ending at
    // quarter ends — and treating those as fiscal years put quarter-end columns
    // on the annual axis, three of them per year all labelled the same.
    // Requiring an annual filing is what actually distinguishes a fiscal year.
    if (d >= 340 && d <= 380 && isAnnualFiling(f)) annualFacts.push(f);
    const group = byStart.get(f.start);
    if (group) group.push(f);
    else byStart.set(f.start, [f]);
  }
  // latestByEnd applies the restatement preference (most recently filed wins).
  for (const [end, f] of latestByEnd(annualFacts)) annual.set(end, f.val);

  const quarterLen = (days: number) => Math.max(1, Math.round(days / 91));

  for (const [start, group] of byStart) {
    // One fact per end date (most recently filed wins), oldest end first.
    const rungs = [...latestByEnd(group).values()].sort((a, b) =>
      a.end < b.end ? -1 : 1
    );

    let prevVal: number | null = null;
    let prevEnd: string = start;
    let prevQuarters = 0;

    for (const f of rungs) {
      const totalDays = daysBetween(start, f.end);
      const totalQuarters = quarterLen(totalDays);
      const segmentDays = daysBetween(prevEnd, f.end);

      let segmentVal: number;
      let plausible = true;
      if (prevVal === null) {
        segmentVal = f.val;
      } else if (q4Mode === "average") {
        // Weighted-average series (share counts) don't sum. De-average instead:
        // Qn = n*avg_n - (n-1)*avg_{n-1}.
        //
        // This assumes every rung shares one measurement basis, which a stock
        // split inside the fiscal year breaks: the YTD averages restate onto
        // the post-split basis while the prior rung is pre-split, so the
        // subtraction mixes bases and yields nonsense — NVIDIA's split years
        // produced a Q4 diluted share count of -1.2 billion and, elsewhere,
        // 92 billion against a real ~2.5 billion. A discrete quarter's average
        // must be positive and sit within a sane band of the cumulative average
        // it came from; outside that, it is a split artifact and is dropped
        // rather than shown.
        segmentVal = totalQuarters * f.val - prevQuarters * prevVal;
        plausible = segmentVal > 0 && segmentVal >= f.val * 0.25 && segmentVal <= f.val * 4;
      } else {
        segmentVal = f.val - prevVal;
      }

      // Only emit segments that actually span one quarter. A ladder rung that
      // skips a period (a missed filing) yields a 180-day segment, which is not
      // a quarter and must not be presented as one.
      if (plausible && segmentDays >= 75 && segmentDays <= 105) {
        quarterly.set(f.end, segmentVal);
      }

      prevVal = f.val;
      prevEnd = f.end;
      prevQuarters = totalQuarters;
    }
  }

  // Fallback for discrete filers whose Q4 is never reported on its own: back it
  // out of the annual total minus the three quarters inside it.
  for (const [end, fyVal] of annual) {
    if (quarterly.has(end)) continue;
    const endT = new Date(end).getTime();
    const inside = [...quarterly.entries()].filter(([qEnd]) => {
      const t = new Date(qEnd).getTime();
      return t < endT && t > endT - 360 * 86400000;
    });
    if (inside.length === 3) {
      const sum = inside.reduce((s, [, v]) => s + v, 0);
      const derived = q4Mode === "average" ? 4 * fyVal - sum : fyVal - sum;
      if (derived > 0 || q4Mode !== "average") quarterly.set(end, derived);
    }
  }

  // Final backstop for weighted-average series across a stock split.
  //
  // The per-rung guards catch most split artifacts, but a Q4 derived from
  // quarters that were themselves corrupted can still land out of range, so a
  // last sweep drops any quarterly value that a real share count can't take:
  // non-positive, or more than twice the largest annual figure in the series.
  // NVIDIA's 10-for-1 split produced a Q4 diluted count of -27 billion this
  // way, and elsewhere values near 92 billion against a real ~2.5 billion.
  // Dropping leaves a gap, which is the honest outcome — the split-basis
  // inconsistency across the full history is a separate, known limitation.
  if (q4Mode === "average" && annual.size > 0) {
    const maxAnnual = Math.max(...annual.values());
    for (const [end, v] of quarterly) {
      if (v <= 0 || v > maxAnnual * 2) quarterly.delete(end);
    }
  }

  return { annual, quarterly };
}

function fmtQuarterLabel(end: string): string {
  const d = new Date(end + "T00:00:00Z");
  const month = d.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
  return `${month} '${String(d.getUTCFullYear()).slice(2)}`;
}

function nearestKey(keys: string[], target: number, tolDays: number): string | null {
  let best: string | null = null;
  let bestDiff = Infinity;
  for (const k of keys) {
    const diff = Math.abs(new Date(k).getTime() - target);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = k;
    }
  }
  return bestDiff <= tolDays * 86400000 ? best : null;
}

function pctChange(cur: number | null, prev: number | null): number | null {
  if (cur == null || prev == null || prev === 0) return null;
  return (cur - prev) / Math.abs(prev);
}

/**
 * Correct share counts that a filer tagged in millions or thousands.
 *
 * The XBRL `shares` unit is supposed to carry an absolute count, but filers do
 * get this wrong: McDonald's reports 713.4 diluted shares, meaning 713.4
 * million. Left alone that silently corrupts every per-share calculation
 * downstream.
 *
 * The correction is applied per period, not once for the whole series, because
 * the convention changes mid-history — McDonald's switched to millions in 2021
 * and reported honest unit counts before that, so a single global factor is
 * wrong in one direction or the other for most of the axis.
 *
 * Two independent signals, in order of confidence:
 *
 *   1. The filing's own arithmetic. Net income over diluted EPS is an
 *      independent share count, so the scale error is measurable rather than
 *      guessed. Used wherever both are present.
 *   2. Continuity. Share counts move by single-digit percentages a year, never
 *      by a factor of a thousand. A period that sits a clean power of ten away
 *      from the median of the periods we could measure is mis-scaled.
 *
 * A correction is only ever applied when the discrepancy lands within 10% of a
 * clean power of ten, which ordinary variation cannot produce.
 */
const SCALE_FACTORS = [1e6, 1e3];

function nearFactor(ratio: number): number | null {
  for (const f of SCALE_FACTORS) {
    if (Math.abs(ratio - f) / f <= 0.1) return f;
  }
  return null;
}

function reconcileShareScale(seriesByLine: Map<string, Map<string, number>>): void {
  const shares = seriesByLine.get("sharesDiluted");
  const netIncome = seriesByLine.get("netIncome");
  const eps = seriesByLine.get("epsDiluted");
  if (!shares || shares.size === 0) return;

  // Pass 1: per-period correction from the filing's own EPS arithmetic.
  const corrected = new Map<string, number>();
  for (const [end, reported] of shares) {
    if (reported <= 0) continue;
    const ni = netIncome?.get(end);
    const e = eps?.get(end);
    // A near-zero EPS makes the implied count explode; skip those periods.
    if (ni == null || e == null || Math.abs(e) < 0.05) continue;
    const factor = nearFactor(ni / e / reported);
    if (factor) {
      shares.set(end, reported * factor);
      corrected.set(end, reported * factor);
    } else {
      corrected.set(end, reported);
    }
  }
  if (corrected.size === 0) return;

  // Pass 2: periods with no usable EPS, judged against the measured ones.
  const reference = [...corrected.values()].sort((a, b) => a - b)[
    Math.floor(corrected.size / 2)
  ];
  if (!(reference > 0)) return;
  for (const [end, reported] of shares) {
    if (corrected.has(end) || reported <= 0) continue;
    const factor = nearFactor(reference / reported);
    if (factor) shares.set(end, reported * factor);
  }
}

function buildStatementSet(
  gaap: Record<string, { units: Record<string, Fact[]> }>,
  freq: "annual" | "quarterly",
  ctx: {
    currencies: Set<string>;
    fiscalYearByEnd: Map<string, number>;
    fiscalYearOffset: number;
  }
): StatementSet {
  // Resolve each line's series first.
  const seriesByLine = new Map<string, Map<string, number>>();
  const defsByKey = new Map<string, LineDef>();

  for (const { lines } of STATEMENT_DEFS) {
    for (const def of lines) {
      defsByKey.set(def.key, def);
      // Stitch every fallback tag into one continuous series rather than
      // picking a single winner.
      //
      // Companies migrate tags over time (CostOfSales -> CostOfGoodsAndServicesSold,
      // Revenues -> RevenuesNetOfInterestExpense). Picking only the tag with the
      // freshest end date discarded all the history reported under the old tag,
      // silently truncating the window that CAGR and the long-range charts are
      // computed over.
      //
      // Merge oldest-first so newer tags overwrite older ones where they
      // overlap: the live tag wins on recent periods, the retired tag supplies
      // the earlier history it alone covers.
      const candidates: { series: Map<string, number>; latest: string; rank: number }[] = [];
      for (const [rank, tag] of def.tags.entries()) {
        const entry = gaap[tag];
        if (!entry) continue;
        const picked = pickUnit(entry.units);
        if (!picked || picked.facts.length === 0) continue;
        const cur = currencyOf(picked.unit);
        if (cur) ctx.currencies.add(cur);
        const s = buildSeries(
          picked.facts,
          def.kind,
          def.shares ? "average" : "subtract"
        )[freq];
        if (s.size === 0) continue;
        // Recency is measured over the tag's whole fact set, not the series for
        // this frequency. Measuring per frequency let the annual and quarterly
        // axes crown different winners, so a concept could mean one thing on
        // one view and something else on the other — Progressive's quarterly
        // revenue resolved to investment income while its annual revenue
        // resolved to the total, and the four quarters summed to 3% of the
        // year. The tag a concept resolves to must not depend on which view
        // you are looking at.
        const latest = picked.facts.reduce((m, f) => (f.end > m ? f.end : m), "");
        candidates.push({ series: s, latest, rank });
      }
      // Applied in order, so the last writer wins an overlapping period while
      // earlier ones still supply the periods it doesn't cover. Ranked concepts
      // put the most-preferred tag last; the rest put the freshest tag last.
      candidates.sort((a, b) =>
        def.preferOrder
          ? b.rank - a.rank
          : a.latest < b.latest
            ? -1
            : a.latest > b.latest
              ? 1
              : 0
      );
      let series = new Map<string, number>();
      for (const c of candidates) {
        for (const [k, v] of c.series) series.set(k, v);
      }
      // Impose the documented sign rather than trusting the filer's. See the
      // flipSign / expectPositive notes in line-defs.ts: both directions of
      // sign error occur in real filings, and negating a value that was already
      // negative silently turns an outflow into an inflow.
      if (def.flipSign || def.expectPositive) {
        const signed = new Map<string, number>();
        for (const [k, v] of series) {
          signed.set(k, def.flipSign ? -Math.abs(v) : Math.abs(v));
        }
        series = signed;
      }
      seriesByLine.set(def.key, series);
    }
  }

  // Derived lines (gross profit fallback, FCF).
  for (const [key, def] of defsByKey) {
    if (!def.derive) continue;
    const existing = seriesByLine.get(key)!;
    const sources = [...def.derive.plus, ...def.derive.minus].map(
      (k) => seriesByLine.get(k) ?? new Map<string, number>()
    );
    if (sources.some((s) => s.size === 0)) continue;
    const base = seriesByLine.get(def.derive.plus[0])!;
    for (const end of base.keys()) {
      if (existing.has(end)) continue;
      let val = 0;
      let ok = true;
      for (const k of def.derive.plus) {
        const v = seriesByLine.get(k)?.get(end);
        if (v == null) { ok = false; break; }
        val += v;
      }
      if (ok) {
        for (const k of def.derive.minus) {
          const v = seriesByLine.get(k)?.get(end);
          if (v == null) { ok = false; break; }
          val -= v;
        }
      }
      if (ok) existing.set(end, val);
    }
  }

  reconcileShareScale(seriesByLine);

  // Build the unified period axis from anchor lines.
  const anchorKeys = ["revenue", "netIncome", "totalAssets", "ocf"];
  const allEnds = new Set<string>();
  for (const k of anchorKeys) {
    for (const end of seriesByLine.get(k)?.keys() ?? []) allEnds.add(end);
  }
  const sorted = [...allEnds].sort().reverse(); // newest first
  // Fiscal-year labels come from the filer's own `fy` field where available.
  // Deriving them from the calendar year of the end date mislabels every
  // off-calendar filer — a retailer whose FY2024 ends 2025-02-01 was shown as
  // FY2025 — and there is no universal rule to infer it, which is precisely why
  // the field exists. (Walmart's FY ending Jan 2025 is FY2025; Target's FY
  // ending Feb 2025 is FY2024.)
  const periods: PeriodCol[] = sorted.map((end) => ({
    key: end,
    end,
    label:
      freq === "annual"
        ? `FY${
            ctx.fiscalYearByEnd.get(end) ??
            new Date(end).getUTCFullYear() + ctx.fiscalYearOffset
          }`
        : fmtQuarterLabel(end),
  }));

  // Two quarter ends can land in the same calendar month — a 52/53-week filer
  // whose quarter drifts across a month boundary produces "Mar '11" twice.
  // Adding the day only where it is needed keeps the common case readable.
  if (freq === "quarterly") {
    const counts = new Map<string, number>();
    for (const p of periods) counts.set(p.label, (counts.get(p.label) ?? 0) + 1);
    for (const p of periods) {
      if ((counts.get(p.label) ?? 0) > 1) {
        const d = new Date(p.end + "T00:00:00Z");
        const month = d.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
        p.label = `${month} ${d.getUTCDate()} '${String(d.getUTCFullYear()).slice(2)}`;
      }
    }
  }

  // Fiscal years must decrease strictly as the axis goes back in time. Filers
  // do stamp the wrong `fy` on their own filings — Walmart labels the year
  // ending 2014-01-31 as fy=2013 — which produces two columns with the same
  // heading and no way for a reader to tell which is which. Where the sequence
  // breaks, the neighbouring years win and the outlier is renumbered.
  if (freq === "annual") {
    for (let i = 1; i < periods.length; i++) {
      const prev = Number(periods[i - 1].label.slice(2));
      const cur = Number(periods[i].label.slice(2));
      if (Number.isFinite(prev) && Number.isFinite(cur) && cur >= prev) {
        periods[i].label = `FY${prev - 1}`;
      }
    }
  }

  // Assemble statements with YoY/QoQ.
  const yearMs = 365 * 86400000;
  const quarterMs = 91 * 86400000;
  const statements: Statement[] = STATEMENT_DEFS.map(({ title, lines }) => ({
    title,
    lines: lines
      .map((def) => {
        const series = seriesByLine.get(def.key)!;
        if (series.size === 0) return null;
        const keys = [...series.keys()];
        const values: Record<string, number | null> = {};
        const yoy: Record<string, number | null> = {};
        const qoq: Record<string, number | null> = {};
        for (const p of periods) {
          const cur = series.get(p.key) ?? null;
          values[p.key] = cur;
          const t = new Date(p.key).getTime();
          const yoyKey = nearestKey(keys.filter((k) => k !== p.key), t - yearMs, 20);
          yoy[p.key] = pctChange(cur, yoyKey ? series.get(yoyKey)! : null);
          if (freq === "quarterly") {
            const qoqKey = nearestKey(keys.filter((k) => k !== p.key), t - quarterMs, 20);
            qoq[p.key] = pctChange(cur, qoqKey ? series.get(qoqKey)! : null);
          }
        }
        return {
          key: def.key,
          label: def.label,
          values,
          yoy,
          qoq,
          style: def.style ?? "normal",
          indent: def.indent,
          perShare: def.perShare,
          shares: def.shares,
        } as LineValues;
      })
      .filter((l): l is LineValues => l !== null),
  }));

  return { periods, statements };
}

// ---------------------------------------------------------------------------

interface CompanyFactsRaw {
  entityName: string;
  facts: {
    "us-gaap"?: Record<string, { units: Record<string, Fact[]> }>;
    "ifrs-full"?: Record<string, { units: Record<string, Fact[]> }>;
    dei?: Record<string, { units: Record<string, Fact[]> }>;
  };
}

/** us-gaap tag lists per line key — input to the IFRS bridge. */
function usGaapTagsByLine(): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const { lines } of STATEMENT_DEFS) {
    for (const def of lines) {
      out[def.key] = def.tags;
    }
  }
  return out;
}

export async function fetchCompanyFacts(cik: string): Promise<CompanyFactsRaw> {
  if (!isValidCik(cik)) throw new InvalidCikError(cik);
  const padded = cik.padStart(10, "0");
  const data = await fetchJson<CompanyFactsRaw>(
    `https://data.sec.gov/api/xbrl/companyfacts/CIK${padded}.json`,
    {
      source: "SEC EDGAR",
      headers: { "User-Agent": UA },
      // Multi-megabyte payloads for large filers; needs more than the default.
      timeoutMs: 25_000,
      rateLimit: "sec",
    }
  );
  if (!data) throw new UpstreamError("SEC EDGAR", 404);
  return data;
}

/**
 * Actual shares outstanding as of the latest cover page.
 *
 * Distinct from the `sharesDiluted` income-statement line, which is
 * WeightedAverageNumberOfDilutedSharesOutstanding — a *period average*, and
 * structurally the wrong input for a market-cap calculation.
 */
function latestSharesOutstanding(raw: CompanyFactsRaw): number | null {
  const entry =
    raw.facts.dei?.["EntityCommonStockSharesOutstanding"] ??
    raw.facts.dei?.["EntityCommonStockSharesOutstandingBasic"];
  const picked = entry ? pickUnit(entry.units) : null;
  if (!picked) return null;
  let best: Fact | null = null;
  for (const f of picked.facts) {
    if (!best || f.end > best.end || (f.end === best.end && f.filed >= best.filed)) {
      best = f;
    }
  }
  // Some filers tag a zero here — Simon Property does, being an UPREIT whose
  // units sit with the operating partnership. Zero is not a share count, and
  // treating it as one produced a $0 market cap and a narrative announcing the
  // company was "priced at 0.0x trailing earnings".
  return best && best.val > 0 ? best.val : null;
}

/**
 * Blank any share-count value that a real share count can't take.
 *
 * Weighted-average diluted shares are de-averaged from cumulative filings, and
 * a stock split inside a fiscal year makes that arithmetic mix pre- and
 * post-split bases, yielding negatives or values many times the true count.
 * Those are impossible, not merely imprecise, so they are removed. A value is
 * kept only if it is positive and within an order of magnitude of the largest
 * share figure the company reports — wide enough to tolerate a 10-for-1 split,
 * narrow enough to reject a de-averaging blowup.
 */
function sanitizeShareCounts(set: StatementSet): void {
  for (const st of set.statements) {
    for (const line of st.lines) {
      if (!line.shares) continue;
      const present = Object.values(line.values).filter(
        (v): v is number => v != null && v > 0
      );
      if (present.length === 0) continue;
      const ceiling = Math.max(...present) * 10;
      for (const k of Object.keys(line.values)) {
        const v = line.values[k];
        if (v != null && (v <= 0 || v > ceiling)) line.values[k] = null;
      }
    }
  }
}

/** Exported for tests — not part of the module's intended public surface. */
/**
 * A quarter cannot equal its own fiscal year.
 *
 * Oracle's FY2022 10-K tags Revenues of 42.44B — the full year — with a 91-day
 * duration of March to May 2022, alongside the correct 364-day fact carrying
 * the same value. Its later filings dropped the bad one. Read literally, Q4
 * revenue equals annual revenue and the four quarters sum to 172% of the year.
 *
 * This runs after the per-tag series are merged, because the bad fact and the
 * three good quarters come from different tags: Oracle's real quarters are
 * tagged RevenueFromContractWithCustomerExcludingAssessedTax while the broken
 * one is Revenues, so nothing inside a single tag's series can see the conflict.
 *
 * Exact equality is the signal. A genuine final quarter matches its year only
 * when the other three are exactly zero, in which case the replacement below
 * computes the identical number. The repair is skipped unless all three
 * companion quarters are present, so a sparse filer is never given a fabricated
 * value.
 */
function repairQuarterEqualToYear(annual: StatementSet, quarterly: StatementSet): void {
  const qLine = (key: string) => {
    for (const st of quarterly.statements) {
      const l = st.lines.find((x) => x.key === key);
      if (l) return l;
    }
    return undefined;
  };

  for (const st of annual.statements) {
    for (const aLine of st.lines) {
      // Balance-sheet items are point-in-time, so a quarter matching the year
      // end is not just possible but expected.
      if (st.title === "Balance Sheet") continue;
      const q = qLine(aLine.key);
      if (!q) continue;

      for (const ap of annual.periods) {
        const fyVal = aLine.values[ap.key];
        if (fyVal == null || q.values[ap.key] !== fyVal) continue;

        const endT = new Date(ap.end).getTime();
        const inside = quarterly.periods.filter((qp) => {
          const t = new Date(qp.end).getTime();
          return t < endT && t > endT - 360 * 86400000;
        });
        if (inside.length !== 3) continue;
        const vals = inside.map((qp) => q.values[qp.key]);
        if (vals.some((v) => v == null)) continue;
        const companions = (vals as number[]).reduce((a, b) => a + b, 0);
        q.values[ap.key] = fyVal - companions;
      }
    }
  }
}

export function normalize(
  raw: CompanyFactsRaw,
  cik: string,
  ticker: string
): CompanyFinancials {
  const usGaap = raw.facts["us-gaap"];
  const ifrsFull = raw.facts["ifrs-full"];
  const { bag, usedIfrs, taxonomy, linesFromIfrs } = mergeUsGaapWithIfrs(
    usGaap,
    ifrsFull,
    usGaapTagsByLine()
  );
  // Need at least some concepts after the bridge (full US-GAAP or minimal IFRS).
  if (Object.keys(bag).length === 0) throw new NoFactsError();

  const gaap = bag as Record<string, { units: Record<string, Fact[]> }>;

  // The filer's own fiscal-year labels, taken from annual facts in 10-K / 20-F /
  // 40-F filings.
  //
  // A fact's `fy` is the fiscal year of the *filing* it came from, not of the
  // period it describes: a FY2025 10-K stamps its FY2024 and FY2023
  // comparatives with fy=2025 too. Preferring the earliest filing to report a
  // period fixes that for every year that has a filing of its own.
  //
  // It cannot fix the start of history. XBRL only became mandatory in 2009, so
  // the first 10-K a filer tagged carries FY2008 and FY2007 comparatives that
  // appear nowhere else — three period ends, all stamped fy=2009, with no
  // earlier filing to disambiguate them. Apple, Microsoft, Walmart and most
  // large filers all have this.
  //
  // So an `fy` is trusted only when it claims exactly one period end. The
  // ambiguous ones are labelled from the offset between fiscal and calendar
  // year that the trusted entries agree on, which is the relationship that
  // cannot be derived from an end date alone: Walmart's year ending Jan 2025 is
  // FY2025 (offset +1) while Target's ending Feb 2025 is FY2024 (offset 0).
  const claimedBy = new Map<number, Set<string>>();
  const earliestFy = new Map<string, number>();
  for (const entry of Object.values(gaap)) {
    for (const facts of Object.values(entry.units)) {
      for (const f of facts) {
        if (f.fp !== "FY" || !isAnnualFormLabel(f.form) || !f.start) continue;
        if (typeof f.fy !== "number") continue;
        const d = daysBetween(f.start, f.end);
        if (d < 340 || d > 380) continue;
        const seen = earliestFy.get(f.end);
        if (seen === undefined || f.fy < seen) earliestFy.set(f.end, f.fy);
      }
    }
  }
  for (const [end, fy] of earliestFy) {
    const set = claimedBy.get(fy) ?? new Set<string>();
    set.add(end);
    claimedBy.set(fy, set);
  }

  const fiscalYearByEnd = new Map<string, number>();
  const offsets: number[] = [];
  for (const [end, fy] of earliestFy) {
    if (claimedBy.get(fy)?.size !== 1) continue;
    fiscalYearByEnd.set(end, fy);
    offsets.push(fy - Number(end.slice(0, 4)));
  }
  // Modal offset, so one odd year cannot skew it.
  const tally = new Map<number, number>();
  for (const o of offsets) tally.set(o, (tally.get(o) ?? 0) + 1);
  let fiscalYearOffset = 0;
  let best = 0;
  for (const [o, n] of tally) {
    if (n > best) {
      best = n;
      fiscalYearOffset = o;
    }
  }

  const currencies = new Set<string>();
  const ctx = { currencies, fiscalYearByEnd, fiscalYearOffset };
  const annual = buildStatementSet(gaap, "annual", ctx);
  const quarterly = buildStatementSet(gaap, "quarterly", ctx);
  repairQuarterEqualToYear(annual, quarterly);
  // Final sanitize, after every pass. A share count cannot be negative on any
  // axis, whichever pass produced it — the per-tag guards in buildSeries can't
  // see values that a later cross-statement pass injects. Splits across a
  // fiscal year make quarterly weighted-average share counts unrecoverable, so
  // an impossible one is blanked rather than shown (NVIDIA's split produced a
  // Q4 diluted count of -27 billion this way).
  sanitizeShareCounts(annual);
  sanitizeShareCounts(quarterly);

  // Prefer USD when present; otherwise report whatever the filer actually used
  // so the UI and the Excel export can label it honestly.
  const currency = currencies.has("USD")
    ? "USD"
    : ([...currencies].sort()[0] ?? "USD");

  return {
    name: raw.entityName,
    cik,
    ticker,
    currency,
    sharesOutstanding: latestSharesOutstanding(raw),
    taxonomy,
    usedIfrsFacts: usedIfrs,
    ifrsLineKeys: linesFromIfrs,
    annual,
    quarterly,
  };
}

export async function getCompanyFinancials(
  cik: string,
  ticker: string
): Promise<CompanyFinancials> {
  const { financials } = await getCompanyFinancialsWithMeta(cik, ticker);
  return financials;
}

/**
 * Same as getCompanyFinancials, plus whether the normalized payload came from
 * the in-process/runtime cache (`HIT`) or was rebuilt (`MISS`). Used by the
 * API route for an honest `X-Cache` response header.
 */
export async function getCompanyFinancialsWithMeta(
  cik: string,
  ticker: string
): Promise<{ financials: CompanyFinancials; cache: "HIT" | "MISS" }> {
  if (!isValidCik(cik)) throw new InvalidCikError(cik);
  // Keyed on the CIK alone. The ticker is a display label — the data depends
  // only on the CIK — but including it in the key made every distinct ticker
  // string a guaranteed miss in both cache tiers *and* a separate singleFlight
  // slot. Since the validator admits on the order of 10^21 ticker strings and
  // the route needs no authentication, a caller could force unlimited cold
  // builds: a 200-byte GET became a multi-megabyte SEC download plus a full
  // re-normalize, amplified roughly 20,000x, on shared egress IPs that SEC
  // hard-blocks above 10 req/s.
  const key = `financials:${schemaFingerprint()}:${cik}`;
  // singleFlight collapses concurrent cold-cache requests for the same company
  // into one download instead of N.
  const { value: fin, source } = await singleFlight(key, () =>
    cachedWithMeta(key, { ttl: 21_600, tags: ["financials", `cik:${cik}`] }, async () => {
      const raw = await fetchCompanyFacts(cik);
      // Cache the *normalized* result, not the raw payload: the Runtime Cache
      // has a 2MB item limit that raw companyfacts blows past, and this also
      // skips the re-parse on a hit.
      return normalize(raw, cik, ticker);
    })
  );
  // Applied after the cache read so two callers asking for the same company
  // under different ticker spellings still share one cached payload.
  const financials = fin.ticker === ticker ? fin : { ...fin, ticker };
  return {
    financials,
    cache: source === "miss" ? "MISS" : "HIT",
  };
}

/** Company profile facts from the SEC submissions API (free, reliable). */
export interface SecProfile {
  name: string;
  sic: string | null;
  sicDescription: string | null;
  stateOfIncorporation: string | null;
  fiscalYearEnd: string | null;
  website: string | null;
}

export async function getSecProfile(cik: string): Promise<SecProfile | null> {
  if (!isValidCik(cik)) return null;
  const key = `secprofile:${schemaFingerprint()}:${cik}`;
  try {
    return await singleFlight(key, () =>
      cached(key, { ttl: 86_400, tags: ["profile", `cik:${cik}`] }, async () => {
        const padded = cik.padStart(10, "0");
        const d = await fetchJson<{
          name: string;
          sic?: string;
          sicDescription?: string;
          stateOfIncorporation?: string;
          fiscalYearEnd?: string;
          website?: string;
        }>(`https://data.sec.gov/submissions/CIK${padded}.json`, {
          source: "SEC EDGAR",
          headers: { "User-Agent": UA },
          rateLimit: "sec",
          nullOn: [404],
        });
        if (!d) return null;
        return {
          name: d.name,
          sic: d.sic || null,
          sicDescription: d.sicDescription || null,
          stateOfIncorporation: d.stateOfIncorporation || null,
          fiscalYearEnd: d.fiscalYearEnd || null,
          website: d.website || null,
        };
      })
    );
  } catch {
    // Profile is decorative; never fail the page over it.
    return null;
  }
}

// --- Ticker directory -------------------------------------------------------

export interface TickerEntry {
  cik: string;
  ticker: string;
  name: string;
}

export async function getTickerDirectory(): Promise<TickerEntry[]> {
  const key = "tickers:v2";
  return singleFlight(key, () =>
    cached(key, { ttl: 86_400, tags: ["tickers"] }, async () => {
      const data = await fetchJson<
        Record<string, { cik_str: number; ticker: string; title: string }>
      >("https://www.sec.gov/files/company_tickers.json", {
        source: "SEC EDGAR",
        headers: { "User-Agent": UA },
        timeoutMs: 15_000,
        rateLimit: "sec",
      });
      if (!data) throw new UpstreamError("SEC EDGAR", 502);
      return Object.values(data).map((e) => ({
        cik: String(e.cik_str),
        ticker: e.ticker,
        name: e.title,
      }));
    })
  );
}

export async function searchTickers(query: string, limit = 8): Promise<TickerEntry[]> {
  // Cap before the scan: this runs startsWith/includes over ~10k entries per
  // call, so an unbounded query turns each request into real CPU.
  const q = query.trim().slice(0, MAX_SEARCH_QUERY).toLowerCase();
  if (!q) return [];
  const list = await getTickerDirectory();
  const scored: { score: number; e: TickerEntry }[] = [];
  for (const e of list) {
    const t = e.ticker.toLowerCase();
    const n = e.name.toLowerCase();
    let score = 0;
    if (t === q) score = 100;
    else if (t.startsWith(q)) score = 80 - t.length;
    else if (n.startsWith(q)) score = 60;
    else if (n.includes(q)) score = 40;
    if (score > 0) scored.push({ score, e });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.e);
}

/**
 * The canonical ticker for a CIK, from SEC's own directory.
 *
 * Routes take a ticker from the query string, and it reaches the price and
 * profile lookups, whose caches are keyed on it. The validator admits on the
 * order of 10^21 strings, so a caller could vary it to force uncached upstream
 * calls indefinitely even after the expensive SEC leg was made CIK-only.
 * Resolving from the directory — itself cached for a day — means the client's
 * value never reaches an upstream or a cache key.
 *
 * Falls back to the supplied value only when the CIK is absent from the
 * directory, which happens for filers that have deregistered.
 */
export async function canonicalTicker(cik: string, provided: string): Promise<string> {
  try {
    const dir = await getTickerDirectory();
    const hit = dir.find((e) => e.cik === String(Number(cik)));
    if (hit) return hit.ticker;
  } catch {
    // Directory unavailable: fall through to the caller's value, which the
    // route has already validated.
  }
  return provided.toUpperCase();
}
