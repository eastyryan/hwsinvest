/**
 * Enterprise value bridge from market price + filing capital-structure metrics.
 *
 * Standard IB identity:
 *   EV = Market Cap + Debt + Leases + NCI + Preferred + Pension deficit
 *        − (unrestricted cash if provided, else reported cash)
 *
 * Restricted cash and short-term investments are surfaced but not subtracted
 * from EV by default (restricted is already carved out of unrestricted cash
 * when known; ST investments are often operating at financials).
 *
 * Missing optional legs are treated as 0 in the sum (with notes) so a partial
 * bridge is still usable; `complete` flags whether price, diluted shares, and
 * enough balance-sheet inputs are present for a meaningful EV.
 */

export type EvSharesSource = "diluted" | "basic" | "derived-diluted" | null;

export type EvBridgeInput = {
  price: number | null;
  /** Primary share count (diluted-first from metrics). */
  shares: number | null;
  sharesSource?: EvSharesSource;
  cash: number | null;
  /** Cash less restricted, when the carve-out is known. */
  cashUnrestricted?: number | null;
  /** Short-term + long-term interest-bearing debt */
  debt: number | null;
  /** Optional operating lease liability if tagged/available */
  leaseLiability?: number | null;
  /** Minority / non-controlling interest if available */
  minorityInterest?: number | null;
  preferredEquity?: number | null;
  /** Underfunded defined-benefit plans; not subtracted when omitted. */
  pensionDeficit?: number | null;
  /** Informational — not an EV subtractor. */
  restrictedCash?: number | null;
  /** Informational — not an EV subtractor (often operating at financials). */
  stInvestments?: number | null;
};

export type EvBridgeResult = {
  marketCap: number | null;
  cash: number | null;
  cashUnrestricted: number | null;
  debt: number | null;
  leases: number | null;
  minorityInterest: number | null;
  preferredEquity: number | null;
  pensionDeficit: number | null;
  restrictedCash: number | null;
  stInvestments: number | null;
  shares: number | null;
  sharesSource: EvSharesSource;
  /** MC + debt + leases + NCI + pref + pension − cashUnrestricted|cash */
  enterpriseValue: number | null;
  /** debt + leases − cash used in EV (null components treated as 0 if any present) */
  netDebt: number | null;
  notes: string[];
  /** true when price + shares yield market cap and BS inputs support a meaningful EV */
  complete: boolean;
};

export type EvBridgeMetrics = {
  shares: number | null;
  cash: number | null;
  debt: number | null;
  netDebt?: number | null;
  leaseLiability?: number | null;
  minorityInterest?: number | null;
  preferredEquity?: number | null;
  pensionDeficit?: number | null;
  restrictedCash?: number | null;
  stInvestments?: number | null;
  cashUnrestricted?: number | null;
  sharesSource?: EvSharesSource;
};

export type EvBridgeExtras = {
  leaseLiability?: number | null;
  minorityInterest?: number | null;
  preferredEquity?: number | null;
  pensionDeficit?: number | null;
  restrictedCash?: number | null;
  stInvestments?: number | null;
  cashUnrestricted?: number | null;
  sharesSource?: EvSharesSource;
};

function finiteOrNull(v: number | null | undefined): number | null {
  if (v == null) return null;
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  return v;
}

/** Sum legs treating null as 0; return null only when every leg is null. */
function sumPresent(legs: Array<number | null>): number | null {
  let any = false;
  let total = 0;
  for (const x of legs) {
    if (x == null) continue;
    any = true;
    total += x;
  }
  return any ? total : null;
}

function noteMissingOrZero(
  notes: string[],
  label: string,
  raw: number | null | undefined,
  finite: number | null
): void {
  if (finite != null) return;
  if (raw === undefined) {
    notes.push(`${label} missing — treated as 0 in EV.`);
  } else {
    notes.push(`${label} not available; treating as 0 in EV.`);
  }
}

