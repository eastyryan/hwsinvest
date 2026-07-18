// Rule-based analysis of what's growing, slowing, and potential catalysts.
// Pure functions over the normalized statements — an AI-written narrative can
// replace the output of buildInsights() later without touching callers.

import type { CompanyFinancials, StatementSet, LineValues } from "./edgar";
import { fmtPct } from "./format";

export interface Insight {
  text: string;
  detail?: string;
  tone: "positive" | "negative" | "neutral";
}

export interface Insights {
  growing: Insight[];
  slowing: Insight[];
  catalysts: Insight[];
}

function findLine(set: StatementSet, key: string): LineValues | undefined {
  for (const st of set.statements) {
    const l = st.lines.find((l) => l.key === key);
    if (l) return l;
  }
  return undefined;
}

/** YoY growth values for a line, newest first, nulls skipped. */
function recentYoy(set: StatementSet, line: LineValues, n: number): number[] {
  const out: number[] = [];
  for (const p of set.periods) {
    const v = line.yoy[p.key];
    if (v != null) out.push(v);
    if (out.length === n) break;
  }
  return out;
}

function arrows(vals: number[]): string {
  // vals are newest-first; show oldest → newest
  return [...vals].reverse().map((v) => fmtPct(v)).join(" → ");
}

const WATCHED: { key: string; label: string }[] = [
  { key: "revenue", label: "Revenue" },
  { key: "grossProfit", label: "Gross profit" },
  { key: "operatingIncome", label: "Operating income" },
  { key: "netIncome", label: "Net income" },
  { key: "ocf", label: "Operating cash flow" },
  { key: "fcf", label: "Free cash flow" },
  { key: "rd", label: "R&D spend" },
];

function marginSeries(
  set: StatementSet,
  numerKey: string
): { latest: number; yearAgo: number; streak: number } | null {
  const rev = findLine(set, "revenue");
  const num = findLine(set, numerKey);
  if (!rev || !num) return null;
  const margins: number[] = [];
  for (const p of set.periods) {
    const r = rev.values[p.key];
    const n = num.values[p.key];
    if (r != null && r > 0 && n != null) margins.push(n / r);
    if (margins.length >= 8) break;
  }
  if (margins.length < 5) return null;
  let streak = 0;
  for (let i = 0; i + 4 < margins.length; i++) {
    if (margins[i] > margins[i + 4]) streak++;
    else break;
  }
  return { latest: margins[0], yearAgo: margins[4], streak };
}

const pt = (x: number) => (x * 100).toFixed(1);

