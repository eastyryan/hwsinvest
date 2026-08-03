// Deterministic narrative summary, composed from the filed numbers.
//
// This is the no-API-key path and the default. It produces the same
// {business, momentum, catalysts} shape as the optional Claude summary, so the
// UI renders either one without knowing which it got.
//
// Design rules, because generated prose degrades badly when they're broken:
//   1. Never assert something the data doesn't support. Every clause is gated
//      on its inputs being present, and clauses drop out silently when they
//      aren't. A short honest paragraph beats a padded one.
//   2. Always carry the number. "Margins improved" is filler; "gross margin
//      widened to 49.3% from 46.1%" is information.
//   3. Combine related signals into one sentence rather than listing them.
//      The failure mode of rule-based prose is a run of stub sentences that
//      each state one fact.
//   4. Characterize before evaluating. Saying what kind of business the numbers
//      describe is more useful than grading it.

import type { CompanyFinancials, StatementSet } from "./edgar";
import type { Insights } from "./insights";

export interface Narrative {
  business: string;
  momentum: string;
  catalysts: string;
}

export interface MarketContext {
  marketCap?: number | null;
  currency?: string;
}

// --- data access ------------------------------------------------------------

function line(set: StatementSet, key: string) {
  for (const st of set.statements) {
    const l = st.lines.find((l) => l.key === key);
    if (l) return l;
  }
  return undefined;
}

/** Trailing-twelve-month sum of a flow line, `offset` quarters back. */
function ttm(set: StatementSet, key: string, offset = 0): number | null {
  const l = line(set, key);
  if (!l) return null;
  let sum = 0;
  for (let i = offset; i < offset + 4; i++) {
    const p = set.periods[i];
    if (!p) return null;
    const v = l.values[p.key];
    if (v == null) return null;
    sum += v;
  }
  return sum;
}

/** Point-in-time balance value, `offset` quarters back. */
function at(set: StatementSet, key: string, offset = 0): number | null {
  const l = line(set, key);
  const p = set.periods[offset];
  if (!l || !p) return null;
  return l.values[p.key] ?? null;
}

/** Most recent non-null quarterly YoY growth for a line. */
function latestYoy(set: StatementSet, key: string): number | null {
  const l = line(set, key);
  if (!l) return null;
  for (const p of set.periods) {
    const v = l.yoy[p.key];
    if (v != null) return v;
  }
  return null;
}

/** The last `n` non-null YoY readings, newest first. */
function yoySeries(set: StatementSet, key: string, n: number): number[] {
  const l = line(set, key);
  if (!l) return [];
  const out: number[] = [];
  for (const p of set.periods) {
    const v = l.yoy[p.key];
    if (v != null) out.push(v);
    if (out.length === n) break;
  }
  return out;
}

const ratio = (a: number | null, b: number | null): number | null =>
  a != null && b != null && b !== 0 ? a / b : null;

// --- formatting -------------------------------------------------------------

function money(v: number, currency: string): string {
  const sym = currency === "USD" ? "$" : "";
  const suffix = currency === "USD" ? "" : ` ${currency}`;
  const abs = Math.abs(v);
  let body: string;
  if (abs >= 1e12) body = `${(v / 1e12).toFixed(2)}T`;
  else if (abs >= 1e9) body = `${(v / 1e9).toFixed(1)}B`;
  else if (abs >= 1e6) body = `${(v / 1e6).toFixed(0)}M`;
  else body = v.toFixed(0);
  return `${sym}${body}${suffix}`;
}

const pct = (v: number, digits = 1): string => `${(v * 100).toFixed(digits)}%`;

/** Signed percentage, for changes. */
const delta = (v: number): string => `${v > 0 ? "+" : ""}${(v * 100).toFixed(1)}%`;

/**
 * Express a span of years readably. "0.1 years" is a silly unit; below a year
 * this reads better in months, and under a month it isn't worth quantifying.
 */
