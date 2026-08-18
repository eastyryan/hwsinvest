/**
 * Sector-specific simple valuation packs (filing-based, free).
 *
 * Banks: book / tangible-book proxies, ROE, deposits, and a NIM proxy
 *   (NII / total assets — not average earning assets).
 * REITs: crude FFO proxy (NI + D&A) and AFFO proxy (FFO − |capex|) —
 *   not Nareit FFO/AFFO; notes document the gap.
 * Insurers: premiums, policy benefits, a combined-ratio proxy, and P/B —
 *   not a statutory combined ratio.
 *
 * Presentation mode for Overview / ratios stays bank | insurer | standard
 * (see lib/sector-mode.ts). REIT lives here via detectSectorPack only.
 */

export type SectorPackKind = "bank" | "reit" | "insurer" | "standard" | "unknown";

export type BankPack = {
  kind: "bank";
  bookEquity: number | null;
  /** equity − goodwill when goodwill is available, else equity */
  tangibleBookProxy: number | null;
  netIncome: number | null;
  roe: number | null;
  priceToBook: number | null;
  priceToTangibleBook: number | null;
  deposits: number | null;
  netInterestIncome: number | null;
  loanLikeReceivables: number | null;
  /** NII / total assets — not average earning assets. */
  nimProxy: number | null;
  notes: string[];
};

export type ReitPack = {
  kind: "reit";
  /** FFO proxy = NI + D&A (crude, free) */
  ffoProxy: number | null;
  priceToFfo: number | null;
  /** FFO − |capex| when capex is tagged; not Nareit AFFO. */
  affoProxy: number | null;
  priceToAffo: number | null;
  notes: string[];
};

export type InsurerPack = {
  kind: "insurer";
  premiumsEarned: number | null;
  policyBenefits: number | null;
  /** policyBenefits / premiumsEarned when both > 0 — not statutory. */
  combinedRatioProxy: number | null;
  bookEquity: number | null;
  priceToBook: number | null;
  notes: string[];
};

export type SectorPack =
  | BankPack
  | ReitPack
  | InsurerPack
  | { kind: "standard" | "unknown"; notes: string[] };

/** One-line description of the filing-based model for this pack. */
export function describeSectorModel(kind: SectorPackKind): string {
  switch (kind) {
    case "bank":
      return "Banks: P/B, P/TBV, ROE, deposits, and a NIM proxy (NII / total assets). Industrial DCF/FCF is the wrong primary tool.";
    case "reit":
      return "REITs: FFO proxy (NI+D&A) and AFFO proxy (FFO − |capex|). Not Nareit FFO/AFFO.";
    case "insurer":
      return "Insurers: premiums, policy benefits, combined-ratio proxy, and P/B. Combined ratio is not statutory.";
    case "standard":
      return "Standard industrial pack — DCF, comps, and EV bridge apply.";
    case "unknown":
      return "Sector not classified — treat as a standard industrial unless filings say otherwise.";
  }
}

/** Inclusive 4-digit SIC ranges (align with lib/sector-mode + dcf-sector). */
const BANK_SIC_RANGES: [number, number][] = [
  [6020, 6036],
  [6081, 6099],
  [6712, 6712],
  [6000, 6199],
];

const INSURER_SIC_RANGES: [number, number][] = [
  [6311, 6399],
  [6300, 6499],
];

/** Real estate operators / REITs (dcf-sector 6500–6799), excluding bank HCs handled above. */
const REIT_SIC_RANGES: [number, number][] = [[6500, 6799]];

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
  return /\binsur/.test(t) || /\breinsur/.test(t);
}

function textLooksBank(...parts: (string | null | undefined)[]): boolean {
  const t = parts.map(norm).join(" ");
  if (!t) return false;
  if (textLooksInsurer(t)) return false;
  return (
    /\bbanks?\b/.test(t) ||
    /\bbanking\b/.test(t) ||
    /\bthrift\b/.test(t) ||
    /\bsavings\s+(institution|association)\b/.test(t) ||
    /\bdepository\b/.test(t)
  );
}

