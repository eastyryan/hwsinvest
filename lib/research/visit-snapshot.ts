// Last-visit snapshots so Overview can show "what changed" since the user
// last looked at a company. Pure comparison helpers + localStorage I/O.

import type { CompanyFinancials, StatementSet } from "./edgar";
import {
  type SectorMode,
  isGrossMarginMeaningful,
  preferredOverviewLineKeys,
} from "./sector-mode";

export interface MetricSnap {
  key: string;
  label: string;
  value: number | null;
  yoy: number | null;
  /** When set, value is a ratio (0.3 = 30%) rather than a statement dollar. */
  format?: "value" | "pct";
}

export interface VisitSnapshot {
  ticker: string;
  savedAt: string;
  periodLabel: string | null;
  /** Period end key (ISO date) for detecting a new filing period. */
  periodKey: string | null;
  /** annual | quarterly — which set the snapshot was taken from. */
  freq: "annual" | "quarterly";
  metrics: MetricSnap[];
}

export interface MetricDelta {
  key: string;
  label: string;
  prev: number | null;
  next: number | null;
  prevYoy: number | null;
  nextYoy: number | null;
  /** Absolute change in the level (same units as the statement / ratio). */
  levelDelta: number | null;
  /** Change in YoY growth rate, in percentage points (e.g. 0.02 = +2pp). */
  yoyDeltaPp: number | null;
  format: "value" | "pct";
  direction: "up" | "down" | "flat" | "unknown";
}

export interface VisitDiff {
  deltas: MetricDelta[];
  periodChanged: boolean;
  prevPeriod: string | null;
  nextPeriod: string | null;
  daysSince: number | null;
  headline: string;
}

const LINE_LABELS: Record<string, string> = {
  revenue: "Revenue",
  grossProfit: "Gross profit",
  cogs: "Cost of revenue / benefits",
  opex: "Operating expenses",
  operatingIncome: "Operating income",
  netIncome: "Net income",
  epsDiluted: "EPS (diluted)",
  interestExpense: "Interest expense",
  receivables: "Receivables / loans",
  fcf: "Free cash flow",
  ocf: "Operating cash flow",
  totalAssets: "Total assets",
  equity: "Equity",
};

function findLine(set: StatementSet, key: string) {
  for (const st of set.statements) {
    const l = st.lines.find((x) => x.key === key);
    if (l) return l;
  }
  return undefined;
}

export function buildVisitSnapshot(
  fin: CompanyFinancials,
  mode: SectorMode = "standard"
): VisitSnapshot {
  // Prefer quarterly for fresher "what changed"; fall back to annual.
  const useQ = fin.quarterly.periods.length > 0;
  const set = useQ ? fin.quarterly : fin.annual;
  const freq: "annual" | "quarterly" = useQ ? "quarterly" : "annual";
  const p = set.periods[0];
  const metrics: MetricSnap[] = [];

  const watchedKeys = preferredOverviewLineKeys(mode);
  for (const key of watchedKeys) {
    const label = LINE_LABELS[key] ?? key;
    const line = findLine(set, key);
    if (!line || !p) {
      metrics.push({ key, label, value: null, yoy: null, format: "value" });
      continue;
    }
    metrics.push({
      key,
      label,
      value: line.values[p.key] ?? null,
      yoy: line.yoy[p.key] ?? null,
      format: "value",
    });
  }

  // Point-in-time margins for the same period as the lines above (not TTM),
  // so a single new quarter is enough to detect margin moves.
  const marginOf = (numKey: string, denKey = "revenue"): number | null => {
    if (!p) return null;
    const n = findLine(set, numKey)?.values[p.key] ?? null;
    const d = findLine(set, denKey)?.values[p.key] ?? null;
    if (n == null || d == null || d === 0) return null;
    return n / d;
  };
  const marginYoyPp = (numKey: string): number | null => {
    if (!p) return null;
    const now = marginOf(numKey);
    if (now == null) return null;
    const t = new Date(p.end).getTime();
    const target = t - 365 * 86400000;
    let bestKey: string | null = null;
    let bestD = Infinity;
    for (const q of set.periods) {
      if (q.key === p.key) continue;
      const dist = Math.abs(new Date(q.end).getTime() - target);
      if (dist > 40 * 86400000) continue;
      if (dist < bestD) {
        bestD = dist;
        bestKey = q.key;
      }
    }
    if (!bestKey) return null;
    const n = findLine(set, numKey)?.values[bestKey] ?? null;
    const d = findLine(set, "revenue")?.values[bestKey] ?? null;
    if (n == null || d == null || d === 0) return null;
    return now - n / d;
  };

  const marginDefs: { key: string; label: string; num: string }[] = [
    ...(isGrossMarginMeaningful(mode)
      ? [{ key: "grossMargin", label: "Gross margin", num: "grossProfit" }]
      : []),
    { key: "opMargin", label: "Operating margin", num: "operatingIncome" },
    { key: "netMargin", label: "Net margin", num: "netIncome" },
    { key: "fcfMargin", label: "FCF margin", num: "fcf" },
  ];
  for (const m of marginDefs) {
    metrics.push({
      key: m.key,
      label: m.label,
      value: marginOf(m.num),
      yoy: marginYoyPp(m.num),
      format: "pct",
    });
  }

  return {
    ticker: fin.ticker.toUpperCase(),
    savedAt: new Date().toISOString(),
    periodLabel: p?.label ?? null,
    periodKey: p?.key ?? null,
    freq,
    metrics,
  };
}

