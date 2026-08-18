// Specialized presentation modes for banks and insurers.
//
// Industrial COGS / gross-margin framing is often meaningless for deposit-funded
// banks and premium/claims insurers. This module detects those filers from SIC
// and sector/industry strings (Yahoo + SEC profile) and exposes preference lists
// so Overview, ratios, and the scorecard can re-emphasize ROE, ROA, leverage,
// and top-line (revenue/premiums) without inventing unmapped SEC tags.
//
// Detection reuses the same SIC major groups as lib/dcf-sector.ts (Banks
// 6000–6199, Insurance 6300–6499) plus tighter bank ranges and free-text
// industry heuristics. Missing profile → standard mode.

import { sectorBeta } from "./dcf-sector";

export type SectorMode = "bank" | "insurer" | "standard";

/** Profile fields available on the financials payload / CompanyView. */
export interface SectorModeProfile {
  sic?: string | null;
  sector?: string | null;
  industry?: string | null;
  /** SEC sicDescription when Yahoo industry is absent. */
  sicDescription?: string | null;
}

export interface SectorModeBanner {
  title: string;
  body: string;
}

/**
 * Gaps vs a full bank/insurer model (no new SEC tags required for this mode).
 * Documented so callers know what we cannot emphasize yet.
 */
export const SECTOR_MODE_GAPS: Record<"bank" | "insurer", string[]> = {
  bank: [
    "NIM proxy (when tagged) is net interest income / total assets — not average earning assets.",
    "Deposits are a dedicated liability line when tagged; CET1 / tier-1 capital still not in this map.",
    "Interest expense is deposit/funding cost, not industrial leverage — coverage is de-emphasized.",
    "Industrial DCF/FCF is the wrong primary tool — prefer P/B, P/TBV, ROE, NIM.",
  ],
  insurer: [
    "Combined-ratio proxy (when tagged) is policyholder benefits / premiums earned — not a statutory combined ratio.",
    "No float, reserve adequacy, or statutory surplus metrics from this map.",
    "Premiums and policy benefits are separate keys when tagged; otherwise they may still sit inside Revenue / COGS.",
  ],
};

/** Inclusive 4-digit SIC ranges used for bank detection (tight + holding co.). */
const BANK_SIC_RANGES: [number, number][] = [
  [6020, 6036], // commercial & savings institutions
  [6081, 6099], // foreign banks / banking-related functions
  [6712, 6712], // bank holding companies
  [6000, 6199], // broader depository / credit institutions (dcf-sector Banks)
];

/** Inclusive 4-digit SIC ranges for insurers (carriers; agents fall in text heuristics). */
const INSURER_SIC_RANGES: [number, number][] = [
  [6311, 6399], // life, accident, fire, casualty, surety, etc.
  [6300, 6499], // major group + agents (aligns with dcf-sector Insurance)
];