function textLooksReit(...parts: (string | null | undefined)[]): boolean {
  const t = parts.map(norm).join(" ");
  if (!t) return false;
  return (
    /\breit\b/.test(t) ||
    /\breits\b/.test(t) ||
    /real\s+estate\s+investment\s+trust/.test(t) ||
    (/real\s+estate/.test(t) && !textLooksBank(t) && !textLooksInsurer(t))
  );
}

function finite(n: number | null | undefined): number | null {
  return n != null && typeof n === "number" && Number.isFinite(n) ? n : null;
}

function marketCap(
  price: number | null | undefined,
  shares: number | null | undefined
): number | null {
  const p = finite(price);
  const s = finite(shares);
  if (p == null || s == null || s <= 0) return null;
  return p * s;
}

function safeDiv(num: number | null, den: number | null): number | null {
  if (num == null || den == null || den === 0) return null;
  const r = num / den;
  return Number.isFinite(r) ? r : null;
}

/**
 * Detect which simple valuation pack fits a company profile.
 * Priority: insurer SIC → bank SIC → REIT SIC → text heuristics → standard / unknown.
 */
export function detectSectorPack(
  sector: string | null,
  industry: string | null,
  sic: string | null
): SectorPackKind {
  const hasAny =
    (sector != null && String(sector).trim() !== "") ||
    (industry != null && String(industry).trim() !== "") ||
    (sic != null && String(sic).trim() !== "");

  if (!hasAny) return "unknown";

  const sicN = parseSic(sic);
  if (sicN != null) {
    if (inRanges(sicN, INSURER_SIC_RANGES)) return "insurer";
    if (inRanges(sicN, BANK_SIC_RANGES)) return "bank";
    if (inRanges(sicN, REIT_SIC_RANGES)) return "reit";
  }

  if (textLooksInsurer(industry, sector)) return "insurer";
  if (textLooksBank(industry, sector)) return "bank";
  if (textLooksReit(industry, sector)) return "reit";

  return "standard";
}

export function buildBankPack(args: {
  price: number | null;
  shares: number | null;
  equity: number | null;
  goodwill?: number | null;
  netIncome: number | null;
  deposits?: number | null;
  netInterestIncome?: number | null;
  totalAssets?: number | null;
  loanLikeReceivables?: number | null;
}): BankPack {
  const notes: string[] = [];
  const equity = finite(args.equity);
  const goodwill = finite(args.goodwill);
  const netIncome = finite(args.netIncome);
  const deposits = finite(args.deposits);
  const netInterestIncome = finite(args.netInterestIncome);
  const totalAssets = finite(args.totalAssets);
  const loanLikeReceivables = finite(args.loanLikeReceivables);
  const mcap = marketCap(args.price, args.shares);

  const bookEquity = equity;

  let tangibleBookProxy: number | null = null;
  if (equity != null) {
    if (goodwill != null) {
      tangibleBookProxy = equity - goodwill;
      notes.push("Tangible book = equity − goodwill (filing goodwill when available).");
    } else {
      tangibleBookProxy = equity;
      notes.push(
        "Goodwill not provided — tangible book proxy falls back to book equity."
      );
    }
  } else {
    notes.push("Book equity missing — P/B and ROE unavailable.");
  }

  if (mcap == null) {
    notes.push("Price or shares missing — market multiples unavailable.");
  }

  const nimProxy = safeDiv(netInterestIncome, totalAssets);
  if (nimProxy != null) {
    notes.push(
      "NIM proxy = net interest income / total assets (not average earning assets)."
    );
  } else if (netInterestIncome == null || totalAssets == null) {
    notes.push(
      "NIM proxy unavailable — needs tagged net interest income and total assets."
    );
  }

  if (loanLikeReceivables != null) {
    notes.push(
      "Loan-like receivables are the normalized receivables line (loan book when tagged)."
    );
  }

  notes.push(
    "Bank pack uses filing equity and NI; CET1 / tier-1 capital not available free."
  );
  notes.push(
    "Industrial DCF/FCF is the wrong primary tool for deposit-funded banks."
  );

  return {
    kind: "bank",
    bookEquity,
    tangibleBookProxy,
    netIncome,
    roe: safeDiv(netIncome, equity),
    priceToBook: safeDiv(mcap, equity),
    priceToTangibleBook: safeDiv(mcap, tangibleBookProxy),
    deposits,
    netInterestIncome,
    loanLikeReceivables,
    nimProxy,
    notes,
  };
}