function coverage(years: number): string {
  // Returns the complete phrase including its own hedge, so callers don't
  // prepend one. "about" + "under a month's worth" produced "about under a
  // month's worth".
  if (years < 0.08) return "less than a month's worth";
  if (years < 1) {
    const months = Math.max(1, Math.round(years * 12));
    // Possessive differs by number: "1 month's worth", "5 months' worth".
    return `about ${months} ${months === 1 ? "month's" : "months'"} worth`;
  }
  return `about ${years.toFixed(1)} years' worth`;
}

/** Join clauses into prose: "a", "a and b", "a, b and c". */
function sentence(parts: string[]): string {
  const p = parts.filter(Boolean);
  if (p.length === 0) return "";
  if (p.length === 1) return p[0];
  return `${p.slice(0, -1).join(", ")} and ${p[p.length - 1]}`;
}

function paragraph(sentences: string[]): string {
  return sentences
    .filter(Boolean)
    .map((s) => (s.endsWith(".") ? s : `${s}.`))
    .join(" ");
}

// --- paragraph 1: what the business looks like ------------------------------

function businessParagraph(fin: CompanyFinancials, ctx: MarketContext): string {
  const q = fin.quarterly;
  const a = fin.annual;
  const cur = fin.currency;
  const out: string[] = [];

  // Prefer TTM; fall back to the latest fiscal year for filers whose quarterly
  // data is too sparse to form a trailing window.
  const revenue = ttm(q, "revenue") ?? at(a, "revenue");
  const basis = ttm(q, "revenue") != null ? "trailing twelve months" : "the last fiscal year";
  const gross = ttm(q, "grossProfit") ?? at(a, "grossProfit");
  const op = ttm(q, "operatingIncome") ?? at(a, "operatingIncome");
  const net = ttm(q, "netIncome") ?? at(a, "netIncome");
  const fcf = ttm(q, "fcf") ?? at(a, "fcf");
  const capex = ttm(q, "capex") ?? at(a, "capex");
  const rd = ttm(q, "rd") ?? at(a, "rd");
  const ocf = ttm(q, "ocf") ?? at(a, "ocf");

  const gm = ratio(gross, revenue);
  const om = ratio(op, revenue);
  const capexPct = capex != null && revenue ? Math.abs(capex) / revenue : null;
  const rdPct = ratio(rd, revenue);

  // Scale + margin structure.
  if (revenue != null) {
    const margins: string[] = [];
    if (gm != null) margins.push(`a ${pct(gm)} gross margin`);
    if (om != null) margins.push(`${pct(om)} operating margin`);
    if (margins.length) {
      out.push(
        `Over the ${basis} this is a ${money(revenue, cur)} revenue business running ${sentence(margins)}`
      );
    } else {
      out.push(`Over the ${basis} this is a ${money(revenue, cur)} revenue business`);
    }
  }

  // Characterize the model from cost structure rather than grading it.
  //
  // Each trait becomes its own sentence. Joining clauses of different
  // grammatical shapes with "and" produced genuinely ambiguous prose:
  // "spending 2.4% of revenue on capex and R&D absorbs 8.9% of revenue"
  // parses as though capex and R&D were a single combined figure.

  // Only remark on gross margin where the level is actually distinctive; the
  // number itself is already in the sentence above, so a middle-of-the-range
  // note would be pure filler.
  //
  // No industry is named here. The filings don't contain one, and guessing from
  // margin alone was wrong in practice — it labeled a car manufacturer as
  // "typical of retail and distribution".
  if (gm != null) {
    if (gm >= 0.7) out.push("That gross margin is software-like");
    else if (gm < 0.25)
      out.push("That is a thin-gross-margin model, so operating results are sensitive to small moves in input costs");
  }

  // Capital intensity is measured against the cash the business generates, not
  // against revenue. Capex/revenue flatters any high-revenue, low-margin filer:
  // it labeled a big-box retailer "capital-light" at 3.7% of revenue when that
  // spending actually consumes over half of its operating cash flow.
  if (capexPct != null && capex != null) {
    const capexOfOcf = ocf != null && ocf > 0 ? Math.abs(capex) / ocf : null;
    const intensity =
      capexOfOcf == null
        ? null
        : capexOfOcf >= 0.4
          ? "a capital-heavy profile"
          : capexOfOcf >= 0.18
            ? "a moderately capital-intensive profile"
            : "a capital-light profile";
    const against =
      capexOfOcf != null ? ` and ${pct(capexOfOcf, 0)} of operating cash flow` : "";
    out.push(
      `Capital spending runs ${pct(capexPct)} of revenue${against}${
        intensity ? `, ${intensity}` : ""
      }`
    );
  }

  if (rdPct != null && rdPct >= 0.05) {
    out.push(`R&D absorbs ${pct(rdPct)} of revenue`);
  }

  // Earnings quality: does reported profit turn into cash?
  const conversion = ratio(fcf, net);
  if (conversion != null && net != null && net > 0) {
    if (conversion >= 1.1) {
      out.push(
        `Free cash flow runs ahead of reported net income, at ${pct(conversion, 0)} of it, so earnings are well backed by cash`
      );
    } else if (conversion >= 0.8) {
      out.push(`Free cash flow tracks net income closely, at ${pct(conversion, 0)} of it`);
    } else if (conversion >= 0.4) {
      out.push(
        `Free cash flow is ${pct(conversion, 0)} of net income, so a meaningful share of reported profit is not converting to cash`
      );
    } else {
      out.push(
        `Free cash flow is only ${pct(conversion, 0)} of net income, a gap worth understanding before trusting the earnings line`
      );
    }
  } else if (net != null && net < 0) {
    out.push(`The company is not profitable on a net basis, losing ${money(Math.abs(net), cur)}`);
  }

  // Stock-based compensation relative to the cash it is reported alongside.
  const sbc = ttm(q, "sbc") ?? at(a, "sbc");
  const sbcShare = ratio(sbc, ocf);
  if (sbcShare != null && sbcShare >= 0.15 && ocf != null && ocf > 0) {
    out.push(
      `Stock-based compensation equals ${pct(sbcShare, 0)} of operating cash flow, so a material part of the cash figure is a non-cash expense added back`
    );
  }

  // Valuation context, only where both inputs are real.
  // Requires a positive market cap, not merely a present one: a filer with no
  // usable share count yielded zero, and the sentence then announced the
  // business was "priced at 0.0x trailing earnings and 0.0x free cash flow".
  if (ctx.marketCap != null && Number.isFinite(ctx.marketCap) && ctx.marketCap > 0 && net != null && net > 0) {
    const pe = ctx.marketCap / net;
    const pfcf = fcf != null && fcf > 0 ? ctx.marketCap / fcf : null;
    const bits = [`${pe.toFixed(1)}x trailing earnings`];
    if (pfcf != null) bits.push(`${pfcf.toFixed(1)}x free cash flow`);
    out.push(`At the current market value the business is priced at ${sentence(bits)}`);
  }

  if (out.length === 0) {
    return "There isn't enough filed data yet to describe the shape of this business.";
  }
  return paragraph(out);
}

