import { getCompanyFinancials, getTickerDirectory } from "@/lib/research/edgar";
import { cached } from "@/lib/research/cache";
import { createGate } from "@/lib/research/concurrency";
import { publicErrorMessage } from "@/lib/research/http";
import {
  applyScreenerFilters,
  buildScreenerUniverse,
  parseScreenerQuery,
  scoreCompany,
  SCREENER_MAX_PER_SECTOR,
  SCREENER_MAX_UNIVERSE,
  type ScreenerFilters,
  type ScreenerResult,
  type ScreenerRow,
} from "@/lib/research/screener";
import { isValidCik } from "@/lib/research/validate";

export const maxDuration = 60;

/** Cap concurrent EDGAR financials loads (SEC fair-access). */
const gate = createGate(3);
const GATE_WAIT_MS = 45_000;

/**
 * Free market screener over curated liquid US peers (SECTOR_PEERS maps).
 *
 * Query params (camelCase):
 * - sectors=Technology,Healthcare
 * - q= or search= ticker/name substring
 * - sortBy=grossMargin|revYoy|ticker|...  sortDir=asc|desc
 * - limit=50
 * - minGrossMargin=0.3  maxDebtToEquity=1  (and min/max for each metric key)
 *
 * Metrics are fractions (0.3 = 30% margin) except debtToEquity / currentRatio (multiples).
 * Universe defaults to ~5 liquid names per sector (≤80) to stay free/fast on EDGAR.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const filters = parseScreenerQuery(url.searchParams);

  try {
    const result = await runScreener(filters);
    return Response.json(result);
  } catch (e) {
    console.error("[screener] failed:", e);
    return Response.json(
      { error: publicErrorMessage(e, "Screener is unavailable right now.") },
      { status: 502 }
    );
  }
}

function cacheKey(filters: ScreenerFilters): string {
  // Stable, compact key from the filter surface that affects scoring + output.
  const payload = {
    sectors: filters.sectors?.slice().sort() ?? null,
    min: filters.min ?? null,
    max: filters.max ?? null,
    search: filters.search?.toLowerCase() ?? null,
    limit: filters.limit ?? 50,
    sortBy: filters.sortBy ?? "ticker",
    sortDir:
      filters.sortDir ??
      (filters.sortBy && filters.sortBy !== "ticker" ? "desc" : "asc"),
  };
  return `screener:v1:${JSON.stringify(payload)}`;
}

async function runScreener(filters: ScreenerFilters): Promise<ScreenerResult> {
  return cached(cacheKey(filters), { ttl: 3_600, tags: ["screener"] }, async () => {
    // Universe is built from sector maps only (not full INDUSTRY_PEERS) so the
    // free path stays bounded. Sector filter is applied at universe build time.
    const universe = buildScreenerUniverse(filters.sectors);
    const notes: string[] = [
      `Universe samples up to ${SCREENER_MAX_PER_SECTOR} liquid names per sector ` +
        `(cap ${SCREENER_MAX_UNIVERSE}) from curated SECTOR_PEERS — not a full exchange list.`,
      "Metrics from latest annual SEC statements (EDGAR companyfacts) via buildRatios.",
    ];

    const dir = await getTickerDirectory();
    const byTicker = new Map(dir.map((e) => [e.ticker.toUpperCase(), e]));

    const rows: ScreenerRow[] = [];
    let failed = 0;

    async function loadOne(entry: {
      ticker: string;
      sector: string;
    }): Promise<void> {
      const release = await gate.acquire(GATE_WAIT_MS);
      if (!release) {
        failed++;
        return;
      }
      try {
        const meta = byTicker.get(entry.ticker);
        if (!meta || !isValidCik(meta.cik)) {
          failed++;
          return;
        }
        const fin = await getCompanyFinancials(meta.cik, entry.ticker);
        rows.push(scoreCompany(fin, entry.sector));
      } catch {
        failed++;
      } finally {
        release();
      }
    }

    await Promise.all(universe.map((u) => loadOne(u)));

    // Search / min / max / sort / limit on scored rows. Sector already applied
    // when building the universe; pass without sectors to avoid double-filter.
    const { sectors: _sectors, ...rest } = filters;
    const result = applyScreenerFilters(rows, rest);
    result.universeSize = universe.length;
    result.scored = rows.length;
    result.failed = failed;
    result.notes = [...notes, ...result.notes];
    if (failed > 0) {
      result.notes.push(
        `${failed} ticker(s) could not be loaded from EDGAR and were skipped.`
      );
    }
    return result;
  });
}
