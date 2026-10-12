// Company catalysts: SEC filing events plus the market calendar.
//
// Pure builders. No network. Labels come from 8-K item codes, 6-K document
// titles, and Yahoo's calendar. Nothing here invents a product launch or a rumor.

import { documentUrl } from "./filings";

export type CatalystKind =
  | "Earnings"
  | "Deal"
  | "Agreement"
  | "Leadership"
  | "Presentation"
  | "Meeting"
  | "Accounting"
  | "Financing"
  | "Offering"
  | "Impairment"
  | "Restructuring"
  | "Listing"
  | "Control"
  | "Dividend"
  | "Governance"
  | "Bankruptcy"
  | "Other";

export interface Catalyst {
  id: string;
  when: "upcoming" | "recent";
  /** ISO date, YYYY-MM-DD. */
  date: string;
  kind: CatalystKind;
  title: string;
  detail: string | null;
  form: string | null;
  url: string | null;
}

export interface CatalystsPayload {
  cik: string;
  ticker: string;
  events: Catalyst[];
  notes: string[];
  /** Nasdaq settlement print. Null when the quote page has no row. */
  shortInterest?: ShortInterestPrint | null;
}

/** Latest Nasdaq short-interest settlement, plus the prior print when present. */
export interface ShortInterestPrint {
  /** Display date, e.g. "Sep 30, 2026". */
  settlementDate: string;
  priorSettlementDate: string | null;
  shares: number;
  /** (latest − prior) / prior. Null when the prior print is missing. */
  changePct: number | null;
  daysToCover: number | null;
}

/** Earnings and dividend dates from the market calendar. Null fields mean unknown. */
export interface MarketCalendar {
  earningsStart: string | null;
  earningsEnd: string | null;
  /** True when the calendar itself marks the earnings date as an estimate. */
  earningsEstimated: boolean;
  exDividend: string | null;
  dividendPay: string | null;
}

export interface CatalystSourceFiling {
  form: string;
  filingDate: string;
  accession: string;
  primaryDocument: string;
  items: string;
  description: string;
}

const WINDOW_DAYS = 450;
const RECENT_MAX = 10;
const UPCOMING_MAX = 4;
const EARNINGS_PAST_DAYS = 2;
const EARNINGS_AHEAD_DAYS = 200;
const EXDIV_PAST_DAYS = 1;
const EXDIV_AHEAD_DAYS = 180;

const NOTES = [
  "Company events are SEC filings and the market calendar. A presentation shows up when the company files it, not as a rumor.",
  "An earnings date marked as an estimate is not a company confirmation.",
];

interface ItemMeta {
  kind: CatalystKind;
  title: string;
  rank: number;
}

const ITEMS: Record<string, ItemMeta> = {
  "1.01": { kind: "Agreement", title: "Material agreement", rank: 2 },
  "1.02": { kind: "Agreement", title: "Agreement terminated", rank: 2 },
  "1.03": { kind: "Bankruptcy", title: "Bankruptcy or receivership", rank: 1 },
  "1.05": { kind: "Other", title: "Material cybersecurity incident", rank: 2 },
  "2.01": { kind: "Deal", title: "Acquisition or disposition completed", rank: 1 },
  "2.02": { kind: "Earnings", title: "Results of operations", rank: 0 },
  "2.03": { kind: "Financing", title: "New debt obligation", rank: 7 },
  "2.04": { kind: "Financing", title: "Debt acceleration", rank: 7 },
  "2.05": { kind: "Restructuring", title: "Exit or restructuring costs", rank: 10 },
  "2.06": { kind: "Impairment", title: "Material impairment", rank: 9 },
  "3.01": { kind: "Listing", title: "Listing notice", rank: 11 },
  "3.02": { kind: "Offering", title: "Unregistered sale of securities", rank: 8 },
  "3.03": { kind: "Governance", title: "Rights of security holders changed", rank: 14 },
  "4.01": { kind: "Accounting", title: "Auditor change", rank: 6 },
  "4.02": { kind: "Accounting", title: "Non-reliance on prior financials", rank: 6 },
  "5.01": { kind: "Control", title: "Change in control", rank: 12 },
  "5.02": { kind: "Leadership", title: "Officer or director change", rank: 3 },
  "5.03": { kind: "Governance", title: "Charter or bylaw change", rank: 14 },
  "5.07": { kind: "Governance", title: "Shareholder vote", rank: 14 },
  "5.08": { kind: "Meeting", title: "Shareholder meeting", rank: 5 },
  "7.01": { kind: "Presentation", title: "Regulation FD disclosure", rank: 4 },
  "8.01": { kind: "Other", title: "Other events", rank: 20 },
};

