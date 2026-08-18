/**
 * Trading comparable company analysis (CCA).
 *
 * IB-standard triangulation:
 * - EV multiples (EV/EBITDA, EV/EBIT, EV/Sales) → enterprise value → equity via net debt
 * - Equity multiples (P/E, P/S) applied directly to net income / revenue
 * - Peer distribution uses median (primary), mean, and p25/p75 for context
 * - Blended range across methods that produce a finite per-share value
 */

import { filterFinite, mean, median, percentile } from "@/lib/research/valuation/stats";
import { equityBridge, perShare } from "@/lib/research/valuation/metrics";
import {
  needsCalendarizationWarning,
  type OperatingBasis,
} from "@/lib/research/valuation/comps-periods";

export type CompPeerInput = {
  ticker: string;
  name?: string;
  revenue: number | null;
  ebitda: number | null;
  ebit: number | null;
  netIncome: number | null;
  shares: number | null;
  netDebt: number | null;
  /** Market price per share */
  price: number | null;
  /** Newest flow-period end (TTM quarter or FY). */
  periodEnd?: string;
  /** Whether flow metrics are TTM or last fiscal year. */
  basis?: OperatingBasis;
};

export type CompMultipleKey = "evEbitda" | "evEbit" | "evSales" | "pe" | "ps";

export const COMP_MULTIPLE_KEYS: CompMultipleKey[] = [
  "evEbitda",
  "evEbit",
  "evSales",
  "pe",
  "ps",
];

export type CompPeerRow = CompPeerInput & {
  marketCap: number | null;
  enterpriseValue: number | null;
  multiples: Record<CompMultipleKey, number | null>;
};

export type MultipleDist = {
  values: number[];
  median: number | null;
  mean: number | null;
  p25: number | null;
  p75: number | null;
};

export type ImpliedByMultiple = {
  /** Peer median multiple applied to subject */
  multiple: number | null;
  enterpriseValue: number | null;
  equityValue: number | null;
  perShare: number | null;
};

export type CompsResult = {
  peers: CompPeerRow[];
  subject: CompPeerRow;
  /** Peer-only (exclude subject) distribution */
  peerMultiples: Record<CompMultipleKey, MultipleDist>;
  implied: Record<CompMultipleKey, ImpliedByMultiple>;
  /** Blended low/mid/high per share across methods that produced values */
  range: { low: number | null; mid: number | null; high: number | null };
  notes: string[];
};

