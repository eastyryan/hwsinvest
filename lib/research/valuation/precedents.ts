// Precedent transaction analysis (PTA) for IB-style valuation.
//
// Takes a deal universe (real or illustrative sector templates), derives
// EV/Sales and EV/EBITDA multiples, summarises the set, and applies median
// multiples to the subject company. Control-premium uplift is applied to
// enterprise value when requested.

export type PrecedentDeal = {
  id: string;
  target: string;
  acquirer?: string;
  year?: number;
  /** EV paid */
  enterpriseValue?: number | null;
  revenue?: number | null;
  ebitda?: number | null;
  /** Or provide multiples directly */
  evSales?: number | null;
  evEbitda?: number | null;
  premiumPct?: number | null; // control premium if known
  notes?: string;
  /** If true, this is an illustrative sector template not a real deal */
  illustrative?: boolean;
};

export type MultipleStats = {
  values: number[];
  median: number | null;
  mean: number | null;
  p25: number | null;
  p75: number | null;
};

export type ImpliedMethod = {
  multiple: number | null;
  enterpriseValue: number | null;
  equityValue: number | null;
  perShare: number | null;
};

export type PrecedentsResult = {
  deals: PrecedentDeal[];
  stats: {
    evSales: MultipleStats;
    evEbitda: MultipleStats;
  };
  implied: {
    evSales: ImpliedMethod;
    evEbitda: ImpliedMethod;
  };
  range: { low: number | null; mid: number | null; high: number | null };
  notes: string[];
};

// ---------------------------------------------------------------------------
// Local stats (no @/lib/valuation/stats module yet)
// ---------------------------------------------------------------------------

