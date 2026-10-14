// Turns a filer's own history plus its SIC into the explicit forecast.
//
// Year-1 growth is the company's trailing revenue growth or street year-1,
// not a sector average. The path then fades toward that sector's mature
// growth. Gordon terminal growth stays on the DCF, separate from this path.
// Operating expenses stay at the filed ratio when the business is already
// profitable. A loss year fades toward the sector's mid-cycle margin instead
// of being locked in for every forecast year.

import type { CompanyFinancials } from "./edgar";
import { sectorForecast } from "./dcf-sector";
import {
  buildRevenueGrowthPath,
  fade,
  historicalRevenueGrowth,
  LONG_RUN_GROWTH,
  type Assumptions,
} from "./excel-projection";

function fill(v: number, years: number): number[] {
  return Array.from({ length: years }, () => v);
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

export interface ForecastSeed {
  assumptions: Partial<Assumptions>;
  /** Explicit-window fade target actually used. */
  longRun: number;
  sector: string | null;
  /** True when opex moves from a loss year toward a sector margin. */
  marginFade: boolean;
  /** Sector steady operating margin, when the SIC mapped. */
  steadyOpMargin: number | null;
}

/**
 * Opex path. A filed operating margin of at least 5% is held flat.
 * Below that, opex fades from the filed ratio toward the opex that earns
 * `steadyOpMargin` on the filed gross margin. A typed opex stays flat.
 */
export function opexForecastPath(opts: {
  years: number;
  filedOpex: number | null;
  filedGross: number | null;
  steadyOpMargin: number | null;
  /** User-typed flat opex. Skips the fade. */
  flatOpex?: number | null;
}): { path: number[]; fading: boolean } {
  const years = Math.max(1, opts.years);
  if (opts.flatOpex != null && Number.isFinite(opts.flatOpex)) {
    return { path: fill(clamp(opts.flatOpex, 0, 0.95), years), fading: false };
  }
  const current = opts.filedOpex;
  const gm = opts.filedGross;
  if (
    current == null ||
    gm == null ||
    !(gm > 0) ||
    opts.steadyOpMargin == null ||
    gm - current >= 0.05
  ) {
    const flat = current != null && Number.isFinite(current) ? clamp(current, 0, 0.95) : 0.2;
    return { path: fill(flat, years), fading: false };
  }
  const start = clamp(current, 0, 1.5);
  const end = clamp(gm - opts.steadyOpMargin, 0.05, 0.85);
  return { path: fade(start, end, years), fading: true };
}

export function forecastAssumptionOverrides(opts: {
  fin: CompanyFinancials;
  sic: string | null | undefined;
  years: number;
  useStreet?: boolean;
  streetPath?: number[] | null;
  streetYear1?: number | null;
  /** Typed year-1 growth. Replaces history and a single street hop. */
  year1Typed?: number | null;
  filedGross: number | null;
  filedOpex: number | null;
  modelGross: number;
  modelOpex: number;
  /** Typed flat gross margin. */
  grossTyped?: number | null;
  /** Typed flat opex. */
  opexTyped?: number | null;
}): ForecastSeed {
  const years = Math.max(1, opts.years);
  const forecast = sectorForecast(opts.sic);
  const longRun = forecast?.matureGrowth ?? LONG_RUN_GROWTH;
  const typed = opts.year1Typed != null && Number.isFinite(opts.year1Typed);
  const streetPath =
    opts.useStreet && !typed && opts.streetPath && opts.streetPath.length > 0
      ? opts.streetPath
      : null;
  const streetYear1 = typed
    ? opts.year1Typed
    : opts.useStreet
      ? (opts.streetYear1 ?? null)
      : null;
  const { path } = buildRevenueGrowthPath({
    years,
    historical: typed ? null : historicalRevenueGrowth(opts.fin.annual),
    streetPath,
    streetYear1,
    longRun,
  });

  const gross =
    opts.grossTyped != null && Number.isFinite(opts.grossTyped)
      ? opts.grossTyped
      : opts.modelGross;
  const opex = opexForecastPath({
    years,
    filedOpex: opts.filedOpex ?? opts.modelOpex,
    filedGross: opts.filedGross ?? opts.modelGross,
    steadyOpMargin: forecast?.steadyOpMargin ?? null,
    flatOpex: opts.opexTyped,
  });

  return {
    assumptions: {
      revenueGrowth: path,
      grossMargin: fill(gross, years),
      opexPctRevenue: opex.path,
    },
    longRun,
    sector: forecast?.sector ?? null,
    marginFade: opex.fading,
    steadyOpMargin: forecast?.steadyOpMargin ?? null,
  };
}