export function diffSnapshots(prev: VisitSnapshot, next: VisitSnapshot): VisitDiff {
  const out: MetricDelta[] = [];
  for (const m of next.metrics) {
    const p = prev.metrics.find((x) => x.key === m.key);
    if (!p) continue;
    const format = m.format ?? p.format ?? "value";
    const levelDelta =
      m.value != null && p.value != null ? m.value - p.value : null;

    // For % metrics, the stored "yoy" is already a YoY pp move of the margin.
    // For dollar lines, yoy is the growth rate; yoyDeltaPp is change in that rate.
    let yoyDeltaPp: number | null = null;
    if (format === "pct") {
      // Prefer period-over-period level change on the margin itself.
      yoyDeltaPp = levelDelta;
    } else if (m.yoy != null && p.yoy != null) {
      yoyDeltaPp = m.yoy - p.yoy;
    }

    let direction: MetricDelta["direction"] = "unknown";
    const signal = format === "pct" ? levelDelta : (yoyDeltaPp ?? levelDelta);
    // Noise floors: 0.1pp for rates/margins, tiny for levels.
    const floor = format === "pct" ? 0.001 : 1e-12;
    if (signal == null) direction = "unknown";
    else if (Math.abs(signal) < floor) direction = "flat";
    else direction = signal > 0 ? "up" : "down";

    const levelNoise =
      levelDelta == null ||
      Math.abs(levelDelta) < (format === "pct" ? 0.001 : 1e-6);
    const yoyNoise = yoyDeltaPp == null || Math.abs(yoyDeltaPp) < 0.001;
    if (levelNoise && yoyNoise) continue;

    out.push({
      key: m.key,
      label: m.label,
      prev: p.value,
      next: m.value,
      prevYoy: p.yoy,
      nextYoy: m.yoy,
      levelDelta,
      yoyDeltaPp: format === "pct" ? levelDelta : yoyDeltaPp,
      format,
      direction,
    });
  }

  out.sort((a, b) => {
    const ay = Math.abs(a.yoyDeltaPp ?? 0);
    const by = Math.abs(b.yoyDeltaPp ?? 0);
    if (by !== ay) return by - ay;
    return Math.abs(b.levelDelta ?? 0) - Math.abs(a.levelDelta ?? 0);
  });

  const periodChanged =
    !!prev.periodKey &&
    !!next.periodKey &&
    prev.periodKey !== next.periodKey;

  let daysSince: number | null = null;
  const prevMs = Date.parse(prev.savedAt);
  const nextMs = Date.parse(next.savedAt);
  if (Number.isFinite(prevMs) && Number.isFinite(nextMs)) {
    daysSince = Math.max(0, Math.round((nextMs - prevMs) / 86400000));
  }

  const bits: string[] = [];
  if (periodChanged) {
    bits.push(
      `New period ${next.periodLabel ?? "filed"}` +
        (prev.periodLabel ? ` (was ${prev.periodLabel})` : "")
    );
  }
  if (out.length > 0) {
    bits.push(
      `${out.length} metric${out.length === 1 ? "" : "s"} moved`
    );
  } else if (!periodChanged) {
    bits.push("No material move in watched metrics");
  }
  if (daysSince != null && daysSince > 0) {
    bits.push(daysSince === 1 ? "1 day since last visit" : `${daysSince} days since last visit`);
  }

  return {
    deltas: out,
    periodChanged,
    prevPeriod: prev.periodLabel,
    nextPeriod: next.periodLabel,
    daysSince,
    headline: bits.join(" · ") || "Baseline comparison",
  };
}

function storageKey(ticker: string) {
  return `visitSnap:v2:${ticker.toUpperCase()}`;
}

export function loadVisitSnapshot(ticker: string): VisitSnapshot | null {
  try {
    const raw = localStorage.getItem(storageKey(ticker));
    if (!raw) {
      // Migrate v1 key once if present.
      const legacy = localStorage.getItem(`visitSnap:${ticker.toUpperCase()}`);
      if (!legacy) return null;
      const parsed = JSON.parse(legacy) as VisitSnapshot;
      if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.metrics)) {
        return null;
      }
      return {
        ...parsed,
        periodKey: parsed.periodKey ?? null,
        freq: parsed.freq ?? "quarterly",
      };
    }
    const parsed = JSON.parse(raw) as VisitSnapshot;
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.metrics)) {
      return null;
    }
    return {
      ...parsed,
      periodKey: parsed.periodKey ?? null,
      freq: parsed.freq ?? "quarterly",
    };
  } catch {
    return null;
  }
}

export function saveVisitSnapshot(snap: VisitSnapshot): void {
  try {
    localStorage.setItem(storageKey(snap.ticker), JSON.stringify(snap));
  } catch {
    // private mode
  }
}

export function clearVisitSnapshot(ticker: string): void {
  try {
    localStorage.removeItem(storageKey(ticker));
    localStorage.removeItem(`visitSnap:${ticker.toUpperCase()}`);
  } catch {
    // private mode
  }
}
