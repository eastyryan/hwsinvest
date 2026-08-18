// Free market screener over curated liquid US names (SECTOR_PEERS / FALLBACK).
// Metrics come from SEC-normalized annual statements via buildRatios — no paid feeds.

import type { CompanyFinancials, StatementSet } from "./edgar";
import { buildRatios } from "./ratios";
import {
  getFallbackPeerTickers,
  getSectorPeerLists,
} from "./peers";

export type ScreenerMetricKey =
  | "revYoy"
  | "grossMargin"
  | "opMargin"
  | "netMargin"
  | "fcfMargin"
  | "roe"
  | "roa"
  | "debtToEquity"
  | "currentRatio";

export const SCREENER_METRIC_KEYS: ScreenerMetricKey[] = [
  "revYoy",
  "grossMargin",
  "opMargin",
  "netMargin",
  "fcfMargin",
  "roe",
  "roa",
  "debtToEquity",
  "currentRatio",
];

export type ScreenerFilters = {
  sectors?: string[]; // Technology, Healthcare, ...
  /** min inclusive, max inclusive, fraction for margins/growth (0.1 = 10%) */
  min?: Partial<Record<ScreenerMetricKey, number>>;
  max?: Partial<Record<ScreenerMetricKey, number>>;
  search?: string; // ticker or name substring
  limit?: number; // default 50
  sortBy?: ScreenerMetricKey | "ticker";
  sortDir?: "asc" | "desc";
};

export type ScreenerRow = {
  ticker: string;
  name: string;
  cik: string;
  sector: string | null;
  metrics: Partial<Record<ScreenerMetricKey, number | null>>;
  periodLabel: string | null;
};

export type ScreenerResult = {
  rows: ScreenerRow[];
  universeSize: number;
  scored: number;
  failed: number;
  asOf: string; // ISO
  notes: string[];
};

/** Keep EDGAR fan-out free/fast: top names per sector, hard cap on total. */
export const SCREENER_MAX_PER_SECTOR = 5;
export const SCREENER_MAX_UNIVERSE = 80;

/** Alias: same list as Financial in SECTOR_PEERS. */
const SECTOR_ALIASES: Record<string, string> = {
  "Financial Services": "Financial",
};

/**
 * Canonical sector labels for the free screener (excludes pure aliases so we
 * do not double-count Financial / Financial Services).
 */
export function listScreenerSectors(): string[] {
  const maps = getSectorPeerLists();
  return Object.keys(maps).filter((s) => !SECTOR_ALIASES[s]);
}

function resolveSectorKey(sector: string): string | null {
  const maps = getSectorPeerLists();
  if (maps[sector]) return SECTOR_ALIASES[sector] ?? sector;
  const lower = sector.trim().toLowerCase();
  for (const key of Object.keys(maps)) {
    if (key.toLowerCase() === lower) return SECTOR_ALIASES[key] ?? key;
  }
  return null;
}

/**
 * Unique tickers from sector maps, optionally filtered by sector.
 * Defaults to the first {@link SCREENER_MAX_PER_SECTOR} names per sector
 * (maps are ordered liquid/large-cap first), capped at {@link SCREENER_MAX_UNIVERSE}.
 */
export function buildScreenerUniverse(
  sectors?: string[]
): { ticker: string; sector: string }[] {
  const maps = getSectorPeerLists();
  let sectorKeys: string[];

  if (sectors?.length) {
    const resolved = new Set<string>();
    for (const s of sectors) {
      const key = resolveSectorKey(s);
      if (key) resolved.add(key);
    }
    sectorKeys = [...resolved];
  } else {
    sectorKeys = listScreenerSectors();
  }

  const seen = new Set<string>();
  const out: { ticker: string; sector: string }[] = [];

  for (const sector of sectorKeys) {
    // Prefer the canonical key; fall back to any alias that maps to it.
    const list =
      maps[sector] ??
      Object.entries(maps).find(([k]) => (SECTOR_ALIASES[k] ?? k) === sector)?.[1] ??
      [];
    let taken = 0;
    for (const raw of list) {
      const ticker = raw.toUpperCase();
      if (!ticker || seen.has(ticker)) continue;
      seen.add(ticker);
      out.push({ ticker, sector });
      taken++;
      if (taken >= SCREENER_MAX_PER_SECTOR) break;
      if (out.length >= SCREENER_MAX_UNIVERSE) return out;
    }
  }

  if (out.length === 0) {
    for (const t of getFallbackPeerTickers()) {
      const ticker = t.toUpperCase();
      if (seen.has(ticker)) continue;
      seen.add(ticker);
      out.push({ ticker, sector: "Large Cap" });
    }
  }

  return out;
}

function findLine(set: StatementSet, key: string) {
  for (const st of set.statements) {
    const l = st.lines.find((x) => x.key === key);
    if (l) return l;
  }
  return undefined;
}