// --- paragraph 2: momentum --------------------------------------------------

function momentumParagraph(fin: CompanyFinancials): string {
  const q = fin.quarterly;
  const cur = fin.currency;
  const out: string[] = [];

  const revYoy = latestYoy(q, "revenue");
  const revSeries = yoySeries(q, "revenue", 3);
  const opYoy = latestYoy(q, "operatingIncome");
  const netYoy = latestYoy(q, "netIncome");

  // Growth rate, with its own recent trajectory as the comparison.
  if (revYoy != null) {
    let clause = `Revenue grew ${delta(revYoy)} year over year in the most recent quarter`;
    if (revYoy < 0) {
      clause = `Revenue fell ${delta(revYoy)} year over year in the most recent quarter`;
    }
    if (revSeries.length >= 3) {
      const [c, p, pp] = revSeries;
      if (c > p && p > pp) clause += `, accelerating from ${delta(pp)} two quarters earlier`;
      else if (c < p && p < pp) clause += `, decelerating from ${delta(pp)} two quarters earlier`;
      else clause += ` (${delta(pp)} and ${delta(p)} in the two quarters before that)`;
    }
    out.push(clause);
  }

  // Operating leverage: the relationship between top and middle line growth is
  // more informative than either number alone.
  if (revYoy != null && opYoy != null && revYoy > 0) {
    // Explicitly scoped to the quarter. This sits next to a trailing-twelve-
    // month margin move below, and the two can point in opposite directions
    // legitimately — an unlabeled pair reads as a contradiction.
    if (opYoy > revYoy + 0.03) {
      out.push(
        `In that quarter operating income grew faster than revenue (${delta(opYoy)} against ${delta(revYoy)}), the signature of operating leverage rather than growth bought with spending`
      );
    } else if (opYoy < revYoy - 0.03) {
      out.push(
        `In that quarter operating income grew more slowly than revenue (${delta(opYoy)} against ${delta(revYoy)}), so the growth is costing more than it did`
      );
    }
  }

  // Margin direction, stated as levels rather than adjectives.
  const gmNow = ratio(ttm(q, "grossProfit"), ttm(q, "revenue"));
  const gmYear = ratio(ttm(q, "grossProfit", 4), ttm(q, "revenue", 4));
  const omNow = ratio(ttm(q, "operatingIncome"), ttm(q, "revenue"));
  const omYear = ratio(ttm(q, "operatingIncome", 4), ttm(q, "revenue", 4));
  const moves: string[] = [];
  if (gmNow != null && gmYear != null && Math.abs(gmNow - gmYear) >= 0.005) {
    moves.push(
      `gross margin ${gmNow > gmYear ? "widened" : "narrowed"} to ${pct(gmNow)} from ${pct(gmYear)}`
    );
  }
  if (omNow != null && omYear != null && Math.abs(omNow - omYear) >= 0.005) {
    moves.push(
      `operating margin ${omNow > omYear ? "widened" : "narrowed"} to ${pct(omNow)} from ${pct(omYear)}`
    );
  }
  if (moves.length) out.push(`On a trailing-twelve-month basis ${sentence(moves)}`);

  // Cash generation direction, which can diverge from reported earnings.
  const fcfNow = ttm(q, "fcf");
  const fcfYear = ttm(q, "fcf", 4);
  if (fcfNow != null && fcfYear != null) {
    if (fcfYear <= 0 && fcfNow > 0) {
      out.push(
        `Free cash flow turned positive over the past year, from ${money(fcfYear, cur)} to ${money(fcfNow, cur)}`
      );
    } else if (fcfYear > 0) {
      const chg = (fcfNow - fcfYear) / Math.abs(fcfYear);
      if (Math.abs(chg) >= 0.1) {
        out.push(
          `Trailing free cash flow ${chg > 0 ? "rose" : "fell"} ${delta(chg)} to ${money(fcfNow, cur)}`
        );
      }
    }
  }

  // Earnings growing far off the pace of revenue is worth naming explicitly.
  if (netYoy != null && revYoy != null && netYoy < -0.05 && revYoy > 0.05) {
    out.push(
      `Net income fell ${delta(netYoy)} despite revenue growth, so the pressure is below the top line`
    );
  }

  if (out.length === 0) {
    return "There isn't enough comparable quarterly history yet to describe momentum.";
  }
  return paragraph(out);
}