function isFiniteNumber(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

function finiteSorted(values: number[]): number[] {
  return values.filter((v) => Number.isFinite(v)).slice().sort((a, b) => a - b);
}

/** Arithmetic mean of finite values; null when empty. */
export function mean(values: number[]): number | null {
  const v = values.filter((x) => Number.isFinite(x));
  if (!v.length) return null;
  return v.reduce((s, x) => s + x, 0) / v.length;
}

/**
 * Median via linear midpoint of the sorted array.
 * Even length: average of the two central elements.
 */
export function median(values: number[]): number | null {
  const v = finiteSorted(values);
  if (!v.length) return null;
  const mid = Math.floor(v.length / 2);
  if (v.length % 2 === 1) return v[mid];
  return (v[mid - 1] + v[mid]) / 2;
}

/**
 * Percentile in [0, 1] with linear interpolation on the sorted sample
 * (inclusive rank method: index = p * (n - 1)).
 */
export function percentile(values: number[], p: number): number | null {
  const v = finiteSorted(values);
  if (!v.length) return null;
  if (!Number.isFinite(p)) return null;
  const clamped = Math.min(1, Math.max(0, p));
  if (v.length === 1) return v[0];
  const idx = clamped * (v.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return v[lo];
  const w = idx - lo;
  return v[lo] * (1 - w) + v[hi] * w;
}

function summarize(values: number[]): MultipleStats {
  const v = finiteSorted(values);
  return {
    values: v,
    median: median(v),
    mean: mean(v),
    p25: percentile(v, 0.25),
    p75: percentile(v, 0.75),
  };
}

// ---------------------------------------------------------------------------
// Multiples
// ---------------------------------------------------------------------------

/**
 * Resolve EV/Sales and EV/EBITDA for a deal.
 * Prefer explicit multiples; otherwise EV / metric when both are finite and metric > 0.
 */
export function dealMultiples(d: PrecedentDeal): {
  evSales: number | null;
  evEbitda: number | null;
} {
  let evSales: number | null = null;
  let evEbitda: number | null = null;

  if (isFiniteNumber(d.evSales) && d.evSales > 0) {
    evSales = d.evSales;
  } else if (
    isFiniteNumber(d.enterpriseValue) &&
    isFiniteNumber(d.revenue) &&
    d.revenue > 0
  ) {
    evSales = d.enterpriseValue / d.revenue;
  }

  if (isFiniteNumber(d.evEbitda) && d.evEbitda > 0) {
    evEbitda = d.evEbitda;
  } else if (
    isFiniteNumber(d.enterpriseValue) &&
    isFiniteNumber(d.ebitda) &&
    d.ebitda > 0
  ) {
    evEbitda = d.enterpriseValue / d.ebitda;
  }

  return { evSales, evEbitda };
}

// ---------------------------------------------------------------------------
// Illustrative sector templates (NOT real M&A deals)
// ---------------------------------------------------------------------------

type SectorTemplate = {
  id: string;
  target: string;
  acquirer: string;
  year: number;
  evSales: number;
  evEbitda: number;
  premiumPct?: number;
  notes?: string;
};

/**
 * Sector-typical EV/Sales and EV/EBITDA placeholders for PTA scaffolding.
 *
 * IMPORTANT: These are NOT real M&A transactions. They are illustrative
 * templates with ballpark sector multiples so the PTA panel has something
 * to show until the user edits or replaces the deal set with actual comps.
 */
const SECTOR_TEMPLATES: Record<string, SectorTemplate[]> = {
  technology: [
    {
      id: "ill-tech-1",
      target: "SaaS Platform Co (illustrative)",
      acquirer: "Strategic Tech Buyer",
      year: 2023,
      evSales: 8.5,
      evEbitda: 22,
      premiumPct: 0.28,
      notes: "High-growth software — template only",
    },
    {
      id: "ill-tech-2",
      target: "Enterprise Software Inc (illustrative)",
      acquirer: "PE Sponsor",
      year: 2022,
      evSales: 6.0,
      evEbitda: 18,
      premiumPct: 0.22,
    },
    {
      id: "ill-tech-3",
      target: "Semiconductors Ltd (illustrative)",
      acquirer: "Industry Peer",
      year: 2024,
      evSales: 5.5,
      evEbitda: 16,
      premiumPct: 0.2,
    },
    {
      id: "ill-tech-4",
      target: "IT Services Group (illustrative)",
      acquirer: "Global Integrator",
      year: 2021,
      evSales: 2.8,
      evEbitda: 14,
      premiumPct: 0.18,
    },
    {
      id: "ill-tech-5",
      target: "Hardware / Devices Co (illustrative)",
      acquirer: "Strategic Buyer",
      year: 2023,
      evSales: 2.2,
      evEbitda: 12,
      premiumPct: 0.15,
    },
  ],
  healthcare: [
    {
      id: "ill-hc-1",
      target: "Specialty Pharma Co (illustrative)",
      acquirer: "Large Pharma",
      year: 2023,
      evSales: 5.0,
      evEbitda: 15,
      premiumPct: 0.3,
    },
    {
      id: "ill-hc-2",
      target: "MedTech Devices Inc (illustrative)",
      acquirer: "Strategic MedTech",
      year: 2022,
      evSales: 4.5,
      evEbitda: 16,
      premiumPct: 0.25,
    },
    {
      id: "ill-hc-3",
      target: "Healthcare Services LLC (illustrative)",
      acquirer: "PE Healthcare Fund",
      year: 2024,
      evSales: 2.0,
      evEbitda: 12,
      premiumPct: 0.2,
    },
    {
      id: "ill-hc-4",
      target: "Diagnostics Lab (illustrative)",
      acquirer: "Lab Network",
      year: 2021,
      evSales: 3.2,
      evEbitda: 13,
      premiumPct: 0.22,
    },
    {
      id: "ill-hc-5",
      target: "Biotech Platform (illustrative)",
      acquirer: "Big Pharma",
      year: 2023,
      evSales: 7.0,
      evEbitda: 20,
      premiumPct: 0.35,
      notes: "Pipeline premium — template only",
    },
  ],
  industrials: [
    {
      id: "ill-ind-1",
      target: "Industrial Machinery Co (illustrative)",
      acquirer: "Strategic Industrial",
      year: 2023,
      evSales: 1.8,
      evEbitda: 11,
      premiumPct: 0.2,
    },
    {
      id: "ill-ind-2",
      target: "Aerospace Supplier (illustrative)",
      acquirer: "Prime Contractor",
      year: 2022,
      evSales: 2.2,
      evEbitda: 12,
      premiumPct: 0.22,
    },
    {
      id: "ill-ind-3",
      target: "Logistics Operator (illustrative)",
      acquirer: "PE Infrastructure",
      year: 2024,
      evSales: 1.4,
      evEbitda: 10,
      premiumPct: 0.18,
    },
    {
      id: "ill-ind-4",
      target: "Building Products Inc (illustrative)",
      acquirer: "Industry Consolidator",
      year: 2021,
      evSales: 1.6,
      evEbitda: 10.5,
      premiumPct: 0.2,
    },
    {
      id: "ill-ind-5",
      target: "Electrical Equipment Co (illustrative)",
      acquirer: "Strategic Buyer",
      year: 2023,
      evSales: 2.0,
      evEbitda: 11.5,
      premiumPct: 0.19,
    },
  ],
  financial: [
    {
      id: "ill-fin-1",
      target: "Regional Bank (illustrative)",
      acquirer: "Money-Center Bank",
      year: 2023,
      evSales: 3.5,
      evEbitda: 10,
      premiumPct: 0.15,
      notes: "Banks often valued on P/TBV; EV multiples are rough placeholders",
    },
    {
      id: "ill-fin-2",
      target: "Asset Manager (illustrative)",
      acquirer: "Global AUM Platform",
      year: 2022,
      evSales: 4.0,
      evEbitda: 12,
      premiumPct: 0.2,
    },
    {
      id: "ill-fin-3",
      target: "Insurance Broker (illustrative)",
      acquirer: "PE Roll-up",
      year: 2024,
      evSales: 3.2,
      evEbitda: 13,
      premiumPct: 0.25,
    },
    {
      id: "ill-fin-4",
      target: "Payments / Fintech Co (illustrative)",
      acquirer: "Strategic Fintech",
      year: 2023,
      evSales: 6.5,
      evEbitda: 18,
      premiumPct: 0.28,
    },
    {
      id: "ill-fin-5",
      target: "Specialty Finance (illustrative)",
      acquirer: "Banking Group",
      year: 2021,
      evSales: 2.8,
      evEbitda: 9,
      premiumPct: 0.18,
    },
  ],
  energy: [
    {
      id: "ill-en-1",
      target: "E&P Producer (illustrative)",
      acquirer: "Major Oil",
      year: 2023,
      evSales: 2.5,
      evEbitda: 6,
      premiumPct: 0.15,
    },
    {
      id: "ill-en-2",
      target: "Midstream MLP OpCo (illustrative)",
      acquirer: "Infrastructure Fund",
      year: 2022,
      evSales: 4.0,
      evEbitda: 10,
      premiumPct: 0.12,
    },
    {
      id: "ill-en-3",
      target: "Oilfield Services (illustrative)",
      acquirer: "Strategic OFS",
      year: 2024,
      evSales: 1.5,
      evEbitda: 7,
      premiumPct: 0.18,
    },
    {
      id: "ill-en-4",
      target: "Refiner / Downstream (illustrative)",
      acquirer: "Integrated Energy",
      year: 2021,
      evSales: 0.6,
      evEbitda: 5.5,
      premiumPct: 0.1,
    },
    {
      id: "ill-en-5",
      target: "Renewables Developer (illustrative)",
      acquirer: "Utility / Infra",
      year: 2023,
      evSales: 5.0,
      evEbitda: 12,
      premiumPct: 0.2,
    },
  ],
  consumer: [
    {
      id: "ill-con-1",
      target: "Branded CPG Co (illustrative)",
      acquirer: "Strategic CPG",
      year: 2023,
      evSales: 2.5,
      evEbitda: 13,
      premiumPct: 0.22,
    },
    {
      id: "ill-con-2",
      target: "Specialty Retailer (illustrative)",
      acquirer: "PE Retail Fund",
      year: 2022,
      evSales: 1.2,
      evEbitda: 9,
      premiumPct: 0.18,
    },
    {
      id: "ill-con-3",
      target: "Restaurant Chain (illustrative)",
      acquirer: "Strategic Restaurant",
      year: 2024,
      evSales: 2.0,
      evEbitda: 11,
      premiumPct: 0.2,
    },
    {
      id: "ill-con-4",
      target: "Apparel Brand (illustrative)",
      acquirer: "Luxury Group",
      year: 2021,
      evSales: 1.8,
      evEbitda: 10,
      premiumPct: 0.25,
    },
    {
      id: "ill-con-5",
      target: "eCommerce / DTC (illustrative)",
      acquirer: "Strategic Retail",
      year: 2023,
      evSales: 1.5,
      evEbitda: 12,
      premiumPct: 0.2,
    },
  ],
  default: [
    {
      id: "ill-mkt-1",
      target: "Broad Market Co A (illustrative)",
      acquirer: "Strategic Buyer",
      year: 2023,
      evSales: 2.5,
      evEbitda: 12,
      premiumPct: 0.22,
    },
    {
      id: "ill-mkt-2",
      target: "Broad Market Co B (illustrative)",
      acquirer: "PE Sponsor",
      year: 2022,
      evSales: 2.0,
      evEbitda: 11,
      premiumPct: 0.2,
    },
    {
      id: "ill-mkt-3",
      target: "Broad Market Co C (illustrative)",
      acquirer: "Industry Peer",
      year: 2024,
      evSales: 3.0,
      evEbitda: 13,
      premiumPct: 0.25,
    },
    {
      id: "ill-mkt-4",
      target: "Broad Market Co D (illustrative)",
      acquirer: "Strategic Buyer",
      year: 2021,
      evSales: 1.8,
      evEbitda: 10,
      premiumPct: 0.18,
    },
    {
      id: "ill-mkt-5",
      target: "Broad Market Co E (illustrative)",
      acquirer: "Consortium",
      year: 2023,
      evSales: 2.8,
      evEbitda: 12.5,
      premiumPct: 0.2,
    },
  ],
};

function normalizeSectorKey(sector: string | null): string {
  if (!sector) return "default";
  const s = sector.trim().toLowerCase();
  if (!s) return "default";

  if (
    s.includes("tech") ||
    s.includes("software") ||
    s.includes("semiconductor") ||
    s.includes("information") ||
    s.includes("internet") ||
    s.includes("communication")
  ) {
    return "technology";
  }
  if (
    s.includes("health") ||
    s.includes("pharma") ||
    s.includes("biotech") ||
    s.includes("medical") ||
    s.includes("drug")
  ) {
    return "healthcare";
  }
  if (
    s.includes("industrial") ||
    s.includes("aerospace") ||
    s.includes("defense") ||
    s.includes("machinery") ||
    s.includes("transport") ||
    s.includes("construction") ||
    s.includes("manufactur")
  ) {
    return "industrials";
  }
  if (
    s.includes("financ") ||
    s.includes("bank") ||
    s.includes("insurance") ||
    s.includes("capital market") ||
    s.includes("asset manag")
  ) {
    return "financial";
  }
  if (
    s.includes("energy") ||
    s.includes("oil") ||
    s.includes("gas") ||
    s.includes("utility") ||
    s.includes("utilities") ||
    s.includes("renewable")
  ) {
    return "energy";
  }
  if (
    s.includes("consumer") ||
    s.includes("retail") ||
    s.includes("restaurant") ||
    s.includes("staples") ||
    s.includes("discretionary") ||
    s.includes("apparel") ||
    s.includes("food") ||
    s.includes("beverage")
  ) {
    return "consumer";
  }
  return "default";
}

/**
 * Return 4–6 illustrative precedent deals with sector-typical multiples.
 *
 * These are placeholders marked `illustrative: true` — not real M&A deals.
 * Replace with actual transaction comps before relying on PTA output.
 */
export function sectorIllustrativePrecedents(
  sector: string | null
): PrecedentDeal[] {
  const key = normalizeSectorKey(sector);
  const templates = SECTOR_TEMPLATES[key] ?? SECTOR_TEMPLATES.default;
  return templates.map((t) => ({
    id: t.id,
    target: t.target,
    acquirer: t.acquirer,
    year: t.year,
    evSales: t.evSales,
    evEbitda: t.evEbitda,
    premiumPct: t.premiumPct ?? null,
    notes:
      t.notes ??
      "Illustrative sector template — not a real M&A transaction. Edit or replace with actual deal comps.",
    illustrative: true,
  }));
}

// ---------------------------------------------------------------------------
// PTA engine
// ---------------------------------------------------------------------------

function applyImplied(
  multiple: number | null,
  metric: number | null,
  subjectNetDebt: number | null,
  subjectShares: number | null,
  premiumFactor: number
): ImpliedMethod {
  if (
    multiple == null ||
    !isFiniteNumber(multiple) ||
    multiple <= 0 ||
    metric == null ||
    !isFiniteNumber(metric) ||
    // Allow zero revenue/EBITDA? No — zero metric yields zero EV, not useful.
    // Negative metrics would invert multiples; refuse.
    !(metric > 0)
  ) {
    return {
      multiple: isFiniteNumber(multiple) && multiple > 0 ? multiple : null,
      enterpriseValue: null,
      equityValue: null,
      perShare: null,
    };
  }

  const rawEv = multiple * metric;
  const enterpriseValue = rawEv * premiumFactor;
  const equityValue = isFiniteNumber(subjectNetDebt)
    ? enterpriseValue - subjectNetDebt
    : enterpriseValue;
  const perShare =
    isFiniteNumber(subjectShares) && subjectShares > 0
      ? equityValue / subjectShares
      : null;

  return {
    multiple,
    enterpriseValue,
    equityValue,
    perShare,
  };
}

export function runPrecedents(args: {
  deals: PrecedentDeal[];
  subjectRevenue: number | null;
  subjectEbitda: number | null;
  subjectNetDebt: number | null;
  subjectShares: number | null;
  /** e.g. 0.25 → EV multiplied by 1.25 (control premium uplift on EV) */
  controlPremiumUplift?: number;
}): PrecedentsResult {
  const {
    deals,
    subjectRevenue,
    subjectEbitda,
    subjectNetDebt,
    subjectShares,
    controlPremiumUplift,
  } = args;

  const premiumFactor =
    isFiniteNumber(controlPremiumUplift) && controlPremiumUplift >= 0
      ? 1 + controlPremiumUplift
      : 1;

  const salesValues: number[] = [];
  const ebitdaValues: number[] = [];
  let missingEbitdaCount = 0;
  let illustrativeCount = 0;

  for (const d of deals) {
    if (d.illustrative) illustrativeCount++;
    const m = dealMultiples(d);
    if (m.evSales != null) salesValues.push(m.evSales);
    if (m.evEbitda != null) ebitdaValues.push(m.evEbitda);
    else missingEbitdaCount++;
  }

  const stats = {
    evSales: summarize(salesValues),
    evEbitda: summarize(ebitdaValues),
  };

  const implied = {
    evSales: applyImplied(
      stats.evSales.median,
      subjectRevenue,
      subjectNetDebt,
      subjectShares,
      premiumFactor
    ),
    evEbitda: applyImplied(
      stats.evEbitda.median,
      subjectEbitda,
      subjectNetDebt,
      subjectShares,
      premiumFactor
    ),
  };

  // Per-share levels for range: median methods + p25/p75 of each multiple type.
  const perShareLevels: number[] = [];
  const midMethods: number[] = [];

  for (const method of [implied.evSales, implied.evEbitda]) {
    if (isFiniteNumber(method.perShare)) {
      perShareLevels.push(method.perShare);
      midMethods.push(method.perShare);
    }
  }

  const bandMultiples: { mult: number | null; metric: number | null }[] = [
    { mult: stats.evSales.p25, metric: subjectRevenue },
    { mult: stats.evSales.p75, metric: subjectRevenue },
    { mult: stats.evEbitda.p25, metric: subjectEbitda },
    { mult: stats.evEbitda.p75, metric: subjectEbitda },
  ];
  for (const b of bandMultiples) {
    const imp = applyImplied(
      b.mult,
      b.metric,
      subjectNetDebt,
      subjectShares,
      premiumFactor
    );
    if (isFiniteNumber(imp.perShare)) perShareLevels.push(imp.perShare);
  }

  let low: number | null = null;
  let high: number | null = null;
  let mid: number | null = null;

  if (perShareLevels.length) {
    low = Math.min(...perShareLevels);
    high = Math.max(...perShareLevels);
  }
  if (midMethods.length) {
    mid = mean(midMethods);
  } else if (low != null && high != null) {
    mid = (low + high) / 2;
  }

  const notes: string[] = [];

  if (deals.length > 0 && illustrativeCount === deals.length) {
    notes.push(
      "Deal set is illustrative-only. Implied prices are a sandbox, not a valuation — do not use for a price."
    );
  } else if (illustrativeCount > 0) {
    notes.push(
      `${illustrativeCount} of ${deals.length} deal(s) are illustrative sector templates, not real M&A transactions. Replace with actual comps before relying on PTA.`
    );
  }
  if (deals.length === 0) {
    notes.push("No precedent deals provided.");
  } else {
    const nSales = stats.evSales.values.length;
    const nEbitda = stats.evEbitda.values.length;
    if (nSales < 3 && nEbitda < 3) {
      notes.push(
        `Thin deal set: only ${nSales} EV/Sales and ${nEbitda} EV/EBITDA multiple(s). Medians and percentiles are unstable.`
      );
    } else if (nSales < 3 || nEbitda < 3) {
      notes.push(
        `Limited coverage on one multiple: ${nSales} EV/Sales, ${nEbitda} EV/EBITDA observation(s).`
      );
    }
  }
  if (missingEbitdaCount > 0 && deals.length > 0) {
    notes.push(
      `${missingEbitdaCount} deal(s) lack a usable EV/EBITDA multiple (missing EV, EBITDA, or both).`
    );
  }
  if (
    subjectEbitda == null ||
    !isFiniteNumber(subjectEbitda) ||
    !(subjectEbitda > 0)
  ) {
    notes.push(
      "Subject EBITDA missing or non-positive — EV/EBITDA method not applied."
    );
  }
  if (
    subjectRevenue == null ||
    !isFiniteNumber(subjectRevenue) ||
    !(subjectRevenue > 0)
  ) {
    notes.push(
      "Subject revenue missing or non-positive — EV/Sales method not applied."
    );
  }
  if (premiumFactor !== 1) {
    notes.push(
      `Control premium uplift of ${((premiumFactor - 1) * 100).toFixed(1)}% applied to enterprise value (EV × ${premiumFactor.toFixed(3)}).`
    );
  }
  if (
    subjectShares == null ||
    !isFiniteNumber(subjectShares) ||
    !(subjectShares > 0)
  ) {
    notes.push("Subject share count missing — per-share values not computed.");
  }

  return {
    deals,
    stats,
    implied,
    range: { low, mid, high },
    notes,
  };
}

/**
 * True when the deal set contains at least one non-template transaction.
 * Empty sets and 100% illustrative templates are not football-field inputs.
 */
export function precedentsAreActionable(deals: PrecedentDeal[]): boolean {
  return deals.some((d) => d.illustrative !== true);
}
