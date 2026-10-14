// Identity checks for one statement, shown under the table.
//
// A line filled by a formula (gross profit = revenue − cost, net change =
// the three sections plus FX) is not evidence that the tags tie. Those
// periods are marked on the line and reported as derived.

import type { LineValues, PeriodCol, Statement } from "./edgar";

/** Residual under this share of the scale is rounding, not a break. */
const TIGHT = 0.005;

export type CheckStatus = "tie" | "gap" | "derived";

export interface StatementIdentity {
  id: "gross-profit" | "balance-sheet" | "cash-flow";
  periodKey: string;
  periodLabel: string;
  status: CheckStatus;
  summary: string;
}

function byKey(statement: Statement): Map<string, LineValues> {
  return new Map(statement.lines.map((l) => [l.key, l]));
}

function num(line: LineValues | undefined, key: string): number | null {
  const v = line?.values[key];
  return v == null || !Number.isFinite(v) ? null : v;
}

function relGap(resid: number, scale: number): number {
  return Math.abs(resid) / Math.max(Math.abs(scale), 1);
}

/**
 * Checks the identities this statement can actually support.
 * Income: revenue − cost vs gross profit. Balance: assets vs liabilities +
 * equity. Cash flow: operating + investing + financing + FX vs net change.
 * Periods are newest first; only the first `limit` are checked.
 */
export function statementIdentityChecks(
  statement: Statement,
  periods: PeriodCol[],
  limit = 4
): StatementIdentity[] {
  const lines = byKey(statement);
  const out: StatementIdentity[] = [];
  const window = periods.slice(0, limit);

  const rev = lines.get("revenue");
  const cogs = lines.get("cogs");
  const gp = lines.get("grossProfit");
  const assets = lines.get("totalAssets");
  const liab = lines.get("totalLiabilities");
  const equity = lines.get("equity");
  const ocf = lines.get("ocf");
  const icf = lines.get("icf");
  const fincf = lines.get("fincf");
  const fx = lines.get("fxEffect");
  const net = lines.get("netChangeInCash");

  for (const p of window) {
    if (rev && cogs && gp) {
      const r = num(rev, p.key);
      const c = num(cogs, p.key);
      const g = num(gp, p.key);
      if (r != null && c != null && g != null && r !== 0) {
        const expected = r - c;
        const gap = relGap(expected - g, r);
        const derived = gp.derived?.[p.key] === true;
        out.push({
          id: "gross-profit",
          periodKey: p.key,
          periodLabel: p.label,
          status: derived && gap <= TIGHT ? "derived" : gap <= TIGHT ? "tie" : "gap",
          summary: derived
            ? `${p.label}: gross profit was filled as revenue − cost of revenue. That match is the formula, not a filed gross-profit tag.`
            : gap <= TIGHT
              ? `${p.label}: revenue − cost of revenue matches gross profit.`
              : `${p.label}: revenue − cost of revenue does not match gross profit.`,
        });
      }
    }

    if (assets && liab && equity) {
      const a = num(assets, p.key);
      const l = num(liab, p.key);
      const e = num(equity, p.key);
      if (a != null && l != null && e != null && a !== 0) {
        const gap = relGap(l + e - a, a);
        const derived =
          assets.derived?.[p.key] === true ||
          liab.derived?.[p.key] === true ||
          equity.derived?.[p.key] === true;
        out.push({
          id: "balance-sheet",
          periodKey: p.key,
          periodLabel: p.label,
          status: derived && gap <= TIGHT ? "derived" : gap <= TIGHT ? "tie" : "gap",
          summary: derived
            ? `${p.label}: assets and liabilities + equity match because a line was filled from the others.`
            : gap <= TIGHT
              ? `${p.label}: assets match liabilities + equity.`
              : `${p.label}: assets do not match liabilities + equity.`,
        });
      }
    }

    if (ocf && icf && fincf && net) {
      const a = num(ocf, p.key);
      const b = num(icf, p.key);
      const c = num(fincf, p.key);
      const n = num(net, p.key);
      const f = num(fx, p.key) ?? 0;
      if (a != null && b != null && c != null && n != null) {
        const sections = a + b + c + f;
        const scale = Math.max(Math.abs(a), Math.abs(n), Math.abs(sections), 1);
        const gap = relGap(sections - n, scale);
        const derived = net.derived?.[p.key] === true;
        const fxNote = fx && num(fx, p.key) != null ? " including the FX effect" : "";
        out.push({
          id: "cash-flow",
          periodKey: p.key,
          periodLabel: p.label,
          status: derived && gap <= TIGHT ? "derived" : gap <= TIGHT ? "tie" : "gap",
          summary: derived
            ? `${p.label}: the change in cash${fxNote} matches the three sections because that figure was completed from them.`
            : gap <= TIGHT
              ? `${p.label}: operating + investing + financing${fxNote} matches the change in cash.`
              : `${p.label}: operating + investing + financing${fxNote} does not match the change in cash.`,
        });
      }
    }
  }

  return out;
}

export interface BalancePlug {
  periodKey: string;
  periodLabel: string;
  /** Assets − liabilities − equity. Zero when the three lines tie. */
  residual: number;
  tied: boolean;
}

/**
 * Assets − liabilities − equity for every period that has all three lines.
 * Returns null when this statement is not a balance sheet.
 * A residual inside 0.5% of assets is treated as a tie (rounding).
 */
export function balanceSheetPlug(
  statement: Statement,
  periods: PeriodCol[]
): BalancePlug[] | null {
  const lines = byKey(statement);
  const assets = lines.get("totalAssets");
  const liab = lines.get("totalLiabilities");
  const equity = lines.get("equity");
  if (!assets || !liab || !equity) return null;

  const out: BalancePlug[] = [];
  for (const p of periods) {
    const a = num(assets, p.key);
    const l = num(liab, p.key);
    const e = num(equity, p.key);
    if (a == null || l == null || e == null) continue;
    const residual = a - l - e;
    out.push({
      periodKey: p.key,
      periodLabel: p.label,
      residual,
      tied: relGap(residual, a) <= TIGHT,
    });
  }
  return out.length > 0 ? out : null;
}
