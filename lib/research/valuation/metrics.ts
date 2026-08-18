/**
 * Operating metrics extraction for trading comps (CCA).
 *
 * Line keys follow lib/line-defs.ts — there is no standalone `totalDebt` tag;
 * debt is short-term + long-term, matching ratios / scorecard / DCF.
 */

import type { CompanyFinancials, StatementSet } from "@/lib/research/edgar";

/** Last (newest) period value for a statement line key, or null. */
export function lastLine(set: StatementSet, key: string): number | null {
  const p = set.periods[0];
  if (!p) return null;
  for (const st of set.statements) {
    const line = st.lines.find((x) => x.key === key);
    if (line) {
      const v = line.values[p.key];
      return typeof v === "number" && Number.isFinite(v) ? v : null;
    }
  }
  return null;
}

export type SharesSource = "diluted" | "basic" | "derived-diluted" | null;

export type CompanyOperatingMetrics = {
  revenue: number | null;
  ebitda: number | null;
  ebit: number | null;
  netIncome: number | null;
  /**
   * Primary per-share count, diluted-first:
   * reported diluted → NI / diluted EPS → basic. See `sharesSource`.
   */
  shares: number | null;
  sharesDiluted: number | null;
  sharesBasic: number | null;
  sharesSource: SharesSource;
  cash: number | null;
  /** Cash minus restricted when both are finite and cash ≥ restricted; else cash. */
  cashUnrestricted: number | null;
  restrictedCash: number | null;
  stInvestments: number | null;
  debt: number | null;
  /** debt − cash. Does not carve restricted cash or add leases — comps stay stable. */
  netDebt: number | null;
  leaseLiability: number | null;
  minorityInterest: number | null;
  preferredEquity: number | null;
  /** max(pensionLiab − pensionAssets, 0) when either leg exists; else null. */
  pensionDeficit: number | null;
};

/**
 * Latest annual operating / capital structure metrics for comps.
 *
 * - ebit ← operatingIncome
 * - ebitda ← derived ebitda line when present, else operatingIncome + da
 * - debt ← stDebt + ltDebt (null only when both legs missing)
 * - netDebt ← debt − cash (null when both debt and cash missing)
 * - shares ← diluted weighted-average first; never silently labelled as diluted
 *   when the figure is basic or NI / diluted EPS
 */
export function companyOperatingMetrics(
  fin: CompanyFinancials
): CompanyOperatingMetrics {
  const set = fin.annual;
  const revenue = lastLine(set, "revenue");
  const ebit = lastLine(set, "operatingIncome");
  const netIncome = lastLine(set, "netIncome");
  const sharesDiluted = lastLine(set, "sharesDiluted");
  const sharesBasic = lastLine(set, "sharesBasic");
  const cash = lastLine(set, "cash");
  const restrictedCash = lastLine(set, "restrictedCash");
  const stInvestments = lastLine(set, "stInvestments");
  const leaseLiability = lastLine(set, "leaseLiability");
  const minorityInterest = lastLine(set, "nci");
  const preferredEquity = lastLine(set, "preferredEquity");
  const pensionLiab = lastLine(set, "pensionLiab");
  const pensionAssets = lastLine(set, "pensionAssets");

  let ebitda = lastLine(set, "ebitda");
  if (ebitda == null) {
    const da = lastLine(set, "da");
    if (ebit != null || da != null) {
      ebitda = (ebit ?? 0) + (da ?? 0);
    }
  }

  const st = lastLine(set, "stDebt");
  const lt = lastLine(set, "ltDebt");
  let debt: number | null = null;
  if (st != null || lt != null) {
    debt = (st ?? 0) + (lt ?? 0);
  }

  let netDebt: number | null = null;
  if (debt != null || cash != null) {
    netDebt = (debt ?? 0) - (cash ?? 0);
  }

  let shares: number | null = null;
  let sharesSource: SharesSource = null;
  if (sharesDiluted != null) {
    shares = sharesDiluted;
    sharesSource = "diluted";
  } else {
    const epsDiluted = lastLine(set, "epsDiluted");
    if (netIncome != null && epsDiluted != null && epsDiluted !== 0) {
      shares = netIncome / epsDiluted;
      sharesSource = "derived-diluted";
    } else if (sharesBasic != null) {
      shares = sharesBasic;
      sharesSource = "basic";
    }
  }

  let cashUnrestricted: number | null = cash;
  if (cash != null && restrictedCash != null && cash >= restrictedCash) {
    cashUnrestricted = cash - restrictedCash;
  }

  let pensionDeficit: number | null = null;
  if (pensionLiab != null || pensionAssets != null) {
    pensionDeficit = Math.max((pensionLiab ?? 0) - (pensionAssets ?? 0), 0);
  }

  return {
    revenue,
    ebitda,
    ebit,
    netIncome,
    shares,
    sharesDiluted,
    sharesBasic,
    sharesSource,
    cash,
    cashUnrestricted,
    restrictedCash,
    stInvestments,
    debt,
    netDebt,
    leaseLiability,
    minorityInterest,
    preferredEquity,
    pensionDeficit,
  };
}

/**
 * Equity bridge from enterprise value: Equity = EV − Net Debt.
 * (Equivalent to EV − Debt + Cash when netDebt = debt − cash.)
 */
export function equityBridge(
  ev: number | null,
  netDebt: number | null
): number | null {
  if (ev == null || !Number.isFinite(ev)) return null;
  if (netDebt == null || !Number.isFinite(netDebt)) return null;
  return ev - netDebt;
}

/**
 * Equity value per share. Uses whatever count the caller passes —
 * `companyOperatingMetrics.shares` is diluted-first (see `sharesSource`).
 */
export function perShare(
  equity: number | null,
  shares: number | null
): number | null {
  if (equity == null || !Number.isFinite(equity)) return null;
  if (shares == null || !Number.isFinite(shares) || shares <= 0) return null;
  return equity / shares;
}