/** Score one company from CompanyFinancials using the same ratio engine as peers. */
export function scoreCompany(
  fin: CompanyFinancials,
  sector?: string | null
): ScreenerRow {
  const set = fin.annual.periods.length > 0 ? fin.annual : fin.quarterly;
  const p = set.periods[0];
  const rev = findLine(set, "revenue");
  const ratios = buildRatios(fin, set === fin.annual ? "annual" : "quarterly");
  const ratioAt = (key: string): number | null => {
    if (!p) return null;
    const line = ratios.lines.find((l) => l.key === key);
    return line?.values[p.key] ?? null;
  };

  return {
    ticker: fin.ticker.toUpperCase(),
    name: fin.name,
    cik: fin.cik,
    sector: sector ?? null,
    metrics: {
      revYoy: p && rev ? rev.yoy[p.key] ?? null : null,
      grossMargin: ratioAt("grossMargin"),
      opMargin: ratioAt("opMargin"),
      netMargin: ratioAt("netMargin"),
      fcfMargin: ratioAt("fcfMargin"),
      roe: ratioAt("roe"),
      roa: ratioAt("roa"),
      debtToEquity: ratioAt("debtToEquity"),
      currentRatio: ratioAt("currentRatio"),
    },
    periodLabel: p?.label ?? null,
  };
}

function metricValue(
  row: ScreenerRow,
  key: ScreenerMetricKey
): number | null {
  const v = row.metrics[key];
  return v == null || !Number.isFinite(v) ? null : v;
}

/**
 * Apply filters/sort to already-scored rows.
 * `universeSize` / `scored` / `failed` default from the input set; the API route
 * may overwrite them with true fan-out stats.
 */
export function applyScreenerFilters(
  rows: ScreenerRow[],
  filters: ScreenerFilters = {}
): ScreenerResult {
  const notes: string[] = [];
  let filtered = rows.slice();

  if (filters.sectors?.length) {
    const want = new Set(
      filters.sectors
        .map((s) => resolveSectorKey(s) ?? s.trim())
        .map((s) => s.toLowerCase())
    );
    filtered = filtered.filter(
      (r) => r.sector != null && want.has(r.sector.toLowerCase())
    );
  }

  if (filters.search?.trim()) {
    const q = filters.search.trim().toLowerCase();
    filtered = filtered.filter(
      (r) =>
        r.ticker.toLowerCase().includes(q) ||
        r.name.toLowerCase().includes(q)
    );
  }

  for (const key of SCREENER_METRIC_KEYS) {
    const min = filters.min?.[key];
    if (min != null && Number.isFinite(min)) {
      filtered = filtered.filter((r) => {
        const v = metricValue(r, key);
        return v != null && v >= min;
      });
    }
    const max = filters.max?.[key];
    if (max != null && Number.isFinite(max)) {
      filtered = filtered.filter((r) => {
        const v = metricValue(r, key);
        return v != null && v <= max;
      });
    }
  }

  const sortBy = filters.sortBy ?? "ticker";
  const sortDir =
    filters.sortDir ?? (sortBy === "ticker" ? "asc" : "desc");
  const mult = sortDir === "asc" ? 1 : -1;

  filtered.sort((a, b) => {
    if (sortBy === "ticker") {
      return mult * a.ticker.localeCompare(b.ticker);
    }
    const av = metricValue(a, sortBy);
    const bv = metricValue(b, sortBy);
    // Nulls last regardless of direction.
    if (av == null && bv == null) return a.ticker.localeCompare(b.ticker);
    if (av == null) return 1;
    if (bv == null) return -1;
    if (av !== bv) return mult * (av < bv ? -1 : 1);
    return a.ticker.localeCompare(b.ticker);
  });

  const limit =
    filters.limit != null && Number.isFinite(filters.limit) && filters.limit > 0
      ? Math.floor(filters.limit)
      : 50;

  if (filtered.length > limit) {
    notes.push(`Showing top ${limit} of ${filtered.length} matches.`);
  }

  return {
    rows: filtered.slice(0, limit),
    universeSize: rows.length,
    scored: rows.length,
    failed: 0,
    asOf: new Date().toISOString(),
    notes,
  };
}

/** Parse camelCase query keys like minGrossMargin / maxDebtToEquity. */
export function parseScreenerQuery(
  params: URLSearchParams
): ScreenerFilters {
  const filters: ScreenerFilters = {};

  const sectorsRaw = params.get("sectors");
  if (sectorsRaw?.trim()) {
    filters.sectors = sectorsRaw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  const q = params.get("q") ?? params.get("search");
  if (q?.trim()) filters.search = q.trim();

  const limitRaw = params.get("limit");
  if (limitRaw != null && limitRaw !== "") {
    const n = Number(limitRaw);
    if (Number.isFinite(n) && n > 0) filters.limit = Math.min(Math.floor(n), 200);
  }

  const sortBy = params.get("sortBy");
  if (sortBy === "ticker" || (SCREENER_METRIC_KEYS as string[]).includes(sortBy ?? "")) {
    filters.sortBy = sortBy as ScreenerMetricKey | "ticker";
  }

  const sortDir = params.get("sortDir");
  if (sortDir === "asc" || sortDir === "desc") filters.sortDir = sortDir;

  const min: Partial<Record<ScreenerMetricKey, number>> = {};
  const max: Partial<Record<ScreenerMetricKey, number>> = {};

  for (const key of SCREENER_METRIC_KEYS) {
    const cap = key.charAt(0).toUpperCase() + key.slice(1);
    const minRaw = params.get(`min${cap}`);
    const maxRaw = params.get(`max${cap}`);
    if (minRaw != null && minRaw !== "") {
      const n = Number(minRaw);
      if (Number.isFinite(n)) min[key] = n;
    }
    if (maxRaw != null && maxRaw !== "") {
      const n = Number(maxRaw);
      if (Number.isFinite(n)) max[key] = n;
    }
  }

  if (Object.keys(min).length) filters.min = min;
  if (Object.keys(max).length) filters.max = max;

  return filters;
}