export function buildReitPack(args: {
  price: number | null;
  shares: number | null;
  netIncome: number | null;
  da: number | null;
  capex?: number | null;
}): ReitPack {
  const notes: string[] = [];
  const ni = finite(args.netIncome);
  const da = finite(args.da);
  const capex = finite(args.capex);
  const mcap = marketCap(args.price, args.shares);

  let ffoProxy: number | null = null;
  if (ni != null || da != null) {
    ffoProxy = (ni ?? 0) + (da ?? 0);
    notes.push(
      "FFO proxy = net income + depreciation & amortization (crude; not Nareit FFO)."
    );
    if (ni == null) notes.push("Net income missing — FFO proxy uses D&A only.");
    if (da == null) notes.push("D&A missing — FFO proxy uses net income only.");
  } else {
    notes.push("Net income and D&A missing — FFO proxy unavailable.");
  }

  let affoProxy: number | null = null;
  if (ffoProxy != null && capex != null) {
    affoProxy = ffoProxy - Math.abs(capex);
    notes.push(
      "AFFO proxy = FFO − |capex|. This is not Nareit AFFO (omits recurring vs growth capex, straight-line rent, and other Nareit adjustments)."
    );
  } else if (ffoProxy != null && capex == null) {
    notes.push(
      "Capex missing — AFFO proxy unavailable (not assumed equal to FFO). Not Nareit AFFO."
    );
  }

  if (mcap == null) {
    notes.push("Price or shares missing — P/FFO and P/AFFO unavailable.");
  }

  notes.push(
    "Omits gains/losses on sales, straight-line rent, and preferred distributions required for true FFO."
  );
  notes.push(
    "Industrial DCF on unlevered FCF is the wrong primary tool for REITs."
  );

  return {
    kind: "reit",
    ffoProxy,
    priceToFfo: safeDiv(mcap, ffoProxy),
    affoProxy,
    priceToAffo: safeDiv(mcap, affoProxy),
    notes,
  };
}

export function buildInsurerPack(args: {
  price: number | null;
  shares: number | null;
  premiumsEarned: number | null;
  policyBenefits: number | null;
  equity: number | null;
}): InsurerPack {
  const notes: string[] = [];
  const premiumsEarned = finite(args.premiumsEarned);
  const policyBenefits = finite(args.policyBenefits);
  const bookEquity = finite(args.equity);
  const mcap = marketCap(args.price, args.shares);

  let combinedRatioProxy: number | null = null;
  if (
    premiumsEarned != null &&
    premiumsEarned > 0 &&
    policyBenefits != null &&
    policyBenefits > 0
  ) {
    combinedRatioProxy = policyBenefits / premiumsEarned;
    notes.push(
      "Combined-ratio proxy = policyholder benefits / premiums earned. This is not a statutory combined ratio (omits underwriting expense ratio; GAAP tags only)."
    );
  } else {
    notes.push(
      "Premiums and policy benefits both needed and positive for a combined-ratio proxy."
    );
  }

  if (bookEquity == null) {
    notes.push("Book equity missing — P/B unavailable.");
  }
  if (mcap == null) {
    notes.push("Price or shares missing — P/B unavailable.");
  }

  notes.push(
    "Industrial DCF/FCF is the wrong primary tool for insurers — prefer book value and underwriting ratios."
  );

  return {
    kind: "insurer",
    premiumsEarned,
    policyBenefits,
    combinedRatioProxy,
    bookEquity,
    priceToBook: safeDiv(mcap, bookEquity),
    notes,
  };
}
