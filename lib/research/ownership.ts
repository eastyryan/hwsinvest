// Ownership activity: corporate insiders (Form 4), institutional beneficial
// owners (Schedule 13G/D), and US political / STOCK Act disclosures.
//
// No paid APIs. SEC EDGAR is the source of truth for Form 4 and 13G/D.
// Politician trades come from the open congress-trading-monitor dataset
// (STOCK Act PTRs scraped from official House/Senate/OGE portals).

import { fetchJson, fetchText, singleFlight } from "./http";
import { cached } from "./cache";
import { isValidCik, isValidTicker } from "./validate";

const UA = "FinanceExplorer/1.0 (easton.ryan@hws.edu)";

/** Cold / first paint: enough Form 4s to be useful without a long SEC walk. */
const FORM4_LIMIT_QUICK = 0; // quick mode skips Form 4 entirely
const FORM4_LIMIT_DEFAULT = 28;
/** Warm / deep: more history once the page is already interactive. */
const FORM4_LIMIT_DEEP = 56;
const INSTITUTIONAL_LIMIT = 14;
const POLITICIAN_TRADE_LIMIT = 80;
/** Report every institutional holder at or above this % of shares outstanding. */
const MIN_SHAREHOLDER_PCT = 1;
const NASDAQ_PAGE_SIZE = 100;
const NASDAQ_MAX_PAGES = 3;

const CONGRESS_TICKER_URL =
  "https://raw.githubusercontent.com/kadoa-org/congress-trading-monitor/main/public/data/ticker";

// --- Public types -----------------------------------------------------------

export type Side = "buy" | "sell" | "other";

export interface PersonShareChange {
  name: string;
  role: string | null;
  /** Latest known share holding (when reported). */
  sharesHeld: number | null;
  /** Latest holding as % of shares outstanding, if both are known. */
  pctOfShares: number | null;
  /** Net shares acquired − disposed over the trailing ~90 days. */
  netSharesQoQ: number | null;
  /** Net shares acquired − disposed over the trailing ~365 days. */
  netSharesYoY: number | null;
  /**
   * QoQ net as a percentage of shares outstanding (positive = buying).
   * Null when shares outstanding or period activity is unknown.
   */
  pctChangeQoQ: number | null;
  /** YoY net as a percentage of shares outstanding. */
  pctChangeYoY: number | null;
  tradeCount: number;
}

export interface InsiderTrade {
  date: string;
  filingDate: string;
  name: string;
  role: string | null;
  transactionCode: string;
  codeLabel: string;
  side: Side;
  shares: number | null;
  price: number | null;
  value: number | null;
  sharesAfter: number | null;
  security: string | null;
  accession: string;
  filingUrl: string;
}

export interface InstitutionalHolding {
  name: string;
  form: string;
  filingDate: string;
  eventDate: string | null;
  shares: number | null;
  /** Percent of class from the filing (already a percentage, e.g. 7.48). */
  pctOfClass: number | null;
  /** Change in pct-of-class vs this filer's previous filing in our sample. */
  pctChangeFromPrior: number | null;
  sharesChangeFromPrior: number | null;
  accession: string;
  filingUrl: string;
}

export interface PoliticianTrade {
  date: string;
  filingDate: string | null;
  name: string;
  chamber: string | null;
  party: string | null;
  state: string | null;
  side: Side;
  transactionType: string;
  amountLabel: string | null;
  amountMid: number | null;
  owner: string | null;
  docUrl: string | null;
}

export type OwnershipMode = "quick" | "full" | "deep";

export interface OwnershipPayload {
  cik: string;
  ticker: string;
  sharesOutstanding: number | null;
  asOf: string;
  /** Which load path produced this payload. */
  mode: OwnershipMode;
  /** True when Form 4s were skipped and a full/deep load will enrich insiders. */
  insidersPending: boolean;
  insiders: {
    trades: InsiderTrade[];
    people: PersonShareChange[];
    summary: {
      buys: number;
      sells: number;
      other: number;
      netShares90d: number | null;
      netShares365d: number | null;
      pctChange90d: number | null;
      pctChange365d: number | null;
    };
  };
  institutions: {
    /** Holders at or above 1% of shares outstanding (13F / institutional data). */
    holdings: InstitutionalHolding[];
    /** Schedule 13G/D beneficial-ownership filings (typically ≥5%). */
    filings13g: InstitutionalHolding[];
    people: PersonShareChange[];
    summary: {
      filerCount: number;
      /** Sum of ≥1% holders' stakes — can double-count related entities. */
      latestTotalPct: number | null;
      /** Reported total institutional ownership of the free float, when known. */
      totalInstitutionalPct: number | null;
      thresholdPct: number;
    };
  };
  politicians: {
    trades: PoliticianTrade[];
    people: PersonShareChange[];
    summary: {
      buys: number;
      sells: number;
      other: number;
      netAmountMid90d: number | null;
      netAmountMid365d: number | null;
    };
  };
  sources: string[];
  notes: string[];
}

// --- Form 4 transaction codes -----------------------------------------------

const CODE_LABELS: Record<string, string> = {
  P: "Open-market purchase",
  S: "Open-market sale",
  A: "Grant / award",
  D: "Disposition to issuer",
  F: "Tax withholding",
  M: "Exercise / conversion",
  C: "Conversion",
  G: "Gift",
  V: "Voluntary report",
  J: "Other",
  K: "Equity swap",
  U: "Tender of shares",
  X: "Exercise of ITM derivative",
  Z: "Deposit into/withdrawal from voting trust",
  I: "Discretionary transaction",
  L: "Small acquisition",
  W: "Will / inheritance",
  H: "Expiration of short derivative",
  O: "Exercise of OTM derivative",
};