/** Build market-cap → enterprise-value bridge. */
export function buildEvBridge(input: EvBridgeInput): EvBridgeResult {
  const notes: string[] = [];

  const price = finiteOrNull(input.price);
  const shares = finiteOrNull(input.shares);
  const sharesSource = input.sharesSource ?? null;
  const cash = finiteOrNull(input.cash);
  const cashUnrestricted = finiteOrNull(input.cashUnrestricted);
  const debt = finiteOrNull(input.debt);
  const leases = finiteOrNull(input.leaseLiability);
  const minorityInterest = finiteOrNull(input.minorityInterest);
  const preferredEquity = finiteOrNull(input.preferredEquity);
  const pensionDeficit = finiteOrNull(input.pensionDeficit);
  const restrictedCash = finiteOrNull(input.restrictedCash);
  const stInvestments = finiteOrNull(input.stInvestments);
  const cashForEv = cashUnrestricted ?? cash;

  let marketCap: number | null = null;
  if (price == null) {
    notes.push("Missing market price — cannot compute market cap.");
  } else if (shares == null) {
    notes.push("Missing diluted shares — cannot compute market cap.");
  } else if (shares <= 0) {
    notes.push("Diluted shares must be positive — cannot compute market cap.");
  } else {
    marketCap = price * shares;
  }

  if (sharesSource === "basic") {
    notes.push("Share count is basic weighted-average, not diluted.");
  } else if (sharesSource === "derived-diluted") {
    notes.push("Diluted shares derived as net income ÷ diluted EPS.");
  }

  if (cashForEv == null) notes.push("Cash not available; treating as 0 in EV.");
  if (debt == null) notes.push("Debt not available; treating as 0 in EV.");
  noteMissingOrZero(notes, "Lease liability", input.leaseLiability, leases);
  noteMissingOrZero(notes, "Minority interest", input.minorityInterest, minorityInterest);
  noteMissingOrZero(notes, "Preferred equity", input.preferredEquity, preferredEquity);
  noteMissingOrZero(notes, "Pension deficit", input.pensionDeficit, pensionDeficit);

  if (cashUnrestricted != null && restrictedCash != null) {
    notes.push("EV subtracts unrestricted cash (reported cash less restricted).");
  } else if (restrictedCash == null) {
    notes.push(
      "Restricted cash not tagged separately — reported cash may still include restricted."
    );
  } else {
    notes.push(
      "Restricted cash tagged but not carved out — reported cash may still include restricted."
    );
  }

  if (stInvestments != null) {
    notes.push(
      "Short-term investments are not subtracted from EV (often operating at financials)."
    );
  }

  // netDebt = debt + leases − cash used in EV; null legs → 0 when any present
  const netDebt = sumPresent([
    debt,
    leases,
    cashForEv == null ? null : -cashForEv,
  ]);

  let enterpriseValue: number | null = null;
  if (marketCap != null) {
    enterpriseValue =
      marketCap +
      (debt ?? 0) +
      (leases ?? 0) +
      (minorityInterest ?? 0) +
      (preferredEquity ?? 0) +
      (pensionDeficit ?? 0) -
      (cashForEv ?? 0);
  }

  // Meaningful EV: market cap known and at least one capital-structure leg.
  const hasBsLeg = debt != null || cashForEv != null || leases != null;
  const complete = marketCap != null && hasBsLeg;

  if (marketCap != null && !hasBsLeg) {
    notes.push(
      "No cash, debt, or lease data — EV equals market cap only (incomplete bridge)."
    );
  }

  return {
    marketCap,
    cash,
    cashUnrestricted,
    debt,
    leases,
    minorityInterest,
    preferredEquity,
    pensionDeficit,
    restrictedCash,
    stInvestments,
    shares,
    sharesSource,
    enterpriseValue,
    netDebt,
    notes,
    complete,
  };
}

/**
 * Convenience wrapper from company operating metrics + live price.
 * `metrics.netDebt` is unused in the sum (EV uses cash/debt legs); retained for
 * call-site compatibility with `CompanyOperatingMetrics`.
 */
export function buildEvBridgeFromMetrics(
  metrics: EvBridgeMetrics,
  price: number | null,
  extras?: EvBridgeExtras
): EvBridgeResult {
  return buildEvBridge({
    price,
    shares: metrics.shares,
    sharesSource: extras?.sharesSource ?? metrics.sharesSource,
    cash: metrics.cash,
    cashUnrestricted: extras?.cashUnrestricted ?? metrics.cashUnrestricted,
    debt: metrics.debt,
    leaseLiability: extras?.leaseLiability ?? metrics.leaseLiability,
    minorityInterest: extras?.minorityInterest ?? metrics.minorityInterest,
    preferredEquity: extras?.preferredEquity ?? metrics.preferredEquity,
    pensionDeficit: extras?.pensionDeficit ?? metrics.pensionDeficit,
    restrictedCash: extras?.restrictedCash ?? metrics.restrictedCash,
    stInvestments: extras?.stInvestments ?? metrics.stInvestments,
  });
}
