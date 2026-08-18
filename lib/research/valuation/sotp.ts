/**
 * Sum-of-the-parts (SOTP) valuation.
 *
 * Value each segment with an EV/Sales or EV/EBITDA multiple (or a direct EV
 * override), subtract corporate overhead haircut and net debt → equity / share.
 */

export type SotPSegment = {
  id: string;
  name: string;
  revenue?: number | null;
  ebitda?: number | null;
  /** EV/Sales or EV/EBITDA multiple applied */
  multiple: number;
  multipleType: "evSales" | "evEbitda";
  /** optional direct EV override */
  enterpriseValueOverride?: number | null;
};

export type SotPResult = {
  segments: { segment: SotPSegment; enterpriseValue: number | null }[];
  sumSegmentEv: number | null;
  corporateOverheadEv: number | null; // negative drag if provided as EV haircut
  grossEv: number | null;
  netDebt: number | null;
  equityValue: number | null;
  perShare: number | null;
  notes: string[];
};

function isFiniteNumber(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

function segmentEv(seg: SotPSegment, notes: string[]): number | null {
  if (isFiniteNumber(seg.enterpriseValueOverride)) {
    return seg.enterpriseValueOverride;
  }
  if (!isFiniteNumber(seg.multiple)) {
    notes.push(`Segment "${seg.name}": non-finite multiple — EV null`);
    return null;
  }
  if (seg.multipleType === "evSales") {
    if (!isFiniteNumber(seg.revenue)) {
      notes.push(`Segment "${seg.name}": missing revenue for EV/Sales`);
      return null;
    }
    return seg.revenue * seg.multiple;
  }
  // evEbitda
  if (!isFiniteNumber(seg.ebitda)) {
    notes.push(`Segment "${seg.name}": missing EBITDA for EV/EBITDA`);
    return null;
  }
  return seg.ebitda * seg.multiple;
}

export function runSotp(args: {
  segments: SotPSegment[];
  netDebt?: number | null;
  shares?: number | null;
  /** EV haircut for corporate costs (positive number subtracts) */
  corporateOverheadEv?: number | null;
}): SotPResult {
  const notes: string[] = [];
  const segments = args.segments ?? [];

  const valued = segments.map((segment) => ({
    segment,
    enterpriseValue: segmentEv(segment, notes),
  }));

  const finiteEvs = valued
    .map((v) => v.enterpriseValue)
    .filter(isFiniteNumber);

  const sumSegmentEv =
    finiteEvs.length > 0 ? finiteEvs.reduce((a, b) => a + b, 0) : null;

  if (sumSegmentEv == null && segments.length > 0) {
    notes.push("No segment produced a finite enterprise value");
  } else if (finiteEvs.length < segments.length) {
    notes.push(
      `${segments.length - finiteEvs.length} of ${segments.length} segments lack EV`
    );
  }

  const overheadRaw = args.corporateOverheadEv;
  const corporateOverheadEv = isFiniteNumber(overheadRaw) ? overheadRaw : null;
  if (corporateOverheadEv != null && corporateOverheadEv > 0) {
    notes.push(
      `Corporate overhead EV haircut of ${corporateOverheadEv} subtracted from sum of parts`
    );
  }

  let grossEv: number | null = null;
  if (sumSegmentEv != null) {
    const haircut =
      corporateOverheadEv != null && corporateOverheadEv > 0
        ? corporateOverheadEv
        : 0;
    grossEv = sumSegmentEv - haircut;
  }

  const netDebt = isFiniteNumber(args.netDebt) ? args.netDebt : null;

  let equityValue: number | null = null;
  if (grossEv != null && netDebt != null) {
    equityValue = grossEv - netDebt;
  } else if (grossEv != null && netDebt == null) {
    notes.push("Net debt missing — equity value not bridged");
  }

  let perShare: number | null = null;
  const shares = args.shares;
  if (equityValue != null && isFiniteNumber(shares) && shares > 0) {
    perShare = equityValue / shares;
  } else if (equityValue != null) {
    notes.push("Shares missing or non-positive — per-share null");
  }

  return {
    segments: valued,
    sumSegmentEv,
    corporateOverheadEv,
    grossEv,
    netDebt,
    equityValue,
    perShare,
    notes,
  };
}

/**
 * Build starter segments from product segment history if available.
 * Latest period value is treated as revenue; multipleType is always evSales.
 */
export function seedSegmentsFromHistory(
  history:
    | { name: string; values: Record<string, number | null>; periods: string[] }[]
    | null,
  defaultMultiple: number
): SotPSegment[] {
  if (!history || history.length === 0) return [];

  const multiple = isFiniteNumber(defaultMultiple) ? defaultMultiple : 1;

  return history.map((row, i) => {
    const periods = row.periods ?? [];
    // Newest first when periods are ordered that way; otherwise last key with a value.
    let revenue: number | null = null;
    for (const p of periods) {
      const v = row.values?.[p];
      if (isFiniteNumber(v)) {
        revenue = v;
        break;
      }
    }
    if (revenue == null && row.values) {
      for (const v of Object.values(row.values)) {
        if (isFiniteNumber(v)) {
          revenue = v;
          break;
        }
      }
    }

    const id =
      row.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") || `segment-${i}`;

    return {
      id,
      name: row.name,
      revenue,
      ebitda: null,
      multiple,
      multipleType: "evSales" as const,
    };
  });
}
