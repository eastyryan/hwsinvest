// Company-specific events for the overview: next earnings, recent 8-Ks,
// and the latest Nasdaq short-interest print. Parsers are pure. The network
// lives in catalysts-server.ts.

import type { Insight } from "./insights";

export interface EarningsEvent {
  /** Display date, e.g. "Nov 2, 2026". */
  dateLabel: string;
  /** "after the close" / "before the open", when the text says so. */
  session: string | null;
  /** e.g. "Sep 2026". */
  fiscalPeriod: string | null;
  consensusEps: number | null;
  yearAgoEps: number | null;
  nAnalysts: number | null;
  /** True when Nasdaq says the date is estimated from history, not announced. */
  estimated: boolean;
}

export interface EightKEvent {
  filingDate: string;
  /** Human labels, 9.01 dropped when a real item is present. */
  labels: string[];
  /** SEC primary-document URL. */
  href: string;
  tone: Insight["tone"];
}

export interface ShortInterestPrint {
  settlementDate: string;
  priorSettlementDate: string | null;
  shares: number;
  /** (latest − prior) / prior. Null when the prior print is missing. */
  changePct: number | null;
  daysToCover: number | null;
}

export interface CompanyCatalysts {
  ticker: string;
  earnings: EarningsEvent | null;
  filings: EightKEvent[];
  shortInterest: ShortInterestPrint | null;
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** 8-K item numbers worth naming. 9.01 is exhibits and is kept only alone. */
const ITEM_LABELS: Record<string, string> = {
  "1.01": "Material agreement",
  "1.02": "Agreement terminated",
  "1.03": "Bankruptcy or receivership",
  "2.01": "Acquisition or sale of assets",
  "2.02": "Earnings",
  "2.03": "New debt",
  "2.04": "Debt acceleration",
  "2.05": "Exit or disposal costs",
  "2.06": "Impairment",
  "3.01": "Delisting notice",
  "3.02": "Unregistered share sale",
  "3.03": "Change in security holder rights",
  "4.01": "Auditor change",
  "4.02": "Non-reliance on prior financials",
  "5.01": "Change in control",
  "5.02": "Director or officer change",
  "5.03": "Charter or bylaw change",
  "5.07": "Shareholder vote",
  "7.01": "Regulation FD disclosure",
  "8.01": "Other event",
  "9.01": "Financial statements and exhibits",
};

const NEGATIVE_ITEMS = new Set(["1.03", "2.06", "3.01", "4.02", "5.01"]);

export function formatIsoDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const month = MONTHS[Number(m[2]) - 1];
  if (!month) return iso;
  return `${month} ${Number(m[3])}, ${m[1]}`;
}

function formatSlashDate(raw: string): string | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw.trim());
  if (!m) return null;
  const month = MONTHS[Number(m[1]) - 1];
  if (!month) return null;
  return `${month} ${Number(m[2])}, ${m[3]}`;
}