/** Per-kind caps. Kinds not listed keep two. Schedule 13D is capped on its own. */
const KIND_CAP: Partial<Record<CatalystKind, number>> = {
  Earnings: 3,
  Deal: 3,
  Presentation: 3,
  Leadership: 2,
  Other: 2,
  Offering: 2,
  Agreement: 2,
};

interface Draft extends Catalyst {
  rank: number;
  capKey: string;
}

function isoDay(value: string | null | undefined): string | null {
  if (!value) return null;
  const day = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null;
}

function dayOffset(day: string, today: string): number {
  const a = Date.parse(`${day}T00:00:00Z`);
  const b = Date.parse(`${today}T00:00:00Z`);
  return Math.round((a - b) / 86_400_000);
}

export function prettyDay(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function clip(text: string): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= 140) return t;
  return `${t.slice(0, 139).trimEnd()}…`;
}

function uselessBlurb(text: string): boolean {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length < 8 || /^(6-k|form 6-k|6k|8-k|form 8-k)$/i.test(t);
}

/** Classify a 6-K (or similar) title. Untitled reports stay "Current report". */
export function classifyBlurb(description: string): ItemMeta {
  const raw = description.replace(/\s+/g, " ").trim();
  if (uselessBlurb(raw)) {
    return { kind: "Other", title: "Current report", rank: 20 };
  }
  const title = clip(raw);
  const d = raw.toLowerCase();
  if (/presentation|slides|investor day|conference|webcast|transcript/.test(d)) {
    return { kind: "Presentation", title, rank: 4 };
  }
  if (/earnings|results of operations|financial results|guidance|outlook/.test(d)) {
    return { kind: "Earnings", title, rank: 0 };
  }
  if (/acqui|merger|tender offer/.test(d)) {
    return { kind: "Deal", title, rank: 1 };
  }
  if (/dividend/.test(d)) return { kind: "Dividend", title, rank: 13 };
  if (/appoint|resign|chief executive|\bceo\b|\bcfo\b|director/.test(d)) {
    return { kind: "Leadership", title, rank: 3 };
  }
  return { kind: "Other", title, rank: 20 };
}

function itemCodes(items: string): string[] {
  const found = items.match(/\d\.\d{2}/g) ?? [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const code of found) {
    if (code === "9.01" || seen.has(code) || !ITEMS[code]) continue;
    seen.add(code);
    out.push(code);
  }
  return out;
}

function baseForm(form: string): string {
  return form.trim().toUpperCase().replace(/\/A$/, "");
}

function draftFromFiling(cik: string, filing: CatalystSourceFiling, today: string): Draft | null {
  const date = isoDay(filing.filingDate);
  if (!date) return null;
  const offset = dayOffset(date, today);
  if (offset > 1 || offset < -WINDOW_DAYS) return null;

  const form = filing.form.trim();
  const base = baseForm(form);
  const amendment = /\/A$/i.test(form.trim());
  if (!filing.accession) return null;

  let meta: ItemMeta | null = null;
  let capKey = "";
  let extra = "";

  if (base === "8-K" || base.startsWith("8-K")) {
    const codes = itemCodes(filing.items);
    if (!codes.length) return null;
    const ranked = [...codes].sort((a, b) => ITEMS[a].rank - ITEMS[b].rank);
    const primary = ranked[0];
    meta = ITEMS[primary];
    capKey = meta.kind;
    const rest = ranked.slice(1).map((code) => ITEMS[code].title);
    extra = rest.join("; ");
    if (meta.kind === "Other" && !uselessBlurb(filing.description)) {
      meta = { ...meta, title: clip(filing.description) };
    }
  } else if (base === "6-K") {
    meta = classifyBlurb(filing.description);
    capKey = meta.kind;
  } else if (base === "DEF 14A" || base === "DEF 14C") {
    meta = { kind: "Meeting", title: "Annual meeting proxy", rank: 5 };
    capKey = "Meeting";
  } else if (base === "DEFM14A") {
    meta = { kind: "Deal", title: "Merger proxy", rank: 1 };
    capKey = "Deal";
  } else if (base === "DEFA14A") {
    const classified = classifyBlurb(filing.description);
    if (classified.kind === "Other") return null;
    meta = classified;
    capKey = meta.kind;
  } else if (base === "425" || base.startsWith("SC TO") || base === "SC 14D9") {
    meta = {
      kind: "Deal",
      title: base === "425" ? "Merger communication" : "Tender offer",
      rank: 1,
    };
    capKey = "Deal";
  } else if (base === "SC 13D") {
    meta = {
      kind: "Control",
      title: "Activist or 5% holder filing (Schedule 13D)",
      rank: 12,
    };
    capKey = "13d";
  } else if (base === "S-1" || base === "F-1") {
    meta = { kind: "Offering", title: "Registration statement", rank: 8 };
    capKey = "Offering";
  } else if (base === "S-3" || base === "F-3") {
    meta = { kind: "Offering", title: "Shelf registration", rank: 8 };
    capKey = "Offering";
  } else if (/^424B\d/.test(base)) {
    meta = { kind: "Offering", title: "Prospectus supplement", rank: 8 };
    capKey = "Offering";
  } else {
    return null;
  }

  const detailBits = [amendment ? "Amendment" : null, extra || null].filter(
    (x): x is string => !!x
  );
  return {
    id: `recent|${date}|${meta.kind}|${form}|${filing.accession}`,
    when: "recent",
    date,
    kind: meta.kind,
    title: meta.title,
    detail: detailBits.length ? detailBits.join(". ") : null,
    form,
    url: documentUrl(cik, filing.accession, filing.primaryDocument),
    rank: meta.rank,
    capKey,
  };
}