function codeSide(code: string, acquiredDisposed: string | null): Side {
  const c = code.toUpperCase();
  if (c === "P" || c === "L") return "buy";
  if (c === "S" || c === "U") return "sell";
  // A/D codes still matter for grants, tax, etc.
  if (acquiredDisposed === "A" && (c === "A" || c === "M" || c === "C" || c === "X")) {
    return "buy";
  }
  if (acquiredDisposed === "D" && (c === "F" || c === "D" || c === "G")) {
    return "sell";
  }
  if (acquiredDisposed === "A") return "buy";
  if (acquiredDisposed === "D") return "sell";
  return "other";
}

// --- Small XML helpers (no dependency) --------------------------------------

function xmlTag(xml: string, tag: string): string | null {
  // Prefer <tag><value>...</value></tag>, then bare <tag>...</tag>.
  const nested = new RegExp(
    `<${tag}[^>]*>\\s*<value[^>]*>([\\s\\S]*?)<\\/value>`,
    "i"
  );
  const m1 = xml.match(nested);
  if (m1) return decodeXml(m1[1].trim());
  const bare = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const m2 = xml.match(bare);
  if (!m2) return null;
  const inner = m2[1].replace(/<[^>]+>/g, "").trim();
  return inner ? decodeXml(inner) : null;
}

function xmlAllBlocks(xml: string, tag: string): string[] {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi");
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) out.push(m[1]);
  return out;
}