// --- paragraph 3: balance sheet, capital allocation, what to watch ----------

function catalystsParagraph(fin: CompanyFinancials, insights: Insights): string {
  const q = fin.quarterly;
  const cur = fin.currency;
  const out: string[] = [];

  const cash = (at(q, "cash") ?? 0) + (at(q, "stInvestments") ?? 0);
  const debt = (at(q, "ltDebt") ?? 0) + (at(q, "stDebt") ?? 0);
  const hasBalance = at(q, "cash") != null || at(q, "ltDebt") != null;

  // Net cash or net debt, sized against the company's own cash generation.
  //
  // Both phrasings name the inputs explicitly. "Net debt" against cash and
  // short-term investments alone overstates leverage for filers that park large
  // sums in long-term marketable securities, which this line set doesn't
  // capture — Apple being the obvious case.
  if (hasBalance) {
    const netCash = cash - debt;
    const ocf = ttm(q, "ocf");
    if (netCash > 0) {
      out.push(
        `The balance sheet carries ${money(netCash, cur)} more cash and short-term investments than total debt`
      );
    } else if (netCash < 0) {
      const years = ocf != null && ocf > 0 ? Math.abs(netCash) / ocf : null;
      out.push(
        `Against cash and short-term investments alone, net debt is ${money(
          Math.abs(netCash),
          cur
        )}${years != null ? `, ${coverage(years)} of operating cash flow` : ""}`
      );
    }
  }

  // Capital returns measured against what the business actually generates.
  const buybacks = Math.abs(ttm(q, "buybacks") ?? 0);
  const dividends = Math.abs(ttm(q, "dividends") ?? 0);
  const returned = buybacks + dividends;
  const fcf = ttm(q, "fcf");
  if (returned > 0 && fcf != null && fcf > 0) {
    const payout = returned / fcf;
    const mix: string[] = [];
    if (buybacks > 0) mix.push(`${money(buybacks, cur)} of buybacks`);
    if (dividends > 0) mix.push(`${money(dividends, cur)} of dividends`);
    let clause = `Over the past year the company returned ${sentence(mix)}`;
    if (payout > 1.15) {
      clause += `, more than the ${money(fcf, cur)} of free cash flow it generated, so the difference came from the balance sheet`;
    } else {
      clause += `, ${pct(payout, 0)} of free cash flow`;
    }
    out.push(clause);
  }

  // Share count is the part of capital allocation an owner actually feels.
  const shareYoy = latestYoy(q, "sharesDiluted");
  if (shareYoy != null && Math.abs(shareYoy) >= 0.01) {
    out.push(
      shareYoy < 0
        ? `The diluted share count is down ${delta(shareYoy)} year over year, so per-share figures get a tailwind from shrinking supply`
        : `The diluted share count is up ${delta(shareYoy)} year over year, diluting existing holders`
    );
  }

  // Working-capital warning signs, which usually lead the income statement.
  const invYoy = latestYoy(q, "inventory");
  const revYoy = latestYoy(q, "revenue");
  if (invYoy != null && revYoy != null && invYoy > revYoy + 0.15 && invYoy > 0.1) {
    out.push(
      `Inventory is growing ${delta(invYoy)} against revenue growth of ${delta(revYoy)}, a gap that often shows up in margins a quarter or two later`
    );
  }
  const arYoy = latestYoy(q, "receivables");
  if (arYoy != null && revYoy != null && arYoy > revYoy + 0.15 && arYoy > 0.1) {
    out.push(
      `Receivables are growing ${delta(arYoy)} against ${delta(revYoy)} revenue growth, worth watching as a collection or channel signal`
    );
  }

  // Fall back to the computed signal buckets if nothing structural fired, so
  // the paragraph is never empty for a company with thin disclosure.
  if (out.length === 0) {
    const first = insights.catalysts[0] ?? insights.slowing[0] ?? insights.growing[0];
    if (first) return `${first.text}.`;
    return "Not enough balance sheet and cash flow history yet to flag what to watch.";
  }
  return paragraph(out);
}

/**
 * Build the narrative. Pure, synchronous, and free — no network, no API key.
 */
export function buildNarrative(
  fin: CompanyFinancials,
  insights: Insights,
  ctx: MarketContext = {}
): Narrative {
  return {
    business: businessParagraph(fin, ctx),
    momentum: momentumParagraph(fin),
    catalysts: catalystsParagraph(fin, insights),
  };
}