function calendarDrafts(calendar: MarketCalendar | null, today: string): Draft[] {
  if (!calendar) return [];
  const out: Draft[] = [];
  const start = isoDay(calendar.earningsStart);
  if (start) {
    const offset = dayOffset(start, today);
    if (offset >= -EARNINGS_PAST_DAYS && offset <= EARNINGS_AHEAD_DAYS) {
      const end = isoDay(calendar.earningsEnd);
      const range = end && end !== start ? `${prettyDay(start)}–${prettyDay(end)}` : null;
      const detail = calendar.earningsEstimated
        ? range
          ? `Market calendar estimate, ${range}. Not a company-confirmed date.`
          : "Market calendar estimate. Not a company-confirmed date."
        : range
          ? `Market calendar window, ${range}.`
          : "Market calendar date.";
      out.push({
        id: `upcoming|${start}|Earnings|calendar`,
        when: offset >= 0 ? "upcoming" : "recent",
        date: start,
        kind: "Earnings",
        title: range ? "Earnings window" : "Earnings",
        detail,
        form: null,
        url: null,
        rank: 0,
        capKey: "calendar-earnings",
      });
    }
  }

  const ex = isoDay(calendar.exDividend);
  if (ex) {
    const offset = dayOffset(ex, today);
    if (offset >= -EXDIV_PAST_DAYS && offset <= EXDIV_AHEAD_DAYS) {
      const pay = isoDay(calendar.dividendPay);
      out.push({
        id: `upcoming|${ex}|Dividend|calendar`,
        when: offset >= 0 ? "upcoming" : "recent",
        date: ex,
        kind: "Dividend",
        title: "Ex-dividend",
        detail: pay ? `Pay date ${prettyDay(pay)}.` : "Market calendar date.",
        form: null,
        url: null,
        rank: 13,
        capKey: "calendar-dividend",
      });
    }
  }
  return out;
}

function prefer(a: Draft, b: Draft): Draft {
  const aAmend = a.detail?.startsWith("Amendment") ? 1 : 0;
  const bAmend = b.detail?.startsWith("Amendment") ? 1 : 0;
  if (aAmend !== bAmend) return aAmend < bAmend ? a : b;
  if (a.url && !b.url) return a;
  if (b.url && !a.url) return b;
  return a.title.length >= b.title.length ? a : b;
}

function dedup(events: Draft[]): Draft[] {
  const byKey = new Map<string, Draft>();
  for (const event of events) {
    const key = `${event.date}|${event.kind}`;
    const prev = byKey.get(key);
    byKey.set(key, prev ? prefer(event, prev) : event);
  }
  return [...byKey.values()];
}