function numMoney(raw: string | undefined): number | null {
  if (!raw) return null;
  const n = Number(raw.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

/**
 * Nasdaq analyst earnings-date payload. The useful fields are prose, so this
 * pulls the date, session, and consensus out of that sentence.
 */
export function parseEarningsDate(data: {
  reportText?: string | null;
  announcement?: string | null;
} | null): EarningsEvent | null {
  const text = data?.reportText?.replace(/\s+/g, " ").trim() ?? "";
  const announcement = data?.announcement?.replace(/\s+/g, " ").trim() ?? "";
  if (!text && !announcement) return null;

  const dated =
    /(?:expected\*|estimated) to report earnings on\s+(\d{1,2}\/\d{1,2}\/\d{4})(?:\s+(before market open|after market close|during market hours))?/i.exec(
      text
    );
  const fromAnnouncement = /:\s*([A-Za-z]{3,9}\s+\d{1,2},\s+\d{4})/.exec(
    announcement
  );
  const slash = dated?.[1] ? formatSlashDate(dated[1]) : null;
  const dateLabel = slash ?? fromAnnouncement?.[1] ?? null;
  if (!dateLabel) return null;

  const sessionRaw = dated?.[2]?.toLowerCase() ?? "";
  const session = sessionRaw.includes("after")
    ? "after the close"
    : sessionRaw.includes("before")
      ? "before the open"
      : sessionRaw.includes("during")
        ? "during the session"
        : null;

  const fiscal = /fiscal Quarter ending\s+([A-Za-z]{3,9}\s+\d{4})/i.exec(text);
  const analysts = /based on\s+(\d+)\s+analyst/i.exec(text);
  const consensus = /consensus EPS forecast for the quarter is\s+\$([0-9]+(?:\.[0-9]+)?)/i.exec(
    text
  );
  const yearAgo = /same quarter last year was\s+\$([0-9]+(?:\.[0-9]+)?)/i.exec(
    text
  );

  return {
    dateLabel,
    session,
    fiscalPeriod: fiscal?.[1] ?? null,
    consensusEps: numMoney(consensus?.[1]),
    yearAgoEps: numMoney(yearAgo?.[1]),
    nAnalysts: analysts ? Number(analysts[1]) : null,
    estimated: /estimated to report/i.test(text),
  };
}

export function labelsFor8KItems(items: string): string[] {
  const codes = items
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const named = codes.filter((c) => c !== "9.01" && ITEM_LABELS[c]);
  const use = named.length > 0 ? named : codes.filter((c) => ITEM_LABELS[c]);
  const labels: string[] = [];
  for (const code of use) {
    const label = ITEM_LABELS[code];
    if (label && !labels.includes(label)) labels.push(label);
  }
  return labels;
}

export function toneFor8KItems(items: string): Insight["tone"] {
  const codes = items.split(",").map((s) => s.trim());
  if (codes.some((c) => NEGATIVE_ITEMS.has(c))) return "negative";
  return "neutral";
}

export function parseShortInterestRows(
  rows: {
    settlementDate?: string;
    interest?: string | number;
    daysToCover?: string | number;
  }[]
): ShortInterestPrint | null {
  const latest = rows[0];
  if (!latest?.settlementDate) return null;
  const shares =
    typeof latest.interest === "number"
      ? latest.interest
      : numMoney(String(latest.interest ?? ""));
  if (shares == null || shares < 0) return null;
  const prior = rows[1];
  const priorShares = prior
    ? typeof prior.interest === "number"
      ? prior.interest
      : numMoney(String(prior.interest ?? ""))
    : null;
  const daysRaw = latest.daysToCover;
  const days =
    typeof daysRaw === "number"
      ? daysRaw
      : daysRaw != null
        ? Number(daysRaw)
        : null;
  const settlement = formatSlashDate(latest.settlementDate) ?? latest.settlementDate;
  const priorDate = prior?.settlementDate
    ? formatSlashDate(prior.settlementDate) ?? prior.settlementDate
    : null;
  return {
    settlementDate: settlement,
    priorSettlementDate: priorShares != null ? priorDate : null,
    shares,
    changePct:
      priorShares != null && priorShares > 0
        ? (shares - priorShares) / priorShares
        : null,
    daysToCover: days != null && Number.isFinite(days) ? days : null,
  };
}

function fmtShares(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  return Math.round(n).toLocaleString("en-US");
}

function fmtEps(n: number): string {
  return "$" + n.toFixed(2);
}

function fmtPctChange(p: number): string {
  const pts = Math.abs(p * 100);
  const digits = pts >= 10 ? 0 : 1;
  return `${p > 0 ? "up" : "down"} ${pts.toFixed(digits)}%`;
}

/** Lines for the Catalysts column. Empty when nothing company-specific came back. */
export function catalystsToInsights(c: CompanyCatalysts): Insight[] {
  const out: Insight[] = [];
  const ticker = c.ticker.toLowerCase();

  if (c.earnings) {
    const e = c.earnings;
    const when = [e.dateLabel, e.session].filter(Boolean).join(" ");
    const bits: string[] = [];
    if (e.fiscalPeriod) bits.push(`${e.fiscalPeriod} quarter`);
    if (e.consensusEps != null) {
      bits.push(
        e.yearAgoEps != null
          ? `consensus EPS ${fmtEps(e.consensusEps)} vs ${fmtEps(e.yearAgoEps)} a year ago`
          : `consensus EPS ${fmtEps(e.consensusEps)}`
      );
    }
    if (e.nAnalysts != null) bits.push(`${e.nAnalysts} analysts`);
    bits.push(
      e.estimated
        ? "Date is estimated from past reporting, not a company announcement. Nasdaq / Zacks."
        : "Nasdaq / Zacks."
    );
    out.push({
      text: e.estimated
        ? `Earnings estimated ${when}`
        : `Earnings ${when}`,
      detail: bits.join(" · "),
      tone: "neutral",
      href: `https://www.nasdaq.com/market-activity/stocks/${ticker}/earnings`,
    });
  }

  for (const f of c.filings) {
    const title = f.labels.length ? f.labels.join(", ") : "8-K";
    out.push({
      text: `${formatIsoDate(f.filingDate)} · ${title}`,
      detail: "SEC Form 8-K",
      tone: f.tone,
      href: f.href,
    });
  }

  if (c.shortInterest) {
    const s = c.shortInterest;
    const cover =
      s.daysToCover != null ? `${s.daysToCover.toFixed(1)} days to cover` : null;
    const move =
      s.changePct != null && s.priorSettlementDate
        ? `${fmtPctChange(s.changePct)} vs ${s.priorSettlementDate}`
        : null;
    out.push({
      text: `Short interest ${fmtShares(s.shares)} shares${cover ? `, ${cover}` : ""}`,
      detail: [move, `Settlement ${s.settlementDate}`, "Nasdaq"]
        .filter(Boolean)
        .join(" · "),
      tone:
        s.changePct == null || Math.abs(s.changePct) < 0.05
          ? "neutral"
          : s.changePct > 0
            ? "negative"
            : "positive",
      href: `https://www.nasdaq.com/market-activity/stocks/${ticker}/short-interest`,
    });
  }

  return out;
}