function parseSic(sic: string | null | undefined): number | null {
  if (!sic) return null;
  const n = parseInt(String(sic).trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function inRanges(n: number, ranges: [number, number][]): boolean {
  for (const [lo, hi] of ranges) {
    if (n >= lo && n <= hi) return true;
  }
  return false;
}

function norm(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase();
}

function textLooksInsurer(...parts: (string | null | undefined)[]): boolean {
  const t = parts.map(norm).join(" ");
  if (!t) return false;
  // "reinsurance", "life insurance", "property & casualty insurance", etc.
  return /\binsur/.test(t) || /\breinsur/.test(t);
}

function textLooksBank(...parts: (string | null | undefined)[]): boolean {
  const t = parts.map(norm).join(" ");
  if (!t) return false;
  // Avoid "investment bank" false-negatives; still bank-like. Avoid pure
  // "financial" without bank (brokers stay standard unless SIC says otherwise).
  if (textLooksInsurer(t)) return false;
  return (
    /\bbanks?\b/.test(t) ||
    /\bbanking\b/.test(t) ||
    /\bthrift\b/.test(t) ||
    /\bsavings\s+(institution|association)\b/.test(t) ||
    /\bdepository\b/.test(t)
  );
}

/**
 * Detect presentation mode for a company profile.
 * Priority: insurer SIC → bank SIC → industry/sector text → dcf-sector label → standard.
 */
export function detectSectorMode(
  profile: SectorModeProfile | null | undefined
): SectorMode {
  if (!profile) return "standard";

  const sicN = parseSic(profile.sic);
  if (sicN != null) {
    // Insurer before bank: some holding codes are adjacent; claims/premiums
    // framing should win when SIC is clearly insurance.
    if (inRanges(sicN, INSURER_SIC_RANGES)) return "insurer";
    if (inRanges(sicN, BANK_SIC_RANGES)) return "bank";
  }

  const sector = profile.sector;
  const industry = profile.industry;
  const sicDesc = profile.sicDescription;

  if (textLooksInsurer(industry, sector, sicDesc)) return "insurer";
  if (textLooksBank(industry, sector, sicDesc)) return "bank";

  // Yahoo sometimes puts "Financial Services" with a precise industry we already
  // checked; fall back to the same SIC table the DCF uses for beta seeding.
  const mapped = sectorBeta(profile.sic);
  if (mapped?.sector === "Insurance") return "insurer";
  if (mapped?.sector === "Banks") return "bank";

  const sec = norm(sector);
  if (sec === "financial" || sec === "financial services" || sec === "financials") {
    // Sector alone is too broad (brokers, asset managers) — stay standard.
  }

  return "standard";
}

export function sectorModeBanner(mode: SectorMode): SectorModeBanner | null {
  if (mode === "bank") {
    return {
      title: "Bank mode",
      body:
        "Emphasis shifts to returns on equity and assets, leverage, deposits and net interest income when tagged, and top-line growth. Gross margin and industrial COGS framing are de-emphasized — they are often not meaningful for deposit-funded banks. Industrial DCF/FCF is the wrong primary tool.",
    };
  }
  if (mode === "insurer") {
    return {
      title: "Insurer mode",
      body:
        "Emphasis shifts to premiums and policyholder benefits when tagged, a combined-ratio proxy (not statutory), ROE/ROA, and book value. Gross margin is de-emphasized when it is not a useful underwriting ratio.",
    };
  }
  return null;
}

/** Gross margin / industrial COGS framing is usually not meaningful. */
export function isGrossMarginMeaningful(mode: SectorMode): boolean {
  return mode === "standard";
}

/**
 * Preferred scorecard dimension labels (display order). Actual factor math is
 * in buildScorecard; this is documentation + UI ordering hints.
 */
export function preferredScorecardMetrics(mode: SectorMode): string[] {
  if (mode === "bank") {
    return [
      "Revenue growth",
      "Return on equity",
      "Return on assets",
      "Leverage (D/E)",
      "Cash conversion",
    ];
  }
  if (mode === "insurer") {
    return [
      "Revenue growth",
      "Return on equity",
      "Return on assets",
      "Leverage (D/E)",
      "Cash conversion",
    ];
  }
  return [
    "Revenue growth",
    "Return on capital",
    "Cash conversion",
    "Leverage",
    "Interest coverage",
  ];
}

/**
 * Preferred ratio keys for display ordering (existing keys only).
 * Gross margin is omitted for bank/insurer — see isGrossMarginMeaningful.
 */
export function preferredRatioKeys(mode: SectorMode): string[] {
  if (mode === "bank" || mode === "insurer") {
    return [
      "roe",
      "roa",
      "netMargin",
      "opMargin",
      "debtToEquity",
      "fcfMargin",
      "roic",
      "currentRatio",
      "rdPct",
    ];
  }
  return [
    "grossMargin",
    "opMargin",
    "netMargin",
    "fcfMargin",
    "roe",
    "roa",
    "roic",
    "rdPct",
    "currentRatio",
    "debtToEquity",
  ];
}

/**
 * Statement line keys to highlight first on Overview / WhatChanged for this mode.
 * Only keys that exist in line-defs / visit-snapshot.
 */
export function preferredOverviewLineKeys(mode: SectorMode): string[] {
  if (mode === "bank") {
    return [
      "revenue",
      "netInterestIncome",
      "operatingIncome",
      "netIncome",
      "opex",
      "interestExpense",
      "receivables",
      "deposits",
      "totalAssets",
      "equity",
      "ocf",
      "fcf",
    ];
  }
  if (mode === "insurer") {
    return [
      "revenue",
      "premiumsEarned",
      "policyBenefits",
      "cogs",
      "operatingIncome",
      "netIncome",
      "opex",
      "totalAssets",
      "equity",
      "ocf",
      "fcf",
    ];
  }
  return [
    "revenue",
    "grossProfit",
    "operatingIncome",
    "netIncome",
    "epsDiluted",
    "fcf",
    "ocf",
    "totalAssets",
    "equity",
  ];
}

export function revenueGrowthLabel(mode: SectorMode): string {
  if (mode === "insurer") return "Top-line growth";
  if (mode === "bank") return "Revenue growth";
  return "Revenue growth";
}

export function revenueGrowthMetricNote(mode: SectorMode): string {
  if (mode === "insurer") {
    return "3-year revenue CAGR (premiums when tagged into Revenue)";
  }
  if (mode === "bank") {
    return "3-year revenue CAGR (often net interest + noninterest when tagged as Revenue)";
  }
  return "3-year revenue CAGR";
}