function capRecent(events: Draft[]): Draft[] {
  const counts = new Map<string, number>();
  const sorted = [...events].sort(
    (a, b) => b.date.localeCompare(a.date) || a.rank - b.rank
  );
  const out: Draft[] = [];
  for (const event of sorted) {
    const cap =
      event.capKey === "13d" ? 1 : (KIND_CAP[event.kind] ?? 2);
    const n = counts.get(event.capKey) ?? 0;
    if (n >= cap) continue;
    counts.set(event.capKey, n + 1);
    out.push(event);
    if (out.length >= RECENT_MAX) break;
  }
  return out;
}

function strip(event: Draft): Catalyst {
  return {
    id: event.id,
    when: event.when,
    date: event.date,
    kind: event.kind,
    title: event.title,
    detail: event.detail,
    form: event.form,
    url: event.url,
  };
}

export function buildCatalysts(input: {
  cik: string;
  ticker: string;
  filings: CatalystSourceFiling[];
  calendar: MarketCalendar | null;
  today: string;
}): CatalystsPayload {
  const today = isoDay(input.today) ?? input.today;
  const filed = input.filings
    .map((filing) => draftFromFiling(input.cik, filing, today))
    .filter((event): event is Draft => event != null);
  const recent = capRecent(dedup(filed));
  const occupied = new Set(recent.map((event) => `${event.date}|${event.kind}`));
  const upcoming = calendarDrafts(input.calendar, today).filter(
    (event) => !occupied.has(`${event.date}|${event.kind}`)
  );
  const upcomingKept = upcoming
    .sort((a, b) => a.date.localeCompare(b.date) || a.rank - b.rank)
    .slice(0, UPCOMING_MAX);
  const events = [...upcomingKept, ...recent].sort((a, b) => {
    if (a.when !== b.when) return a.when === "upcoming" ? -1 : 1;
    const byDate =
      a.when === "upcoming"
        ? a.date.localeCompare(b.date)
        : b.date.localeCompare(a.date);
    if (byDate !== 0) return byDate;
    return a.rank - b.rank;
  });
  return {
    cik: input.cik,
    ticker: input.ticker.toUpperCase(),
    events: events.map(strip),
    notes: NOTES,
  };
}

/**
 * Add market-calendar dates onto a filing list that was cached on its own.
 * A filing on the same day and kind wins, so a results 8-K is not doubled.
 */
export function withMarketCalendar(
  payload: CatalystsPayload,
  calendar: MarketCalendar | null,
  today: string
): CatalystsPayload {
  if (!calendar) return payload;
  const added = buildCatalysts({
    cik: payload.cik,
    ticker: payload.ticker,
    filings: [],
    calendar,
    today,
  });
  const occupied = new Set(payload.events.map((event) => `${event.date}|${event.kind}`));
  const extra = added.events.filter((event) => !occupied.has(`${event.date}|${event.kind}`));
  if (!extra.length) return payload;
  const events = [...payload.events, ...extra].sort((a, b) => {
    if (a.when !== b.when) return a.when === "upcoming" ? -1 : 1;
    return a.when === "upcoming"
      ? a.date.localeCompare(b.date)
      : b.date.localeCompare(a.date);
  });
  return { ...payload, events };
}

function yahooRawDate(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = (value as { raw?: unknown }).raw;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return new Date(raw * 1000).toISOString().slice(0, 10);
  }
  const fmt = (value as { fmt?: unknown }).fmt;
  if (typeof fmt === "string") return isoDay(fmt);
  return null;
}

function yahooDateList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((entry) => yahooRawDate(entry))
      .filter((day): day is string => !!day);
  }
  const one = yahooRawDate(value);
  return one ? [one] : [];
}

/**
 * Pull earnings and dividend dates out of a Yahoo quoteSummary body.
 * `earningsDate` may be one object or a list. Returns null when nothing dated is present.
 */
export function marketCalendarFromYahoo(payload: unknown): MarketCalendar | null {
  if (!payload || typeof payload !== "object") return null;
  const cal = (
    payload as {
      calendarEvents?: {
        earnings?: { earningsDate?: unknown; isEarningsDateEstimate?: unknown };
        exDividendDate?: unknown;
        dividendDate?: unknown;
      };
    }
  ).calendarEvents;
  if (!cal) return null;
  const dates = yahooDateList(cal.earnings?.earningsDate);
  const out: MarketCalendar = {
    earningsStart: dates[0] ?? null,
    earningsEnd: dates[dates.length - 1] ?? dates[0] ?? null,
    earningsEstimated: cal.earnings?.isEarningsDateEstimate === true,
    exDividend: yahooRawDate(cal.exDividendDate),
    dividendPay: yahooRawDate(cal.dividendDate),
  };
  if (!out.earningsStart && !out.exDividend && !out.dividendPay) return null;
  return out;
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

function formatSlashDate(raw: string): string | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw.trim());
  if (!m) return null;
  const month = MONTHS[Number(m[1]) - 1];
  if (!month) return null;
  return `${month} ${Number(m[2])}, ${m[3]}`;
}

