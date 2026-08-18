/**
 * Simple stock/cash accretion-dilution merger model.
 *
 * Consideration → cash vs stock split → debt-financed interest on cash (and
 * fees) → after-tax synergies → pro forma EPS vs standalone.
 */

export type MergerInputs = {
  acquirerNetIncome: number;
  acquirerShares: number;
  targetNetIncome: number;
  targetShares: number; // for 100% stock deal share issuance calc if needed
  offerPricePerShare: number;
  targetSharesOutstanding: number;
  cashPercent: number; // 0-1
  stockPercent: number; // 0-1, should sum ~1 with cash
  newDebtInterestRate: number;
  taxRate: number;
  synergiesPretax: number;
  dealFees: number;
  acquirerPricePerShare?: number; // for stock issuance count
};

export type MergerResult = {
  consideration: number;
  cashPortion: number;
  stockPortion: number;
  /** offerPrice / acquirerPrice when both exist; else null. New shares stay stock / acquirer price. */
  exchangeRatio: number | null;
  newSharesIssued: number | null;
  interestExpenseAfterTax: number;
  synergiesAfterTax: number;
  proFormaNetIncome: number;
  proFormaShares: number;
  standaloneEps: number;
  proFormaEps: number;
  accretionPct: number; // (pf/stand)-1
  notes: string[];
};

function isFiniteNumber(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

/**
 * Run accretion/dilution. Returns null when core deal sizing inputs are invalid.
 */
export function runMerger(inputs: MergerInputs): MergerResult | null {
  const notes: string[] = [];

  const {
    acquirerNetIncome,
    acquirerShares,
    targetNetIncome,
    offerPricePerShare,
    targetSharesOutstanding,
    newDebtInterestRate,
    taxRate,
    synergiesPretax,
    dealFees,
  } = inputs;

  if (
    !isFiniteNumber(acquirerNetIncome) ||
    !isFiniteNumber(acquirerShares) ||
    acquirerShares <= 0 ||
    !isFiniteNumber(targetNetIncome) ||
    !isFiniteNumber(offerPricePerShare) ||
    offerPricePerShare < 0 ||
    !isFiniteNumber(targetSharesOutstanding) ||
    targetSharesOutstanding <= 0
  ) {
    return null;
  }

  let cashPct = isFiniteNumber(inputs.cashPercent)
    ? clamp01(inputs.cashPercent)
    : 0;
  let stockPct = isFiniteNumber(inputs.stockPercent)
    ? clamp01(inputs.stockPercent)
    : 0;

  const mixSum = cashPct + stockPct;
  if (mixSum <= 0) {
    notes.push("Cash + stock mix is zero — treating as 100% cash");
    cashPct = 1;
    stockPct = 0;
  } else if (Math.abs(mixSum - 1) > 1e-6) {
    // Renormalize so portions sum to consideration
    notes.push(
      `Cash/stock mix summed to ${(mixSum * 100).toFixed(1)}% — renormalized to 100%`
    );
    cashPct /= mixSum;
    stockPct /= mixSum;
  }

  const rate = isFiniteNumber(newDebtInterestRate) ? newDebtInterestRate : 0;
  const t = isFiniteNumber(taxRate) ? clamp01(taxRate) : 0;
  const synergies = isFiniteNumber(synergiesPretax) ? synergiesPretax : 0;
  const fees = isFiniteNumber(dealFees) && dealFees > 0 ? dealFees : 0;

  const consideration = offerPricePerShare * targetSharesOutstanding;
  const cashPortion = consideration * cashPct;
  const stockPortion = consideration * stockPct;

  // Debt-finance cash consideration + deal fees (ongoing interest drag).
  const cashFinanced = cashPortion + fees;
  // Cash-financed interest is after tax — the EPS drag is rate × (1 − t).
  const interestExpenseAfterTax = cashFinanced * rate * (1 - t);
  if (cashFinanced > 0 && rate > 0) {
    notes.push("Cash-financed interest is after tax");
  }
  if (fees > 0) {
    notes.push("Deal fees included in debt-financed cash outlay for interest");
  }

  const synergiesAfterTax = synergies * (1 - t);

  const proFormaNetIncome =
    acquirerNetIncome +
    targetNetIncome +
    synergiesAfterTax -
    interestExpenseAfterTax;

  let newSharesIssued: number | null = null;
  const acquirerPx = inputs.acquirerPricePerShare;
  const exchangeRatio =
    isFiniteNumber(acquirerPx) && acquirerPx > 0 && offerPricePerShare >= 0
      ? offerPricePerShare / acquirerPx
      : null;
  if (stockPortion > 0) {
    if (isFiniteNumber(acquirerPx) && acquirerPx > 0) {
      newSharesIssued = stockPortion / acquirerPx;
    } else {
      // Fallback: all-stock share count from target shares × exchange ratio
      // when acquirer price missing — use targetShares if provided as issued count.
      if (stockPct >= 1 - 1e-9 && isFiniteNumber(inputs.targetShares) && inputs.targetShares > 0) {
        newSharesIssued = inputs.targetShares;
        notes.push(
          "Acquirer price missing — used targetShares as new shares for 100% stock"
        );
      } else {
        notes.push(
          "Stock consideration but acquirerPricePerShare missing — new shares assumed 0"
        );
        newSharesIssued = 0;
      }
    }
  } else {
    newSharesIssued = 0;
  }

  const proFormaShares = acquirerShares + (newSharesIssued ?? 0);
  const standaloneEps = acquirerNetIncome / acquirerShares;
  const proFormaEps =
    proFormaShares > 0 ? proFormaNetIncome / proFormaShares : standaloneEps;

  let accretionPct = 0;
  if (standaloneEps !== 0 && Number.isFinite(standaloneEps)) {
    accretionPct = proFormaEps / standaloneEps - 1;
  } else if (proFormaEps > 0) {
    accretionPct = Infinity;
    notes.push("Standalone EPS is zero — accretion ratio undefined (set to Infinity)");
  }

  if (accretionPct > 0) {
    notes.push(`Accretive by ${(accretionPct * 100).toFixed(2)}%`);
  } else if (accretionPct < 0 && Number.isFinite(accretionPct)) {
    notes.push(`Dilutive by ${(Math.abs(accretionPct) * 100).toFixed(2)}%`);
  }

  return {
    consideration,
    cashPortion,
    stockPortion,
    exchangeRatio,
    newSharesIssued,
    interestExpenseAfterTax,
    synergiesAfterTax,
    proFormaNetIncome,
    proFormaShares,
    standaloneEps,
    proFormaEps,
    accretionPct,
    notes,
  };
}
