/**
 * Valuation toolkit — pure engines for DCF triangulation on the Valuation tab.
 * UI lives in components/valuation/*; Excel DCF remains in lib/excel-dcf.ts.
 *
 * Stats helpers are only re-exported from ./stats (precedents keeps private copies).
 */

export * from "./stats";
export * from "./metrics";
export * from "./ev-bridge";
export * from "./comps";
export {
  dealMultiples,
  sectorIllustrativePrecedents,
  runPrecedents,
  type PrecedentDeal,
  type PrecedentsResult,
  type MultipleStats,
  type ImpliedMethod,
} from "./precedents";
export * from "./lbo";
export * from "./trading-range";
export * from "./football-field";
export * from "./sotp";
export * from "./merger";
export * from "./monte-carlo-dcf";
export * from "./credit";
export * from "./sector-packs";