function pos(n: number | null | undefined): n is number {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

function finite(n: number | null | undefined): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

/** Build market cap, EV, and trading multiples for one name. */
export function buildPeerRow(p: CompPeerInput): CompPeerRow {
  const marketCap =
    pos(p.price) && pos(p.shares) ? p.price * p.shares : null;

  const enterpriseValue =
    marketCap != null && finite(p.netDebt) ? marketCap + p.netDebt : null;

  const eps =
    pos(p.shares) && pos(p.netIncome) ? p.netIncome / p.shares : null;

  const multiples: Record<CompMultipleKey, number | null> = {
    evEbitda:
      enterpriseValue != null && pos(p.ebitda)
        ? enterpriseValue / p.ebitda
        : null,
    evEbit:
      enterpriseValue != null && pos(p.ebit)
        ? enterpriseValue / p.ebit
        : null,
    evSales:
      enterpriseValue != null && pos(p.revenue)
        ? enterpriseValue / p.revenue
        : null,
    pe: pos(p.price) && eps != null ? p.price / eps : null,
    ps: marketCap != null && pos(p.revenue) ? marketCap / p.revenue : null,
  };

  return {
    ...p,
    marketCap,
    enterpriseValue,
    multiples,
  };
}

function distFrom(values: number[]): MultipleDist {
  const xs = filterFinite(values).slice().sort((a, b) => a - b);
  return {
    values: xs,
    median: median(xs),
    mean: mean(xs),
    p25: percentile(xs, 25),
    p75: percentile(xs, 75),
  };
}

/**
 * Apply a peer median multiple to the subject company.
 * EV methods bridge through net debt; equity methods map straight to equity.
 */
function imply(
  key: CompMultipleKey,
  mult: number | null,
  subject: CompPeerInput
): ImpliedByMultiple {
  const blank: ImpliedByMultiple = {
    multiple: mult,
    enterpriseValue: null,
    equityValue: null,
    perShare: null,
  };
  if (mult == null || !Number.isFinite(mult) || mult <= 0) return blank;

  if (key === "evEbitda") {
    if (!pos(subject.ebitda)) return blank;
    const enterpriseValue = mult * subject.ebitda;
    const equityValue = equityBridge(enterpriseValue, subject.netDebt);
    return {
      multiple: mult,
      enterpriseValue,
      equityValue,
      perShare: perShare(equityValue, subject.shares),
    };
  }

  if (key === "evEbit") {
    if (!pos(subject.ebit)) return blank;
    const enterpriseValue = mult * subject.ebit;
    const equityValue = equityBridge(enterpriseValue, subject.netDebt);
    return {
      multiple: mult,
      enterpriseValue,
      equityValue,
      perShare: perShare(equityValue, subject.shares),
    };
  }

  if (key === "evSales") {
    if (!pos(subject.revenue)) return blank;
    const enterpriseValue = mult * subject.revenue;
    const equityValue = equityBridge(enterpriseValue, subject.netDebt);
    return {
      multiple: mult,
      enterpriseValue,
      equityValue,
      perShare: perShare(equityValue, subject.shares),
    };
  }

  if (key === "pe") {
    if (!pos(subject.netIncome)) return blank;
    const equityValue = mult * subject.netIncome;
    return {
      multiple: mult,
      enterpriseValue: null,
      equityValue,
      perShare: perShare(equityValue, subject.shares),
    };
  }

  // ps
  if (!pos(subject.revenue)) return blank;
  const equityValue = mult * subject.revenue;
  return {
    multiple: mult,
    enterpriseValue: null,
    equityValue,
    perShare: perShare(equityValue, subject.shares),
  };
}

function collectNotes(
  subject: CompPeerRow,
  peerRows: CompPeerRow[],
  peerMultiples: Record<CompMultipleKey, MultipleDist>,
  implied: Record<CompMultipleKey, ImpliedByMultiple>
): string[] {
  const notes: string[] = [];

  notes.push(
    "Peer set is a curated liquid US large-cap map, not a formal competitor set."
  );

  const y = peerRows.length;
  notes.push(
    `n = ${peerMultiples.evEbitda.values.length} of ${y} peers used for EV/EBITDA`
  );
  notes.push(
    `n = ${peerMultiples.evEbit.values.length} of ${y} peers used for EV/EBIT`
  );
  notes.push(
    `n = ${peerMultiples.pe.values.length} of ${y} peers used for P/E`
  );

  const bases: OperatingBasis[] = [];
  if (subject.basis === "ttm" || subject.basis === "fy") bases.push(subject.basis);
  for (const p of peerRows) {
    if (p.basis === "ttm" || p.basis === "fy") bases.push(p.basis);
  }
  if (bases.includes("ttm") && bases.includes("fy")) {
    notes.push(
      "Subject/peers mix TTM and FY operating bases; multiples are not period-aligned."
    );
  }

  const calPeers = peerRows.filter((p) =>
    needsCalendarizationWarning(subject, p)
  );
  if (calPeers.length > 0) {
    notes.push(
      `Calendarization warning: subject FY-end month differs by more than 2 months from ${calPeers.map((p) => p.ticker).join(", ")} (at least one side is FY, not TTM).`
    );
  }

  const peersWithAnyMultiple = peerRows.filter((r) =>
    COMP_MULTIPLE_KEYS.some((k) => r.multiples[k] != null)
  ).length;

  if (peerRows.length === 0) {
    notes.push("No peer companies supplied; cannot form a trading-comps range.");
  } else if (peersWithAnyMultiple < 3) {
    notes.push(
      `Thin peer set: only ${peersWithAnyMultiple} peer(s) produced any trading multiple (prefer ≥3).`
    );
  }

  for (const k of COMP_MULTIPLE_KEYS) {
    const n = peerMultiples[k].values.length;
    if (peerRows.length > 0 && n === 0) {
      notes.push(`No peer observations for ${k}.`);
    } else if (n > 0 && n < 3) {
      notes.push(`${k}: only ${n} peer observation(s); median is less robust.`);
    }
  }

  if (subject.price == null) {
    notes.push("Subject market price missing; subject row multiples may be blank.");
  }
  if (subject.shares == null || subject.shares <= 0) {
    notes.push("Subject diluted shares missing or non-positive; per-share values unavailable.");
  }
  if (subject.netDebt == null) {
    notes.push("Subject net debt missing; EV-based equity bridge unavailable.");
  }
  if (!pos(subject.ebitda)) {
    notes.push("Subject EBITDA missing or non-positive; EV/EBITDA not applied.");
  }
  if (!pos(subject.ebit)) {
    notes.push("Subject EBIT missing or non-positive; EV/EBIT not applied.");
  }
  if (!pos(subject.revenue)) {
    notes.push("Subject revenue missing or non-positive; EV/Sales and P/S not applied.");
  }
  if (!pos(subject.netIncome)) {
    notes.push("Subject net income missing or non-positive; P/E not applied.");
  }

  const impliedShares = COMP_MULTIPLE_KEYS.map((k) => implied[k].perShare).filter(
    (v): v is number => v != null && Number.isFinite(v)
  );
  if (impliedShares.length === 0 && peerRows.length > 0) {
    notes.push("No method produced an implied per-share value for the subject.");
  } else if (impliedShares.length === 1) {
    notes.push("Range rests on a single multiple method; treat triangulation as limited.");
  }

  return notes;
}

/**
 * Run peer-set trading comps against a subject company.
 * Subject ticker is excluded from peer distributions (case-insensitive).
 */
export function runComps(
  subject: CompPeerInput,
  peers: CompPeerInput[]
): CompsResult {
  const subjectRow = buildPeerRow(subject);
  const subjectTicker = subject.ticker.trim().toUpperCase();

  const peerRows = peers
    .filter((p) => p.ticker.trim().toUpperCase() !== subjectTicker)
    .map(buildPeerRow);

  const peerMultiples = {} as Record<CompMultipleKey, MultipleDist>;
  const implied = {} as Record<CompMultipleKey, ImpliedByMultiple>;

  for (const key of COMP_MULTIPLE_KEYS) {
    const eligible =
      key === "evEbitda"
        ? peerRows.filter((r) => pos(r.ebitda))
        : key === "evEbit"
          ? peerRows.filter((r) => pos(r.ebit))
          : key === "pe"
            ? peerRows.filter((r) => pos(r.netIncome))
            : peerRows;
    const values = eligible
      .map((r) => r.multiples[key])
      .filter((v): v is number => v != null && Number.isFinite(v));
    peerMultiples[key] = distFrom(values);
    implied[key] = imply(key, peerMultiples[key].median, subject);
  }

  const perShareValues = COMP_MULTIPLE_KEYS.map((k) => implied[k].perShare).filter(
    (v): v is number => typeof v === "number" && Number.isFinite(v)
  );

  let range: CompsResult["range"] = { low: null, mid: null, high: null };
  if (perShareValues.length > 0) {
    range = {
      low: Math.min(...perShareValues),
      high: Math.max(...perShareValues),
      mid: mean(perShareValues),
    };
  }

  const notes = collectNotes(subjectRow, peerRows, peerMultiples, implied);

  return {
    peers: peerRows,
    subject: subjectRow,
    peerMultiples,
    implied,
    range,
    notes,
  };
}
