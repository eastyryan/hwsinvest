// Data-confidence report for a normalized company payload.
//
// Pure over statements where possible; restatements are an optional input
// from lib/restatements.ts (raw companyfacts scan).

import type { CompanyFinancials, StatementSet } from "./edgar";
import type { RestatementHit } from "./restatements";

export type BadgeLevel = "info" | "warn" | "good";

export interface ConfidenceBadge {
  id: string;
  level: BadgeLevel;
  label: string;
  detail: string;
}

export interface ConfidenceReport {
  /** 0–100 composite: coverage of key lines, history depth, no restatements. */
  score: number;
  grade: "high" | "medium" | "low";
  badges: ConfidenceBadge[];
  /** Key lines present on the latest annual period. */
  coverage: { present: number; total: number; missing: string[] };
  historyYears: number;
  restatementCount: number;
}

const KEY_LINES = [
  { key: "revenue", label: "Revenue" },
  { key: "operatingIncome", label: "Operating income" },
  { key: "netIncome", label: "Net income" },
  { key: "totalAssets", label: "Total assets" },
  { key: "equity", label: "Equity" },
  { key: "ocf", label: "Operating cash flow" },
  { key: "capex", label: "Capex" },
  { key: "cash", label: "Cash" },
];

function findLine(set: StatementSet, key: string) {
  for (const st of set.statements) {
    const l = st.lines.find((x) => x.key === key);
    if (l) return l;
  }
  return undefined;
}

function latestValue(set: StatementSet, key: string): number | null {
  const p = set.periods[0];
  if (!p) return null;
  const line = findLine(set, key);
  if (!line) return null;
  return line.values[p.key] ?? null;
}

/** Count annual periods that have any revenue (or total assets) fact. */
function historyDepth(fin: CompanyFinancials): number {
  const rev = findLine(fin.annual, "revenue");
  const assets = findLine(fin.annual, "totalAssets");
  let n = 0;
  for (const p of fin.annual.periods) {
    const r = rev?.values[p.key];
    const a = assets?.values[p.key];
    if ((r != null && r !== 0) || (a != null && a !== 0)) n++;
  }
  return n;
}

export function buildConfidence(
  fin: CompanyFinancials,
  restatements: RestatementHit[] = []
): ConfidenceReport {
  const badges: ConfidenceBadge[] = [];
  const missing: string[] = [];
  let present = 0;

  for (const { key, label } of KEY_LINES) {
    const v = latestValue(fin.annual, key) ?? latestValue(fin.quarterly, key);
    if (v != null) present++;
    else missing.push(label);
  }

  const coverageRatio = present / KEY_LINES.length;
  const historyYears = historyDepth(fin);

  // Coverage badge
  if (coverageRatio >= 0.85) {
    badges.push({
      id: "coverage-high",
      level: "good",
      label: "Strong line coverage",
      detail: `${present}/${KEY_LINES.length} key lines present on the latest period.`,
    });
  } else if (coverageRatio >= 0.55) {
    badges.push({
      id: "coverage-med",
      level: "warn",
      label: "Partial line coverage",
      detail: `Missing: ${missing.slice(0, 4).join(", ")}${missing.length > 4 ? "…" : ""}.`,
    });
  } else {
    badges.push({
      id: "coverage-low",
      level: "warn",
      label: "Sparse filings",
      detail: `Only ${present}/${KEY_LINES.length} key lines found — numbers may be incomplete.`,
    });
  }

  // History depth
  if (historyYears >= 8) {
    badges.push({
      id: "history-deep",
      level: "good",
      label: `${historyYears}y history`,
      detail: "Long annual history available for CAGR and trends.",
    });
  } else if (historyYears >= 3) {
    badges.push({
      id: "history-ok",
      level: "info",
      label: `${historyYears}y history`,
      detail: "Limited annual depth — long CAGRs may be blank.",
    });
  } else {
    badges.push({
      id: "history-short",
      level: "warn",
      label: "Short history",
      detail: "Fewer than 3 annual periods with data.",
    });
  }

  // Currency
  if (fin.currency && fin.currency !== "USD") {
    badges.push({
      id: "fx",
      level: "info",
      label: `Reports in ${fin.currency}`,
      detail: "Statements are in the filer's reporting currency, not USD.",
    });
  }

  // Restatements
  const restatementCount = restatements.length;
  if (restatementCount > 0) {
    const top = restatements[0];
    const pct = (top.relChange * 100).toFixed(1);
    badges.push({
      id: "restated",
      level: "warn",
      label:
        restatementCount === 1
          ? `${top.concept} restated`
          : `${restatementCount} restatements`,
      detail: `${top.concept} for period ending ${top.periodEnd} changed ${pct}% across filings (${top.firstFiled} → ${top.lastFiled}).`,
    });
  } else {
    badges.push({
      id: "no-restatements",
      level: "good",
      label: "No material restatements",
      detail: "Headline annual figures look stable across 10-K revisions (1% band).",
    });
  }

  // Composite score
  let score = coverageRatio * 50 + Math.min(historyYears, 10) * 3;
  if (restatementCount === 0) score += 15;
  else score -= Math.min(25, restatementCount * 5);
  if (fin.currency !== "USD") score -= 2;
  score = Math.max(0, Math.min(100, Math.round(score)));

  const grade: ConfidenceReport["grade"] =
    score >= 75 ? "high" : score >= 50 ? "medium" : "low";

  return {
    score,
    grade,
    badges,
    coverage: { present, total: KEY_LINES.length, missing },
    historyYears,
    restatementCount,
  };
}