function decodeXml(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

function numOrNull(s: string | null | undefined): number | null {
  if (s == null || s === "") return null;
  const n = Number(String(s).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

function daysAgo(iso: string, days: number): boolean {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return false;
  return Date.now() - t <= days * 86_400_000;
}

function accessionPath(accession: string): string {
  return accession.replace(/-/g, "");
}

/** Filer CIK is the first segment of the accession number (before the first dash). */
function filerCikFromAccession(accession: string): string {
  return String(Number(accession.split("-")[0]));
}

function filingUrl(filerCik: string, accession: string, primaryDocument: string): string {
  const acc = accessionPath(accession);
  // Strip xsl* display wrappers — we want the raw document when linking.
  const doc = primaryDocument.replace(/^xsl[^/]+\//, "");
  return `https://www.sec.gov/Archives/edgar/data/${filerCik}/${acc}/${doc}`;
}

// --- Submissions index ------------------------------------------------------

interface FilingRef {
  form: string;
  accession: string;
  filingDate: string;
  reportDate: string;
  primaryDocument: string;
  filerCik: string;
}

interface SubmissionsRecent {
  accessionNumber: string[];
  filingDate: string[];
  reportDate: string[];
  form: string[];
  primaryDocument: string[];
}

async function getSubmissionsRecent(cik: string): Promise<SubmissionsRecent | null> {
  const padded = cik.padStart(10, "0");
  const d = await fetchJson<{ filings?: { recent?: SubmissionsRecent } }>(
    `https://data.sec.gov/submissions/CIK${padded}.json`,
    {
      source: "SEC EDGAR",
      headers: { "User-Agent": UA },
      rateLimit: "sec",
      nullOn: [404],
      timeoutMs: 15_000,
    }
  );
  return d?.filings?.recent ?? null;
}

function listFilings(
  recent: SubmissionsRecent,
  match: (form: string) => boolean,
  limit: number
): FilingRef[] {
  const out: FilingRef[] = [];
  for (let i = 0; i < recent.form.length && out.length < limit; i++) {
    const form = recent.form[i];
    if (!match(form)) continue;
    const accession = recent.accessionNumber[i];
    out.push({
      form,
      accession,
      filingDate: recent.filingDate[i],
      reportDate: recent.reportDate[i] || recent.filingDate[i],
      primaryDocument: recent.primaryDocument[i] || "",
      filerCik: filerCikFromAccession(accession),
    });
  }
  return out;
}

// --- Form 4 -----------------------------------------------------------------

function parseForm4Xml(
  xml: string,
  ref: FilingRef
): { trades: InsiderTrade[]; ownerName: string; role: string | null } {
  const ownerName =
    xmlTag(xml, "rptOwnerName") || xmlTag(xml, "reportingOwnerName") || "Unknown";
  const isDirector = /<isDirector>\s*true\s*<\/isDirector>/i.test(xml);
  const isOfficer = /<isOfficer>\s*true\s*<\/isOfficer>/i.test(xml);
  const isTenPercent = /<isTenPercentOwner>\s*true\s*<\/isTenPercentOwner>/i.test(xml);
  const title = xmlTag(xml, "officerTitle");
  const roleParts: string[] = [];
  if (title) roleParts.push(title);
  else if (isOfficer) roleParts.push("Officer");
  if (isDirector) roleParts.push("Director");
  if (isTenPercent) roleParts.push("10% owner");
  const role = roleParts.length ? roleParts.join(" · ") : null;

  // Only the non-derivative table moves common-stock share counts. Derivative
  // rows (RSU vest code M, option exercises, etc.) report the derivative
  // security itself and would double-count or invert the common-stock net.
  const blocks = xmlAllBlocks(xml, "nonDerivativeTransaction");

  const trades: InsiderTrade[] = [];
  for (const block of blocks) {
    const code = (xmlTag(block, "transactionCode") || "").toUpperCase();
    if (!code) continue;
    const ad = xmlTag(block, "transactionAcquiredDisposedCode");
    const shares = numOrNull(xmlTag(block, "transactionShares"));
    const price = numOrNull(xmlTag(block, "transactionPricePerShare"));
    const sharesAfter = numOrNull(xmlTag(block, "sharesOwnedFollowingTransaction"));
    const date = xmlTag(block, "transactionDate") || ref.reportDate;
    const security = xmlTag(block, "securityTitle");
    const side = codeSide(code, ad);
    const value =
      shares != null && price != null && Number.isFinite(shares * price)
        ? shares * price
        : null;

    trades.push({
      date,
      filingDate: ref.filingDate,
      name: ownerName,
      role,
      transactionCode: code,
      codeLabel: CODE_LABELS[code] || code,
      side,
      shares,
      price,
      value,
      sharesAfter,
      security,
      accession: ref.accession,
      filingUrl: filingUrl(ref.filerCik, ref.accession, ref.primaryDocument || "form4.xml"),
    });
  }

  return { trades, ownerName, role };
}

async function fetchForm4Xml(issuerCik: string, ref: FilingRef): Promise<string | null> {
  const acc = accessionPath(ref.accession);
  // Form 4s listed on the issuer's submissions live under the *issuer* CIK path,
  // even when the accession number starts with a filing-agent CIK.
  const pathCik = String(Number(issuerCik));
  const base = (ref.primaryDocument || "form4.xml").split("/").pop() || "form4.xml";
  const names = Array.from(
    new Set([base.endsWith(".xml") ? base : "form4.xml", "form4.xml", "wk-form4.xml", "primary_doc.xml"])
  );
  for (const name of names) {
    const url = `https://www.sec.gov/Archives/edgar/data/${pathCik}/${acc}/${name}`;
    try {
      const text = await fetchText(url, {
        source: "SEC EDGAR",
        headers: { "User-Agent": UA },
        rateLimit: "sec",
        nullOn: [404],
        timeoutMs: 12_000,
        retries: 1,
      });
      if (text && text.includes("ownershipDocument")) return text;
    } catch {
      // try next candidate
    }
  }
  return null;
}

async function loadInsiderTrades(
  cik: string,
  recent: SubmissionsRecent,
  form4Limit: number
): Promise<InsiderTrade[]> {
  if (form4Limit <= 0) return [];
  const refs = listFilings(
    recent,
    (f) => f === "4" || f === "4/A",
    form4Limit
  );
  const pathCik = String(Number(cik));
  const trades: InsiderTrade[] = [];
  for (const ref of refs) {
    const xml = await fetchForm4Xml(cik, ref);
    if (!xml) continue;
    // Link and archive under issuer CIK for Form 4s on company submissions.
    const linkRef = { ...ref, filerCik: pathCik };
    const parsed = parseForm4Xml(xml, linkRef);
    trades.push(...parsed.trades);
  }
  trades.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return trades;
}

// --- Schedule 13G / 13D -----------------------------------------------------

function isInstitutionalForm(form: string): boolean {
  const f = form.toUpperCase().replace(/\s+/g, " ").trim();
  return (
    f === "SC 13G" ||
    f === "SC 13G/A" ||
    f === "SC 13D" ||
    f === "SC 13D/A" ||
    f === "SCHEDULE 13G" ||
    f === "SCHEDULE 13G/A" ||
    f === "SCHEDULE 13D" ||
    f === "SCHEDULE 13D/A" ||
    f.startsWith("SCHEDULE 13G") ||
    f.startsWith("SCHEDULE 13D")
  );
}

function parse13GXml(xml: string, ref: FilingRef): InstitutionalHolding | null {
  const name =
    xmlTag(xml, "reportingPersonName") ||
    xmlTag(xml, "filingPersonName") ||
    xmlTag(xml, "nameOfReportingPerson") ||
    null;
  if (!name) return null;

  const shares =
    numOrNull(xmlTag(xml, "reportingPersonBeneficiallyOwnedAggregateNumberOfShares")) ??
    numOrNull(xmlTag(xml, "amountBeneficiallyOwned")) ??
    numOrNull(xmlTag(xml, "aggregateAmountBeneficiallyOwnedByEachReportingPerson"));

  const pct =
    numOrNull(xmlTag(xml, "classPercent")) ??
    numOrNull(xmlTag(xml, "percentOfClass")) ??
    numOrNull(xmlTag(xml, "percentOfClassRepresentedByAmountInRow11"));

  const eventDate =
    xmlTag(xml, "eventDateRequiresFilingThisStatement") ||
    xmlTag(xml, "dateOfEvent") ||
    ref.reportDate ||
    null;

  // Dates in 13G XML sometimes arrive as MM/DD/YYYY.
  let normalizedEvent: string | null = eventDate;
  if (eventDate && /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(eventDate)) {
    const [m, d, y] = eventDate.split("/");
    normalizedEvent = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  return {
    name: name.trim(),
    form: ref.form,
    filingDate: ref.filingDate,
    eventDate: normalizedEvent,
    shares,
    pctOfClass: pct,
    pctChangeFromPrior: null,
    sharesChangeFromPrior: null,
    accession: ref.accession,
    filingUrl: filingUrl(ref.filerCik, ref.accession, ref.primaryDocument || "primary_doc.xml"),
  };
}

async function fetch13GXml(ref: FilingRef): Promise<string | null> {
  const acc = accessionPath(ref.accession);
  const base = (ref.primaryDocument || "primary_doc.xml").split("/").pop() || "primary_doc.xml";
  const names = Array.from(
    new Set([
      base.endsWith(".xml") ? base : "primary_doc.xml",
      "primary_doc.xml",
      base,
    ])
  );
  for (const name of names) {
    if (!name.toLowerCase().endsWith(".xml")) continue;
    const url = `https://www.sec.gov/Archives/edgar/data/${ref.filerCik}/${acc}/${name}`;
    try {
      const text = await fetchText(url, {
        source: "SEC EDGAR",
        headers: { "User-Agent": UA },
        rateLimit: "sec",
        nullOn: [404],
        timeoutMs: 12_000,
        retries: 1,
      });
      if (
        text &&
        (text.includes("reportingPersonName") ||
          text.includes("amountBeneficiallyOwned") ||
          text.includes("schedule13g") ||
          text.includes("schedule13d"))
      ) {
        return text;
      }
    } catch {
      // next
    }
  }
  return null;
}

async function loadInstitutional13G(
  recent: SubmissionsRecent
): Promise<InstitutionalHolding[]> {
  const refs = listFilings(recent, isInstitutionalForm, INSTITUTIONAL_LIMIT);
  const holdings: InstitutionalHolding[] = [];
  for (const ref of refs) {
    // Older SC 13G often HTML-only; skip non-XML without burning the budget.
    const doc = (ref.primaryDocument || "").toLowerCase();
    if (doc && !doc.includes(".xml") && !doc.includes("xslschedule")) {
      continue;
    }
    const xml = await fetch13GXml(ref);
    if (!xml) continue;
    const h = parse13GXml(xml, ref);
    if (h) holdings.push(h);
  }

  // Attach prior-filing deltas per institution name (newest first).
  const byName = new Map<string, InstitutionalHolding[]>();
  for (const h of holdings) {
    const key = h.name.toLowerCase();
    const list = byName.get(key) ?? [];
    list.push(h);
    byName.set(key, list);
  }
  for (const list of byName.values()) {
    list.sort((a, b) => (a.filingDate < b.filingDate ? 1 : -1));
    for (let i = 0; i < list.length; i++) {
      const prior = list[i + 1];
      if (!prior) continue;
      if (list[i].pctOfClass != null && prior.pctOfClass != null) {
        list[i].pctChangeFromPrior = list[i].pctOfClass! - prior.pctOfClass!;
      }
      if (list[i].shares != null && prior.shares != null) {
        list[i].sharesChangeFromPrior = list[i].shares! - prior.shares!;
      }
    }
  }

  holdings.sort((a, b) => (a.filingDate < b.filingDate ? 1 : -1));
  return holdings;
}

// --- Nasdaq institutional holders (≥1%) -------------------------------------

function parseUsNumber(s: string | null | undefined): number | null {
  if (s == null) return null;
  const t = String(s).trim();
  if (!t || t === "-" || /^new$/i.test(t)) return null;
  const n = Number(t.replace(/,/g, "").replace(/%/g, "").replace(/\$/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

/** Nasdaq dates arrive as M/D/YYYY. */
function parseUsDate(s: string | null | undefined): string | null {
  if (!s) return null;
  const m = String(s).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
}

interface NasdaqHoldingsPage {
  data?: {
    ownershipSummary?: {
      SharesOutstandingPCT?: { value?: string };
      ShareoutstandingTotal?: { value?: string };
    };
    holdingsTransactions?: {
      totalRecords?: string;
      table?: {
        rows?: {
          ownerName?: string;
          date?: string;
          sharesHeld?: string;
          sharesChange?: string;
          sharesChangePCT?: string;
          marketValue?: string;
          url?: string;
        }[];
      };
    };
  };
}

/**
 * Institutional holders from Nasdaq's public company API (13F-sourced).
 * Walks market-value-sorted pages until stakes fall below MIN_SHAREHOLDER_PCT.
 */
async function loadMajorShareholders(
  ticker: string,
  sharesOutstanding: number | null
): Promise<{
  holdings: InstitutionalHolding[];
  totalInstitutionalPct: number | null;
  reportedSharesOut: number | null;
}> {
  if (!isValidTicker(ticker)) {
    return { holdings: [], totalInstitutionalPct: null, reportedSharesOut: null };
  }

  const empty = {
    holdings: [] as InstitutionalHolding[],
    totalInstitutionalPct: null as number | null,
    reportedSharesOut: null as number | null,
  };

  let totalInstitutionalPct: number | null = null;
  let reportedSharesOut: number | null = null;
  const collected: InstitutionalHolding[] = [];

  try {
    for (let page = 0; page < NASDAQ_MAX_PAGES; page++) {
      const offset = page * NASDAQ_PAGE_SIZE;
      const url =
        `https://api.nasdaq.com/api/company/${encodeURIComponent(ticker.toUpperCase())}` +
        `/institutional-holdings?limit=${NASDAQ_PAGE_SIZE}&offset=${offset}` +
        `&type=TOTAL&sortColumn=marketValue&sortOrder=DESC`;

      // Nasdaq's public API rejects non-browser clients (HTTP/2 resets / empty
      // bodies). Mirror a normal browser request.
      const data = await fetchJson<NasdaqHoldingsPage>(url, {
        source: "Nasdaq institutional holdings",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          Accept: "application/json, text/plain, */*",
          Origin: "https://www.nasdaq.com",
          Referer: "https://www.nasdaq.com/",
        },
        timeoutMs: 12_000,
        retries: 2,
        nullOn: [404, 403, 429],
      });

      const summary = data?.data?.ownershipSummary;
      if (page === 0 && summary) {
        totalInstitutionalPct = parseUsNumber(summary.SharesOutstandingPCT?.value);
        // Nasdaq reports shares outstanding in millions.
        const millions = parseUsNumber(summary.ShareoutstandingTotal?.value);
        if (millions != null && millions > 0) reportedSharesOut = millions * 1e6;
      }

      const rows = data?.data?.holdingsTransactions?.table?.rows ?? [];
      if (rows.length === 0) break;

      const so =
        sharesOutstanding && sharesOutstanding > 0
          ? sharesOutstanding
          : reportedSharesOut && reportedSharesOut > 0
            ? reportedSharesOut
            : null;

      let anyOnPageAtOrAboveThreshold = false;
      for (const row of rows) {
        const name = (row.ownerName || "").trim();
        if (!name) continue;
        const shares = parseUsNumber(row.sharesHeld);
        if (shares == null || shares <= 0) continue;
        const pct = so != null ? (shares / so) * 100 : null;
        if (pct != null && pct < MIN_SHAREHOLDER_PCT) continue;
        // Without shares outstanding we can't apply the 1% filter — keep the
        // top page only (page 0) as a best-effort list.
        if (pct == null && page > 0) continue;
        if (pct != null && pct >= MIN_SHAREHOLDER_PCT) anyOnPageAtOrAboveThreshold = true;

        const sharesChange = parseUsNumber(row.sharesChange);
        const reportDate = parseUsDate(row.date);
        const pctChangeFromPrior =
          so != null && sharesChange != null ? (sharesChange / so) * 100 : null;
        const path = row.url?.startsWith("http")
          ? row.url
          : row.url
            ? `https://www.nasdaq.com${row.url}`
            : `https://www.nasdaq.com/market-activity/stocks/${ticker.toLowerCase()}/institutional-holdings`;

        collected.push({
          name,
          form: "Institutional (13F)",
          filingDate: reportDate ?? row.date ?? "",
          eventDate: reportDate,
          shares,
          pctOfClass: pct,
          pctChangeFromPrior,
          sharesChangeFromPrior: sharesChange,
          accession: `nasdaq:${name}:${reportDate ?? row.date ?? ""}`,
          filingUrl: path,
        });
      }

      // Sorted by size: once a full page has nobody ≥1%, further pages won't either.
      if (so != null && !anyOnPageAtOrAboveThreshold) break;
      if (rows.length < NASDAQ_PAGE_SIZE) break;
    }
  } catch {
    return empty;
  }

  // Dedupe by normalized name, keep the larger stake.
  const byName = new Map<string, InstitutionalHolding>();
  for (const h of collected) {
    const k = h.name.toLowerCase();
    const prev = byName.get(k);
    if (!prev || (h.shares ?? 0) > (prev.shares ?? 0)) byName.set(k, h);
  }

  const holdings = Array.from(byName.values()).sort(
    (a, b) => (b.pctOfClass ?? b.shares ?? 0) - (a.pctOfClass ?? a.shares ?? 0)
  );

  // If we never got SO from either source, we kept unfiltered page-0 rows —
  // recompute pct when reportedSharesOut is now known from the summary.
  if (reportedSharesOut && reportedSharesOut > 0) {
    for (const h of holdings) {
      if (h.pctOfClass == null && h.shares != null) {
        h.pctOfClass = (h.shares / reportedSharesOut) * 100;
      }
      if (
        h.pctChangeFromPrior == null &&
        h.sharesChangeFromPrior != null
      ) {
        h.pctChangeFromPrior = (h.sharesChangeFromPrior / reportedSharesOut) * 100;
      }
    }
    // Apply 1% filter now that pcts exist.
    const filtered = holdings.filter(
      (h) => h.pctOfClass == null || h.pctOfClass >= MIN_SHAREHOLDER_PCT
    );
    return {
      holdings: filtered,
      totalInstitutionalPct,
      reportedSharesOut,
    };
  }

  return { holdings, totalInstitutionalPct, reportedSharesOut };
}

// --- Politicians ------------------------------------------------------------

interface CongressTradeRaw {
  transaction_date?: string;
  filing_date?: string | null;
  filer_name?: string;
  chamber?: string | null;
  party?: string | null;
  state?: string | null;
  transaction_type?: string;
  amount_range_label?: string | null;
  amount_range_low?: number | null;
  amount_range_high?: number | null;
  owner?: string | null;
  doc_url?: string | null;
  ticker?: string;
}

function politicianSide(type: string): Side {
  const t = type.toLowerCase();
  if (t.includes("purchase") || t.includes("buy")) return "buy";
  if (t.includes("sale") || t.includes("sell") || t.includes("exchange")) return "sell";
  return "other";
}

function mapPoliticianTrade(raw: CongressTradeRaw): PoliticianTrade | null {
  if (!raw.filer_name || !raw.transaction_date || !raw.transaction_type) return null;
  const low = raw.amount_range_low ?? null;
  const high = raw.amount_range_high ?? null;
  const mid =
    low != null && high != null
      ? (low + high) / 2
      : low != null
        ? low
        : high != null
          ? high
          : null;
  return {
    date: raw.transaction_date,
    filingDate: raw.filing_date ?? null,
    name: raw.filer_name,
    chamber: raw.chamber ?? null,
    party: raw.party ?? null,
    state: raw.state ?? null,
    side: politicianSide(raw.transaction_type),
    transactionType: raw.transaction_type,
    amountLabel: raw.amount_range_label ?? null,
    amountMid: mid,
    owner: raw.owner ?? null,
    docUrl: raw.doc_url ?? null,
  };
}

async function loadPoliticianTrades(ticker: string): Promise<PoliticianTrade[]> {
  if (!isValidTicker(ticker)) return [];
  const url = `${CONGRESS_TICKER_URL}/${encodeURIComponent(ticker.toUpperCase())}.json`;
  try {
    const data = await fetchJson<{ trades?: CongressTradeRaw[] }>(url, {
      source: "Congress trading dataset",
      timeoutMs: 15_000,
      retries: 1,
      nullOn: [404],
    });
    const raw = data?.trades ?? [];
    const trades = raw
      .map(mapPoliticianTrade)
      .filter((t): t is PoliticianTrade => t != null);
    trades.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    return trades.slice(0, POLITICIAN_TRADE_LIMIT);
  } catch {
    return [];
  }
}

// --- Aggregations -----------------------------------------------------------

function signedShares(trade: InsiderTrade): number {
  if (trade.shares == null) return 0;
  if (trade.side === "buy") return trade.shares;
  if (trade.side === "sell") return -trade.shares;
  return 0;
}

function aggregateInsiderPeople(
  trades: InsiderTrade[],
  sharesOutstanding: number | null
): PersonShareChange[] {
  const byName = new Map<
    string,
    {
      name: string;
      role: string | null;
      sharesHeld: number | null;
      net90: number;
      net365: number;
      count: number;
    }
  >();

  for (const t of trades) {
    const key = t.name.toLowerCase();
    let row = byName.get(key);
    if (!row) {
      row = {
        name: t.name,
        role: t.role,
        sharesHeld: t.sharesAfter,
        net90: 0,
        net365: 0,
        count: 0,
      };
      byName.set(key, row);
    }
    row.count++;
    if (t.role && !row.role) row.role = t.role;
    // Prefer the most recent post-transaction holding (trades are newest-first).
    if (row.sharesHeld == null && t.sharesAfter != null) row.sharesHeld = t.sharesAfter;
    const signed = signedShares(t);
    if (daysAgo(t.date, 95)) row.net90 += signed;
    if (daysAgo(t.date, 370)) row.net365 += signed;
  }

  const so = sharesOutstanding && sharesOutstanding > 0 ? sharesOutstanding : null;
  return Array.from(byName.values())
    .map((r) => ({
      name: r.name,
      role: r.role,
      sharesHeld: r.sharesHeld,
      pctOfShares: so && r.sharesHeld != null ? (r.sharesHeld / so) * 100 : null,
      netSharesQoQ: r.net90 || null,
      netSharesYoY: r.net365 || null,
      pctChangeQoQ: so && r.net90 ? (r.net90 / so) * 100 : r.net90 === 0 ? 0 : null,
      pctChangeYoY: so && r.net365 ? (r.net365 / so) * 100 : r.net365 === 0 ? 0 : null,
      tradeCount: r.count,
    }))
    .sort((a, b) => Math.abs(b.netSharesYoY ?? 0) - Math.abs(a.netSharesYoY ?? 0));
}

function aggregateInstitutionPeople(
  holdings: InstitutionalHolding[],
  sharesOutstanding: number | null
): PersonShareChange[] {
  // Latest filing per name (13G series may have multiples; 13F list is one row).
  const latest = new Map<string, InstitutionalHolding>();
  const prior = new Map<string, InstitutionalHolding>();
  for (const h of holdings) {
    const key = h.name.toLowerCase();
    if (!latest.has(key)) latest.set(key, h);
    else if (!prior.has(key)) prior.set(key, h);
  }

  const so = sharesOutstanding && sharesOutstanding > 0 ? sharesOutstanding : null;
  return Array.from(latest.values())
    .map((h) => {
      const p = prior.get(h.name.toLowerCase());
      // Prefer an explicit delta on the row (13F period change); else prior filing.
      const sharesDelta =
        h.sharesChangeFromPrior != null
          ? h.sharesChangeFromPrior
          : h.shares != null && p?.shares != null
            ? h.shares - p.shares
            : null;
      const pctDelta =
        h.pctChangeFromPrior != null
          ? h.pctChangeFromPrior
          : h.pctOfClass != null && p?.pctOfClass != null
            ? h.pctOfClass - p.pctOfClass
            : so && sharesDelta != null
              ? (sharesDelta / so) * 100
              : null;

      // 13F deltas are quarterly; treat them as the QoQ signal and mirror to YoY
      // when we have no longer series (honest "reported change" column).
      let daysBetween: number | null = null;
      if (h.filingDate && p?.filingDate) {
        daysBetween =
          (Date.parse(h.filingDate) - Date.parse(p.filingDate)) / 86_400_000;
      }
      const hasInlineDelta = h.sharesChangeFromPrior != null;
      const useAsQoQ =
        hasInlineDelta || (daysBetween != null && daysBetween <= 140);
      const useAsYoY =
        !hasInlineDelta &&
        (daysBetween == null || daysBetween >= 200 || (!useAsQoQ && sharesDelta != null));

      return {
        name: h.name,
        role: h.form,
        sharesHeld: h.shares,
        pctOfShares: h.pctOfClass,
        netSharesQoQ: useAsQoQ || hasInlineDelta ? sharesDelta : null,
        netSharesYoY: useAsYoY ? sharesDelta : hasInlineDelta ? null : sharesDelta,
        pctChangeQoQ: useAsQoQ || hasInlineDelta ? pctDelta : null,
        pctChangeYoY: useAsYoY ? pctDelta : hasInlineDelta ? null : pctDelta,
        tradeCount: 1 + (p ? 1 : 0),
      } satisfies PersonShareChange;
    })
    .sort((a, b) => (b.pctOfShares ?? 0) - (a.pctOfShares ?? 0));
}

function aggregatePoliticianPeople(trades: PoliticianTrade[]): PersonShareChange[] {
  // Politicians disclose dollar ranges, not share counts — we surface net
  // estimated mid-range dollars as the "change" signal, and leave share % null.
  const byName = new Map<
    string,
    {
      name: string;
      role: string | null;
      net90: number;
      net365: number;
      count: number;
    }
  >();

  for (const t of trades) {
    const key = t.name.toLowerCase();
    let row = byName.get(key);
    if (!row) {
      const role = [t.chamber, t.party, t.state].filter(Boolean).join(" · ") || null;
      row = { name: t.name, role, net90: 0, net365: 0, count: 0 };
      byName.set(key, row);
    }
    row.count++;
    const mid = t.amountMid ?? 0;
    const signed = t.side === "buy" ? mid : t.side === "sell" ? -mid : 0;
    if (daysAgo(t.date, 95)) row.net90 += signed;
    if (daysAgo(t.date, 370)) row.net365 += signed;
  }

  return Array.from(byName.values())
    .map((r) => ({
      name: r.name,
      role: r.role,
      sharesHeld: null,
      pctOfShares: null,
      // Reuse share-change fields to carry dollar midpoints for politicians.
      netSharesQoQ: r.net90 || null,
      netSharesYoY: r.net365 || null,
      pctChangeQoQ: null,
      pctChangeYoY: null,
      tradeCount: r.count,
    }))
    .sort((a, b) => Math.abs(b.netSharesYoY ?? 0) - Math.abs(a.netSharesYoY ?? 0));
}

function insiderSummary(
  trades: InsiderTrade[],
  sharesOutstanding: number | null
): OwnershipPayload["insiders"]["summary"] {
  let buys = 0;
  let sells = 0;
  let other = 0;
  let net90 = 0;
  let net365 = 0;
  for (const t of trades) {
    if (t.side === "buy") buys++;
    else if (t.side === "sell") sells++;
    else other++;
    const s = signedShares(t);
    if (daysAgo(t.date, 95)) net90 += s;
    if (daysAgo(t.date, 370)) net365 += s;
  }
  const so = sharesOutstanding && sharesOutstanding > 0 ? sharesOutstanding : null;
  return {
    buys,
    sells,
    other,
    netShares90d: net90 || null,
    netShares365d: net365 || null,
    pctChange90d: so && net90 ? (net90 / so) * 100 : net90 === 0 ? 0 : null,
    pctChange365d: so && net365 ? (net365 / so) * 100 : net365 === 0 ? 0 : null,
  };
}

function politicianSummary(
  trades: PoliticianTrade[]
): OwnershipPayload["politicians"]["summary"] {
  let buys = 0;
  let sells = 0;
  let other = 0;
  let net90 = 0;
  let net365 = 0;
  for (const t of trades) {
    if (t.side === "buy") buys++;
    else if (t.side === "sell") sells++;
    else other++;
    const mid = t.amountMid ?? 0;
    const signed = t.side === "buy" ? mid : t.side === "sell" ? -mid : 0;
    if (daysAgo(t.date, 95)) net90 += signed;
    if (daysAgo(t.date, 370)) net365 += signed;
  }
  return {
    buys,
    sells,
    other,
    netAmountMid90d: net90 || null,
    netAmountMid365d: net365 || null,
  };
}

// --- Public entrypoint ------------------------------------------------------

/**
 * Load ownership activity for a company. Cached aggressively: Form 4 parsing
 * walks many SEC files and must not run on every page view.
 *
 * - `quick` — institutions + politicians only (fast first paint)
 * - `full`  — + recent Form 4s and 13G/D (~28 filings)
 * - `deep`  — more Form 4 history once the UI is already interactive
 */
export async function getOwnership(
  cik: string,
  ticker: string,
  sharesOutstanding: number | null = null,
  opts?: { mode?: OwnershipMode }
): Promise<OwnershipPayload> {
  if (!isValidCik(cik)) {
    throw new Error(`Invalid CIK: ${cik}`);
  }
  const mode: OwnershipMode = opts?.mode ?? "full";
  const form4Limit =
    mode === "quick"
      ? FORM4_LIMIT_QUICK
      : mode === "deep"
        ? FORM4_LIMIT_DEEP
        : FORM4_LIMIT_DEFAULT;
  const t = (ticker || "").toUpperCase();
  const key = `ownership:v3:${mode}:${cik}:${t}:${sharesOutstanding ?? "na"}`;

  return singleFlight(key, () =>
    cached(key, { ttl: 3_600, tags: ["ownership", `cik:${cik}`] }, async () => {
      // Nasdaq major holders + politician data do not touch SEC and can run
      // alongside (or without) the Form 4 / 13G walk.
      const politicianPromise = t
        ? loadPoliticianTrades(t).catch(() => [] as PoliticianTrade[])
        : Promise.resolve([] as PoliticianTrade[]);
      const majorPromise = t
        ? loadMajorShareholders(t, sharesOutstanding).catch(() => ({
            holdings: [] as InstitutionalHolding[],
            totalInstitutionalPct: null as number | null,
            reportedSharesOut: null as number | null,
          }))
        : Promise.resolve({
            holdings: [] as InstitutionalHolding[],
            totalInstitutionalPct: null as number | null,
            reportedSharesOut: null as number | null,
          });

      let insiderTrades: InsiderTrade[] = [];
      let filings13g: InstitutionalHolding[] = [];
      if (mode !== "quick") {
        try {
          const recent = await getSubmissionsRecent(cik);
          if (recent) {
            // Sequential SEC archive walks share the rate limiter; keep them
            // ordered rather than racing 40+ parallel 403s.
            insiderTrades = await loadInsiderTrades(cik, recent, form4Limit).catch(
              () => [] as InsiderTrade[]
            );
            filings13g = await loadInstitutional13G(recent).catch(
              () => [] as InstitutionalHolding[]
            );
          }
        } catch {
          // Ownership degrades section-by-section; never fail the whole page.
        }
      }

      const [politicianTrades, major] = await Promise.all([
        politicianPromise,
        majorPromise,
      ]);

      // Prefer Nasdaq ≥1% list; if it is empty, fall back to 13G/D (usually ≥5%).
      let institutionalHoldings = major.holdings;
      if (institutionalHoldings.length === 0 && filings13g.length > 0) {
        // Latest filing per name, only those with ≥1% when known.
        const latest = new Map<string, InstitutionalHolding>();
        for (const h of filings13g) {
          const k = h.name.toLowerCase();
          if (!latest.has(k)) latest.set(k, h);
        }
        institutionalHoldings = Array.from(latest.values()).filter(
          (h) => h.pctOfClass == null || h.pctOfClass >= MIN_SHAREHOLDER_PCT
        );
      }

      const so =
        sharesOutstanding && sharesOutstanding > 0
          ? sharesOutstanding
          : major.reportedSharesOut;

      let latestTotalPct: number | null = null;
      for (const h of institutionalHoldings) {
        if (h.pctOfClass == null) continue;
        latestTotalPct = (latestTotalPct ?? 0) + h.pctOfClass;
      }

      const notes: string[] = [
        mode === "quick"
          ? "Quick load: institutions and politicians only. Insider Form 4s load in the background."
          : "Insider trades from SEC Form 4 filings (open-market P/S plus awards, tax withholding, and exercises).",
        `Shareholders ≥${MIN_SHAREHOLDER_PCT}% come from institutional 13F holdings data (via Nasdaq). Related entities can appear separately and sum above 100%.`,
        "Schedule 13G/D rows are beneficial-ownership statements (typically ≥5% holders) from SEC EDGAR.",
        "Politician trades are STOCK Act disclosures; amounts are reported as ranges, so midpoints are estimates.",
        "Share % uses the company's latest reported shares outstanding when available, else the figure reported with the holder data.",
      ];
      if (!so) {
        notes.push("Shares outstanding unavailable — percentage-of-float columns may be blank.");
      }

      const payload: OwnershipPayload = {
        cik,
        ticker: t,
        sharesOutstanding: so,
        asOf: new Date().toISOString(),
        mode,
        insidersPending: mode === "quick",
        insiders: {
          trades: insiderTrades,
          people: aggregateInsiderPeople(insiderTrades, so),
          summary: insiderSummary(insiderTrades, so),
        },
        institutions: {
          holdings: institutionalHoldings,
          filings13g,
          people: aggregateInstitutionPeople(institutionalHoldings, so),
          summary: {
            filerCount: institutionalHoldings.length,
            latestTotalPct,
            totalInstitutionalPct: major.totalInstitutionalPct,
            thresholdPct: MIN_SHAREHOLDER_PCT,
          },
        },
        politicians: {
          trades: politicianTrades,
          people: aggregatePoliticianPeople(politicianTrades),
          summary: politicianSummary(politicianTrades),
        },
        sources: [
          "SEC EDGAR Form 4",
          "Institutional holdings (13F via Nasdaq)",
          "SEC EDGAR Schedule 13G/D",
          "Congress trading dataset (STOCK Act PTRs)",
        ],
        notes,
      };
      return payload;
    })
  );
}

// Exported for unit tests.
export const _test = {
  parseForm4Xml,
  parse13GXml,
  codeSide,
  politicianSide,
  mapPoliticianTrade,
  aggregateInsiderPeople,
  aggregateInstitutionPeople,
  aggregatePoliticianPeople,
  xmlTag,
  filerCikFromAccession,
  isInstitutionalForm,
  parseUsNumber,
  parseUsDate,
  MIN_SHAREHOLDER_PCT,
};