export function buildInsights(fin: CompanyFinancials): Insights {
  const q = fin.quarterly;
  const growing: Insight[] = [];
  const slowing: Insight[] = [];
  const catalysts: Insight[] = [];

  for (const { key, label } of WATCHED) {
    const line = findLine(q, key);
    if (!line) continue;
    const yoy = recentYoy(q, line, 3);
    if (yoy.length < 2) continue;
    const [cur, prev] = yoy;
    const accelerating = yoy.length >= 3 && yoy[0] > yoy[1] && yoy[1] > yoy[2];
    const decelerating = yoy.length >= 3 && yoy[0] < yoy[1] && yoy[1] < yoy[2];

    if (cur > 0 && accelerating) {
      growing.push({
        text: `${label} growth is accelerating`,
        detail: `Last 3 quarters YoY: ${arrows(yoy)}`,
        tone: "positive",
      });
    } else if (cur > 0.05 && !decelerating) {
      growing.push({
        text: `${label} growing ${fmtPct(cur)} YoY`,
        detail: `Prior quarter: ${fmtPct(prev)}`,
        tone: "positive",
      });
    } else if (cur < 0) {
      slowing.push({
        text: `${label} declining ${fmtPct(cur)} YoY`,
        detail: `Prior quarter: ${fmtPct(prev)}`,
        tone: "negative",
      });
    } else if (decelerating) {
      slowing.push({
        text: `${label} growth is decelerating`,
        detail: `Last 3 quarters YoY: ${arrows(yoy)}`,
        tone: "negative",
      });
    }
  }

  // Margins
  for (const [key, name] of [
    ["grossProfit", "Gross margin"],
    ["operatingIncome", "Operating margin"],
    ["netIncome", "Net margin"],
  ] as const) {
    const m = marginSeries(q, key);
    if (!m) continue;
    const delta = m.latest - m.yearAgo;
    if (delta > 0.005) {
      const ins: Insight = {
        text: `${name} expanded to ${pt(m.latest)}% (from ${pt(m.yearAgo)}% a year ago)`,
        tone: "positive",
      };
      if (m.streak >= 3) {
        ins.text = `${name} expanding ${m.streak} straight quarters, now ${pt(m.latest)}%`;
        catalysts.push(ins);
      } else {
        growing.push(ins);
      }
    } else if (delta < -0.005) {
      slowing.push({
        text: `${name} compressed to ${pt(m.latest)}% (from ${pt(m.yearAgo)}% a year ago)`,
        tone: "negative",
      });
    }
  }

  // FCF inflection
  const fcf = findLine(q, "fcf");
  if (fcf) {
    const vals = q.periods.map((p) => fcf.values[p.key]).filter((v): v is number => v != null);
    if (vals.length >= 5 && vals[0] > 0 && vals[4] < 0) {
      catalysts.push({
        text: "Free cash flow turned positive vs a year ago",
        tone: "positive",
      });
    }
  }

  // Buybacks shrinking share count
  const shares = findLine(q, "sharesDiluted");
  if (shares) {
    const yoy = recentYoy(q, shares, 1);
    if (yoy.length && yoy[0] < -0.01) {
      catalysts.push({
        text: `Buybacks shrinking the share count ${fmtPct(yoy[0])} YoY`,
        detail: "Fewer shares means each remaining share owns more of the business",
        tone: "positive",
      });
    } else if (yoy.length && yoy[0] > 0.03) {
      slowing.push({
        text: `Share count growing ${fmtPct(yoy[0])} YoY (dilution)`,
        tone: "negative",
      });
    }
  }

  // Debt paydown / buildup
  const st = findLine(q, "stDebt");
  const lt = findLine(q, "ltDebt");
  if (lt) {
    const debtAt = (i: number): number | null => {
      const p = q.periods[i];
      if (!p) return null;
      const l = lt.values[p.key];
      if (l == null) return null;
      return l + (st?.values[p.key] ?? 0);
    };
    const now = debtAt(0);
    const yearAgo = debtAt(4);
    if (now != null && yearAgo != null && yearAgo > 0) {
      const chg = (now - yearAgo) / yearAgo;
      if (chg < -0.05) {
        catalysts.push({
          text: `Total debt reduced ${fmtPct(chg)} over the past year`,
          tone: "positive",
        });
      } else if (chg > 0.25) {
        slowing.push({
          text: `Total debt up ${fmtPct(chg)} over the past year`,
          tone: "negative",
        });
      }
    }
  }

  // Inventory outpacing revenue (demand warning)
  const inv = findLine(q, "inventory");
  const rev = findLine(q, "revenue");
  if (inv && rev) {
    const invYoy = recentYoy(q, inv, 1);
    const revYoy = recentYoy(q, rev, 1);
    if (invYoy.length && revYoy.length && invYoy[0] > revYoy[0] + 0.15 && invYoy[0] > 0.1) {
      slowing.push({
        text: `Inventory growing ${fmtPct(invYoy[0])} YoY, well ahead of revenue (${fmtPct(revYoy[0])})`,
        detail: "Inventory building faster than sales can be an early demand warning",
        tone: "negative",
      });
    }
  }

  // R&D investment outpacing revenue
  const rd = findLine(q, "rd");
  if (rd && rev) {
    const rdYoy = recentYoy(q, rd, 1);
    const revYoy = recentYoy(q, rev, 1);
    if (rdYoy.length && revYoy.length && rdYoy[0] > revYoy[0] + 0.1 && rdYoy[0] > 0.1) {
      catalysts.push({
        text: `R&D investment growing ${fmtPct(rdYoy[0])} YoY, ahead of revenue`,
        detail: "Heavy reinvestment can seed future product cycles",
        tone: "neutral",
      });
    }
  }

  return { growing, slowing, catalysts };
}