function parseCount(raw: string | number | undefined): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  if (!raw) return null;
  const n = Number(String(raw).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** Newest Nasdaq short-interest row, with the change versus the prior settlement. */
export function parseShortInterestRows(
  rows: {
    settlementDate?: string;
    interest?: string | number;
    daysToCover?: string | number;
  }[]
): ShortInterestPrint | null {
  const latest = rows[0];
  if (!latest?.settlementDate) return null;
  const shares = parseCount(latest.interest);
  if (shares == null || shares < 0) return null;
  const prior = rows[1];
  const priorShares = prior ? parseCount(prior.interest) : null;
  const days = parseCount(latest.daysToCover);
  const settlement =
    formatSlashDate(latest.settlementDate) ?? latest.settlementDate;
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

export interface NasdaqEarningsDate {
  /** ISO day, YYYY-MM-DD. */
  date: string;
  session: string | null;
  fiscalPeriod: string | null;
  consensusEps: number | null;
  yearAgoEps: number | null;
  nAnalysts: number | null;
  /** True when Nasdaq says the date is estimated from history. */
  estimated: boolean;
}

function slashToIso(raw: string): string | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw.trim());
  if (!m) return null;
  const month = Number(m[1]);
  const day = Number(m[2]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${m[3]}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Nasdaq's public earnings-date sentence. Returns null when the prose has no date.
 */
export function parseNasdaqEarningsDate(
  data: { reportText?: string | null; announcement?: string | null } | null
): NasdaqEarningsDate | null {
  const text = data?.reportText?.replace(/\s+/g, " ").trim() ?? "";
  if (!text) return null;
  const dated =
    /(?:expected\*?|estimated) to report earnings on\s+(\d{1,2}\/\d{1,2}\/\d{4})(?:\s+(before market open|after market close|during market hours))?/i.exec(
      text
    );
  const date = dated?.[1] ? slashToIso(dated[1]) : null;
  if (!date) return null;
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
  const consensus =
    /consensus EPS forecast for the quarter is\s+\$([0-9]+(?:\.[0-9]+)?)/i.exec(text);
  const yearAgo = /same quarter last year was\s+\$([0-9]+(?:\.[0-9]+)?)/i.exec(text);
  return {
    date,
    session,
    fiscalPeriod: fiscal?.[1] ?? null,
    consensusEps: consensus ? Number(consensus[1]) : null,
    yearAgoEps: yearAgo ? Number(yearAgo[1]) : null,
    nAnalysts: analysts ? Number(analysts[1]) : null,
    estimated: /estimated to report/i.test(text),
  };
}

/** Upcoming earnings row from Nasdaq when the market calendar did not supply one. */
export function nasdaqEarningsCatalyst(
  row: NasdaqEarningsDate,
  today: string
): Catalyst | null {
  const offset = dayOffset(row.date, today);
  if (offset < -EARNINGS_PAST_DAYS || offset > EARNINGS_AHEAD_DAYS) return null;
  const bits: string[] = [];
  if (row.session) bits.push(row.session[0]!.toUpperCase() + row.session.slice(1));
  if (row.fiscalPeriod) bits.push(`${row.fiscalPeriod} quarter`);
  if (row.consensusEps != null) {
    const vs =
      row.yearAgoEps != null ? ` versus $${row.yearAgoEps.toFixed(2)} a year ago` : "";
    bits.push(`Consensus EPS $${row.consensusEps.toFixed(2)}${vs}`);
  }
  if (row.nAnalysts != null) bits.push(`${row.nAnalysts} analysts`);
  if (row.estimated) bits.push("Nasdaq marks the date as an estimate");
  return {
    id: `upcoming|${row.date}|Earnings|nasdaq`,
    when: offset >= 0 ? "upcoming" : "recent",
    date: row.date,
    kind: "Earnings",
    title: "Earnings",
    detail: bits.length ? `${bits.join(". ")}.` : "Nasdaq earnings date.",
    form: null,
    url: null,
  };
}

/** Calendar day in New York, YYYY-MM-DD. */
export function todayInNewYork(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
