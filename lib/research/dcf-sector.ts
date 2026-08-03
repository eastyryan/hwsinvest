// Sector reference betas for the DCF's cost of equity, keyed by SIC code.
//
// The DCF defaulted every filer to a levered beta of 1.1 — fine as a neutral
// placeholder, wrong as a starting point for a utility (~0.5) or a chip maker
// (~1.6). SEC filings carry a Standard Industrial Classification code, so we can
// seed beta from the filer's own industry instead.
//
// The values are round, published-ballpark levered betas in the spirit of
// Aswath Damodaran's freely distributed US industry dataset — reference points,
// not precision inputs. Beta stays a blue, editable cell in the workbook; this
// only moves where it starts. Kept dependency-free and deterministic (a static
// table, no network call), so it fits the no-external-data design.

export interface SectorBeta {
  sector: string;
  beta: number;
}

// Ordered rules: the first whose SIC range matches wins, so specific industries
// precede the broad major-group fallbacks. Ranges are inclusive 4-digit SIC.
const RULES: { lo: number; hi: number; sector: string; beta: number }[] = [
  // Energy & materials
  { lo: 1300, hi: 1399, sector: "Oil & Gas", beta: 1.0 },
  { lo: 1000, hi: 1299, sector: "Mining & Materials", beta: 1.15 },
  { lo: 1400, hi: 1499, sector: "Mining & Materials", beta: 1.15 },
  // Food, beverage, tobacco, household — consumer staples
  { lo: 2000, hi: 2199, sector: "Consumer Staples", beta: 0.6 },
  { lo: 2840, hi: 2844, sector: "Household & Personal Products", beta: 0.85 },
  // Pharma & biotech
  { lo: 2833, hi: 2835, sector: "Pharmaceuticals", beta: 1.05 },
  { lo: 2836, hi: 2836, sector: "Biotechnology", beta: 1.35 },
  // Chemicals
  { lo: 2800, hi: 2899, sector: "Chemicals", beta: 1.1 },
  // Apparel & textiles
  { lo: 2200, hi: 2399, sector: "Apparel & Textiles", beta: 1.1 },
  { lo: 3100, hi: 3199, sector: "Apparel & Textiles", beta: 1.1 },
  // Publishing / media
  { lo: 2700, hi: 2799, sector: "Media & Publishing", beta: 1.15 },
  // Metals
  { lo: 3300, hi: 3399, sector: "Mining & Materials", beta: 1.15 },
  // Industrial machinery
  { lo: 3400, hi: 3569, sector: "Industrial Machinery", beta: 1.1 },
  // Computers & hardware
  { lo: 3570, hi: 3579, sector: "Computers & Hardware", beta: 1.15 },
  // Semiconductors & electronic components
  { lo: 3670, hi: 3679, sector: "Semiconductors", beta: 1.6 },
  // Communications equipment
  { lo: 3660, hi: 3669, sector: "Communications Equipment", beta: 1.15 },
  // Other electronics
  { lo: 3600, hi: 3699, sector: "Electronics", beta: 1.25 },
  // Motor vehicles
  { lo: 3710, hi: 3716, sector: "Automobiles", beta: 1.35 },
  // Aerospace & defense
  { lo: 3720, hi: 3728, sector: "Aerospace & Defense", beta: 1.05 },
  // Other transportation equipment
  { lo: 3700, hi: 3799, sector: "Transportation Equipment", beta: 1.2 },
  // Instruments & medical devices
  { lo: 3800, hi: 3899, sector: "Healthcare Products", beta: 1.05 },
  // Other manufacturing fallback
  { lo: 2400, hi: 2699, sector: "Manufacturing", beta: 1.1 },
  { lo: 2900, hi: 3099, sector: "Manufacturing", beta: 1.1 },
  { lo: 3200, hi: 3299, sector: "Manufacturing", beta: 1.1 },
  { lo: 3900, hi: 3999, sector: "Manufacturing", beta: 1.1 },
  // Construction
  { lo: 1500, hi: 1799, sector: "Construction", beta: 1.25 },
  // Transportation & logistics
  { lo: 4000, hi: 4700, sector: "Transportation & Logistics", beta: 1.05 },
  // Telecom
  { lo: 4800, hi: 4899, sector: "Telecommunications", beta: 0.9 },
  // Utilities
  { lo: 4900, hi: 4999, sector: "Utilities", beta: 0.45 },
  // Wholesale
  { lo: 5000, hi: 5199, sector: "Wholesale", beta: 1.05 },
  // Restaurants
  { lo: 5810, hi: 5819, sector: "Restaurants", beta: 1.1 },
  // Retail
  { lo: 5200, hi: 5999, sector: "Retail", beta: 1.2 },
  // Banks
  { lo: 6000, hi: 6199, sector: "Banks", beta: 0.9 },
  // Insurance
  { lo: 6300, hi: 6499, sector: "Insurance", beta: 0.8 },
  // Real estate & REITs
  { lo: 6500, hi: 6799, sector: "Real Estate & REITs", beta: 0.9 },
  // Other financial (brokers, holding companies)
  { lo: 6200, hi: 6299, sector: "Financial Services", beta: 1.1 },
  // Software & internet
  { lo: 7370, hi: 7379, sector: "Software & Internet", beta: 1.3 },
  // Other business services
  { lo: 7300, hi: 7399, sector: "Business Services", beta: 1.15 },
  // Media & entertainment
  { lo: 7800, hi: 7999, sector: "Media & Entertainment", beta: 1.15 },
  // Health services
  { lo: 8000, hi: 8099, sector: "Healthcare Services", beta: 0.95 },
];

/**
 * Map a SIC code to a reference sector and levered beta. Returns null when the
 * code is missing or unrecognized, so the caller keeps the neutral 1.1 default.
 */
export function sectorBeta(sic: string | null | undefined): SectorBeta | null {
  if (!sic) return null;
  const n = parseInt(sic, 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  for (const r of RULES) {
    if (n >= r.lo && n <= r.hi) return { sector: r.sector, beta: r.beta };
  }
  return null;
}
