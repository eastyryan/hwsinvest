// Product / geographic / reportable-segment breakdowns from annual/quarterly
// detail tables (the R*.htm sheets EDGAR generates from XBRL dimensions).
//
// Forms: 10-K (domestic), 20-F / 40-F (foreign private issuers / Canadian
// MJDS), plus amendments carefully and 10-Q as last resort.
//
// Why not companyfacts: that feed is consolidated totals only. Apple's iPhone
// revenue is the same us-gaap revenue concept with a product-axis member, and
// companyfacts drops those dimensions. The filing's Revenue (Details) and
// Segment Information tables keep them.
//
// Coverage varies by filer. When a company doesn't tag disaggregated revenue,
// the payload is empty and the UI says so — not an error.

import { fetchText, singleFlight } from "./http";
import { cached } from "./cache";
import { isValidCik } from "./validate";

const UA = "FinanceExplorer/1.0 (easton.ryan@hws.edu)";

export type SegmentKind = "product" | "geographic" | "reportable" | "other";

export interface SegmentRow {
  name: string;
  values: (number | null)[];
  /** Share of the total row when a total is present on the same table. */
  pctOfTotal: (number | null)[];
}

export interface SegmentTable {
  title: string;
  kind: SegmentKind;
  /** e.g. "$ in Millions" — values are as reported in the table, not re-scaled. */
  unitNote: string | null;
  periods: string[];
  rows: SegmentRow[];
  form: string;
  filingDate: string;
  accession: string;
  reportFile: string;
  filingUrl: string;
}

/** Multi-year product (or geo) mix stitched from successive annual filings. */
export interface SegmentHistory {
  kind: SegmentKind;
  /** Newest first — fiscal period labels. */
  periods: string[];
  rows: SegmentRow[];
  unitNote: string | null;
  sources: { form: string; filingDate: string; accession: string }[];
}

export interface SegmentsPayload {
  cik: string;
  form: string | null;
  filingDate: string | null;
  accession: string | null;
  filingUrl: string | null;
  tables: SegmentTable[];
  /** Stitched multi-year product history when older 10-Ks are available. */
  history: SegmentHistory | null;
  notes: string[];
}

interface FilingRef {
  form: string;
  accession: string;
  filingDate: string;
  primaryDocument: string;
}

function accessionPath(accession: string): string {
  return accession.replace(/-/g, "");
}

function archiveBase(cik: string, accession: string): string {
  return `https://www.sec.gov/Archives/edgar/data/${String(Number(cik))}/${accessionPath(accession)}`;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, " ")
    .trim();
}

function stripTags(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, " "));
}

function parseMoneyCell(raw: string): number | null {
  const t = decodeEntities(raw)
    .replace(/\$/g, "")
    .replace(/,/g, "")
    .replace(/\u2212/g, "-")
    .trim();
  if (!t || t === "—" || t === "-" || t === "–") return null;
  // Parentheses for negatives: (1,234)
  const paren = t.match(/^\((.+)\)$/);
  const body = paren ? paren[1] : t;
  const n = Number(body);
  if (!Number.isFinite(n)) return null;
  return paren ? -n : n;
}

/** Consolidated / total revenue line labels across filers (Apple, TSLA, MSFT, 20-F…). */
const TOTAL_ROW_RE =
  /^(net sales|total net sales|revenue|revenues|net revenue|net revenues|total revenue|total revenues|total sales|total|consolidated net sales|consolidated revenue|consolidated revenues|total external revenue|external revenue|total turnover|turnover|revenue from external customers|total revenue from external customers)$/i;

/**
 * Metric under a product/geo/segment section that should take the section's name.
 * Alphabet uses "Revenue from contract with customers"; Apple uses "Net sales";
 * Tesla uses "Revenues"; IFRS 8 / 20-F often use "External revenue" or "Turnover".
 */
const SEGMENT_METRIC_RE =
  /^(net sales|total net sales|revenue|revenues|net revenue|net revenues|sales|total revenue|total revenues|total sales|revenue from contract with customers|revenues from contracts with customers|external revenue|revenue from external customers|external revenues|turnover|net turnover|sales revenue|long-lived assets|long lived assets|total long-lived assets|non-current assets|noncurrent assets|total revenue)$/i;

/** Intermediate subtotals (e.g. TSLA "Total revenues from sales and services"). */
function isSubtotalSection(name: string): boolean {
  return /^total\b/i.test(name.trim());
}

function isTotalRowName(name: string): boolean {
  return TOTAL_ROW_RE.test(name.trim());
}

/**
 * Classify a detail sheet. Order matters: product first, then reportable
 * (before geographic), so titles like "…Geographic Areas - Reportable Segment"
 * are not mislabeled as geo.
 */
function classifyKind(title: string): SegmentKind {
  const t = title.toLowerCase();
  // Noise sheets that happen to say "segment" or "revenue"
  if (
    /unearned|deferred revenue|performance obligation|warranty|lease receivable|goodwill activity|property and equipment additions|depreciation and amortization expense, by segment|inventory and accounts receivable|equity incentive|digital assets|fair value of financial|operational milestone|reconciliation of segment|segment reconcil/i.test(
      t
    )
  ) {
    return "other";
  }

  // Product / service / market disaggregation (Apple, MSFT, TSLA, AMZN, GOOGL, NVDA…)
  // IFRS 8 entity-wide product disclosures on 20-F filings use similar wording.
  if (
    /disaggregat/.test(t) ||
    /product and service|product or service|product\/service|products and services|groups of products/.test(
      t
    ) ||
    /significant product|service offerings|by major source|revenue by type|revenue by market|sales by market|by market \(details\)|schedule of revenue by market/.test(
      t
    ) ||
    /net sales by product|revenue by product|classified by significant product|revenue by category|analysis of revenue by product|external revenue by product|revenue from external customers by product/.test(
      t
    ) ||
    /productorserviceaxis/i.test(t)
  ) {
    return "product";
  }

  // Operating / reportable segments — before geographic, because many titles
  // embed "Geographic Areas" as the parent note name.
  // IFRS 8 / 20-F: "Operating segments", "Disclosure of operating segments", etc.
  if (
    /reportable segment|operating segment|segment revenue|revenue and operating income|total revenues and gross profit by reportable|operating income\/loss by segment|information by reportable|revenues and gross profit by reportable|segment results|segment revenue and results|disclosure of operating segment|information about reportable|ifrs\s*8/.test(
      t
    )
  ) {
    return "reportable";
  }

  // Geographic (US-GAAP 10-K + IFRS 8 entity-wide geography on 20-F)
  if (
    /by geographic|geographic area|geographic location|geographical|by region|by country|countries representing|countries that individually|major geographic|revenue classified by major geographic|long-lived assets by geographic|long-lived assets by region|net sales attributed to countries|revenues by geographic|schedule of revenues by geographic|schedule of long-lived assets by geographic|entity-wide.*geograph|geograph.*entity-wide|external revenue by geograph|revenue from external customers by geograph|non-current assets by geograph|noncurrent assets by geograph/.test(
      t
    )
  ) {
    return "geographic";
  }

  if (/segment information|segment reporting/.test(t) && /detail|table/.test(t)) {
    return "reportable";
  }
  return "other";
}

/** Relevance score for which R*.htm sheets to fetch (higher = better). */
function reportScore(shortName: string, longName: string): number {
  const t = `${shortName} ${longName}`.toLowerCase();
  // Hard rejects — keep the fetch list tight and universal
  if (
    /parenthetical|additional information|narrative|goodwill activity|property and equipment from|unearned|deferred revenue|performance obligation|warranty|lease|inventory and accounts receivable|changes in unearned|remaining performance|equity incentive|digital assets|fair value of financial|operational milestone|significant accounting policies \(tables\)|inventory \(tables\)|property, plant|reconciliation of reportable|segment reconcil/i.test(
      t
    )
  ) {
    return -1;
  }
  // Bare note titles without Detail/Tables are low value text pages.
  // 20-F / IFRS 8 titles often say "Operating segments (Details)" or
  // "Geographical information (Details)" without US-GAAP phrasing.
  // Apple-style geo: "Net Sales for Countries that Individually Accounted…"
  // may omit the word "Detail" and "geographic".
  if (
    !/detail|disaggregat|reportable segment|operating segment|by geographic|geographic|geographical|by region|by country|by type|by market|product and service|products and services|service offerings|major source|major geographic|entity-wide|ifrs\s*8|external revenue|segment results|countries that individually|countries representing|net sales for countries|net sales attributed/i.test(
      t
    )
  ) {
    // Allow explicit "(Tables)" only if also clearly segment/revenue related
    if (!(/\(tables\)/.test(t) && /segment|revenue|geographic|geograph|product/i.test(t))) {
      return -1;
    }
  }

  let score = 0;
  if (/disaggregat/.test(t)) score += 100;
  if (
    /product and service|product or service|products and services|significant product|service offerings|by major source|revenue by type|revenue by market|classified by significant product|schedule of revenue by market|revenue by category|external revenue by product|revenue from external customers by product/.test(
      t
    )
  ) {
    score += 95;
  }
  if (
    /reportable segment|operating segment|total revenues and gross profit by reportable|revenues and gross profit by reportable|segment revenue, cost|revenue and operating income\/loss by segment|segment revenue and results|disclosure of operating segment|information about reportable|ifrs\s*8/.test(
      t
    )
  ) {
    score += 88;
  }
  if (
    /by geographic|geographic area|geographic location|geographical|by region|major geographic|countries representing|countries that individually|net sales for countries|revenues by geographic|net sales attributed to countries|long-lived assets by geographic|long-lived assets by region|schedule of revenues by geographic|entity-wide.*geograph|external revenue by geograph|non-current assets by geograph/.test(
      t
    )
  ) {
    score += 85;
  }
  if (/segment information.*detail|segment reporting.*detail|operating segments.*detail/.test(t)) {
    score += 40;
  }
  if (/revenue.*detail|detail.*revenue/.test(t) && score < 20) score += 25;
  // Pure "(Tables)" index pages — fetch only if nothing better scored
  if (/\(tables\)$/.test(t.trim()) && score < 15) score = 8;
  return score;
}

function isInterestingReport(shortName: string, longName: string): boolean {
  return reportScore(shortName, longName) > 0;
}

/** Pick the best detail sheets — do not take "first N" in filing order. */
function selectReports(
  reports: SummaryReport[],
  limit = 10
): SummaryReport[] {
  return [...reports]
    .map((r) => ({ r, score: reportScore(r.shortName, r.longName) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.r);
}

interface SummaryReport {
  shortName: string;
  longName: string;
  htmlFile: string;
}

function parseFilingSummary(xml: string): SummaryReport[] {
  const out: SummaryReport[] = [];
  const re = /<Report\b[\s\S]*?<\/Report>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const block = m[0];
    const shortName = (block.match(/<ShortName>([^<]*)<\/ShortName>/i) || [])[1] || "";
    const longName = (block.match(/<LongName>([^<]*)<\/LongName>/i) || [])[1] || "";
    const htmlFile = (block.match(/<HtmlFileName>([^<]*)<\/HtmlFileName>/i) || [])[1] || "";
    if (!htmlFile) continue;
    out.push({ shortName, longName, htmlFile });
  }
  // Score + rank so product/geo sheets aren't dropped when many "segment" notes exist.
  return selectReports(out, 12);
}

/**
 * Parse an EDGAR R*.htm detail table into period columns + named rows.
 *
 * These tables interleave section headers (product/geo member) with a
 * "Net sales" value row under each. We promote the section header to the
 * row name when the next numeric row is a revenue line.
 */
export function parseSegmentHtml(
  html: string,
  meta: {
    title: string;
    kind: SegmentKind;
    form: string;
    filingDate: string;
    accession: string;
    reportFile: string;
    filingUrl: string;
  }
): SegmentTable | null {
  // Isolate the main report table.
  const tableMatch = html.match(/<table[^>]*class="report"[^>]*>([\s\S]*?)<\/table>/i);
  if (!tableMatch) return null;
  const table = tableMatch[1];

  const unitNote =
    (html.match(/\$\s*in\s+(Millions|Billions|Thousands)/i) || [])[0] ||
    (stripTags(html).match(/\$\s*in\s+(Millions|Billions|Thousands)/i) || [])[0] ||
    null;

  // Header dates from th.th cells.
  const periods: string[] = [];
  const thRe = /<th[^>]*class="th"[^>]*>([\s\S]*?)<\/th>/gi;
  let th: RegExpExecArray | null;
  while ((th = thRe.exec(table)) !== null) {
    const text = stripTags(th[1]);
    if (!text) continue;
    // Skip "12 Months Ended" / "3 Months Ended" span headers without dates.
    if (/months?\s+ended/i.test(text) && !/\d{4}/.test(text)) continue;
    if (/usd|\$\s*in/i.test(text) && !/\d{4}/.test(text)) continue;
    periods.push(text);
  }
  // Deduplicate while preserving order (colspan headers can repeat).
  const seen = new Set<string>();
  const uniquePeriods = periods.filter((p) => {
    if (seen.has(p)) return false;
    seen.add(p);
    return true;
  });

  if (uniquePeriods.length === 0) return null;

  // Walk body rows. Class is on the <tr>, not the inner cells.
  type RawRow = { kind: "section" | "value"; name: string; values: (number | null)[] };
  const raw: RawRow[] = [];
  const trRe = /<tr([^>]*)>([\s\S]*?)<\/tr>/gi;
  let tr: RegExpExecArray | null;
  while ((tr = trRe.exec(table)) !== null) {
    const trAttrs = tr[1] || "";
    const rowHtml = tr[2];
    const trClass = ((trAttrs.match(/class="([^"]*)"/i) || [])[1] || "").toLowerCase();

    if (trClass.includes("th") || /<th\b/i.test(rowHtml)) continue;

    const cells = [...rowHtml.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) =>
      stripTags(c[1])
    );

    // Section header row (product/geo member) — class "rh" or axis defref in cell.
    // US-GAAP axes plus common IFRS 8 / srt / ifrs-full segment axes on 20-F.
    const isSection =
      /\brh\b/.test(trClass) ||
      /ProductOrServiceAxis|StatementGeographicalAxis|StatementBusinessSegmentsAxis|OperatingSegmentsAxis|GeographicalAreasAxis|MajorCustomersAxis|SegmentAxis|ifrs-full_OperatingSegmentsAxis|ifrs-full_GeographicalAreasAxis/i.test(
        rowHtml
      );
    if (isSection) {
      const label = cells[0] || stripTags(rowHtml);
      if (label && !/line items/i.test(label)) {
        raw.push({ kind: "section", name: label, values: [] });
      }
      continue;
    }

    if (cells.length < 2) continue;
    const label = cells[0];
    if (!label || /line items/i.test(label)) continue;

    const nums = cells.slice(1).map(parseMoneyCell);
    // Pad/truncate to period count.
    while (nums.length < uniquePeriods.length) nums.push(null);
    const values = nums.slice(0, uniquePeriods.length);
    if (values.every((v) => v == null)) continue;

    raw.push({ kind: "value", name: label, values });
  }

  // Promote "section → Revenues/Net sales" into a single named row.
  //
  // Filer styles vary:
  //   Apple:  [rh] iPhone  →  [ro] Net sales
  //   TSLA:   [rh] Automotive sales → [ro] Revenues  (plural; Line Items rows already dropped)
  //   Reportable: section may be followed by Revenues + Cost + Gross profit — keep
  //   only the revenue metric under the section name so the mix chart is usable.
  const rows: SegmentRow[] = [];
  for (let i = 0; i < raw.length; i++) {
    const r = raw[i];
    if (r.kind === "section") {
      let j = i + 1;
      let promoted = false;
      while (j < raw.length && raw[j].kind === "value") {
        const v = raw[j];
        if (!promoted && SEGMENT_METRIC_RE.test(v.name) && !isSubtotalSection(r.name)) {
          rows.push({
            name: r.name,
            values: v.values,
            pctOfTotal: v.values.map(() => null),
          });
          promoted = true;
        }
        // Consume every value row under this section so Cost/Gross don't become
        // orphan top-level lines with no segment attribution.
        j++;
        // For product/geo only the first metric matters; for reportable same —
        // stop after first revenue-like so we don't over-consume a flat table
        // that incorrectly has no further sections (rare). Actually always
        // consume until next section: the while condition already does that.
      }
      i = j - 1;
      continue;
    }
    // Standalone value rows (consolidated totals before any section, etc.)
    if (isTotalRowName(r.name) || rows.length === 0) {
      rows.push({ name: r.name, values: r.values, pctOfTotal: r.values.map(() => null) });
    } else if (!/line items|disaggregation/i.test(r.name)) {
      rows.push({ name: r.name, values: r.values, pctOfTotal: r.values.map(() => null) });
    }
  }

  if (rows.length === 0) return null;

  // % of total: prefer an explicit total/net sales row; else sum of segment rows.
  const totalRow = rows.find((r) => isTotalRowName(r.name)) || null;
  const segmentRows = totalRow ? rows.filter((r) => r !== totalRow) : rows;

  for (let c = 0; c < uniquePeriods.length; c++) {
    const summed = segmentRows.reduce((s, r) => s + (r.values[c] ?? 0), 0);
    const total = totalRow?.values[c] ?? (summed !== 0 ? summed : null);
    for (const r of rows) {
      if (total != null && total !== 0 && r.values[c] != null) {
        r.pctOfTotal[c] = (r.values[c]! / total) * 100;
      }
    }
  }

  // Drop pure "total" noise tables with a single total and no segments.
  const namedSegments = rows.filter((r) => !isTotalRowName(r.name));
  if (namedSegments.length === 0) return null;

  // Product/geo: keep the total + member revenue rows; drop deferred-revenue,
  // hedging memo lines, and other footnote cuts that aren't a mix slice.
  let finalRows = rows;
  if (meta.kind === "product" || meta.kind === "geographic") {
    finalRows = rows.filter(
      (r) =>
        isTotalRowName(r.name) ||
        !/deferred|portion of total|previously deferred|contract liability|hedging gains|hedging losses/i.test(
          r.name
        )
    );
  }

  // Long-lived-asset tables often repeat the same metric name under country
  // sections without a clean section→value pairing; skip if every row name is
  // identical (unusable without the lost section labels).
  if (finalRows.length > 1) {
    const uniq = new Set(finalRows.map((r) => r.name.toLowerCase()));
    if (uniq.size === 1) return null;
  }

  return {
    title: meta.title,
    kind: meta.kind,
    unitNote,
    periods: uniquePeriods,
    rows: finalRows,
    form: meta.form,
    filingDate: meta.filingDate,
    accession: meta.accession,
    reportFile: meta.reportFile,
    filingUrl: meta.filingUrl,
  };
}

const HISTORY_FILINGS = 5; // how many annual filings to stitch for multi-year mix

/** Original annual forms (domestic + FPI / Canadian MJDS). */
const SEGMENT_ANNUAL_ORIG = new Set(["10-K", "20-F", "40-F"]);
/** Amendments often ship thin FilingSummary / few R*.htm sheets — last resort. */
const SEGMENT_ANNUAL_AMEND = new Set(["10-K/A", "20-F/A", "40-F/A"]);

/**
 * Prefer original annuals (10-K, 20-F, 40-F) over amendments, then one 10-Q.
 * Exported for tests — pure, no network.
 */
export function selectSegmentFilings(
  recent: {
    form: string[];
    accessionNumber: string[];
    filingDate: string[];
    primaryDocument: string[];
  },
  limit = HISTORY_FILINGS
): FilingRef[] {
  const pushMatching = (allowed: Set<string>, max: number): FilingRef[] => {
    const out: FilingRef[] = [];
    for (let i = 0; i < recent.form.length; i++) {
      if (!allowed.has(recent.form[i])) continue;
      out.push({
        form: recent.form[i],
        accession: recent.accessionNumber[i],
        filingDate: recent.filingDate[i],
        primaryDocument: recent.primaryDocument[i] || "",
      });
      if (out.length >= max) break;
    }
    return out;
  };

  // Prefer pure annuals over amendments. Amendments often ship a thin
  // FilingSummary (few or no R*.htm detail sheets), which left tickers like
  // TSLA with empty segments even though the original annual had full tables.
  // Include 20-F / 40-F so foreign private issuers are not skipped entirely.
  let out = pushMatching(SEGMENT_ANNUAL_ORIG, limit);
  if (out.length === 0) out = pushMatching(SEGMENT_ANNUAL_AMEND, limit);
  if (out.length === 0) {
    out = pushMatching(new Set(["10-Q", "10-Q/A"]), 1);
  }
  return out;
}

async function listSegmentFilings(cik: string): Promise<FilingRef[]> {
  const padded = cik.padStart(10, "0");
  const text = await fetchText(`https://data.sec.gov/submissions/CIK${padded}.json`, {
    source: "SEC EDGAR",
    headers: { "User-Agent": UA },
    rateLimit: "sec",
    nullOn: [404],
    timeoutMs: 15_000,
  });
  if (!text) return [];
  let j: {
    filings?: {
      recent?: {
        form: string[];
        accessionNumber: string[];
        filingDate: string[];
        primaryDocument: string[];
      };
    };
  };
  try {
    j = JSON.parse(text);
  } catch {
    return [];
  }
  const r = j.filings?.recent;
  if (!r?.form?.length) return [];
  return selectSegmentFilings(r, HISTORY_FILINGS);
}

async function loadTablesFromFiling(cik: string, filing: FilingRef): Promise<SegmentTable[]> {
  const base = archiveBase(cik, filing.accession);
  const summaryXml = await fetchText(`${base}/FilingSummary.xml`, {
    source: "SEC EDGAR",
    headers: { "User-Agent": UA },
    rateLimit: "sec",
    nullOn: [404],
    timeoutMs: 12_000,
    retries: 1,
  });
  if (!summaryXml) return [];

  // parseFilingSummary already ranks and caps sheets by relevance.
  const reports = parseFilingSummary(summaryXml);
  const tables: SegmentTable[] = [];

  for (const rep of reports) {
    const html = await fetchText(`${base}/${rep.htmlFile}`, {
      source: "SEC EDGAR",
      headers: { "User-Agent": UA },
      rateLimit: "sec",
      nullOn: [404],
      timeoutMs: 12_000,
      retries: 1,
    });
    if (!html) continue;
    const title = rep.shortName || rep.longName;
    const parsed = parseSegmentHtml(html, {
      title,
      kind: classifyKind(`${title} ${rep.longName}`),
      form: filing.form,
      filingDate: filing.filingDate,
      accession: filing.accession,
      reportFile: rep.htmlFile,
      filingUrl: `${base}/${rep.htmlFile}`,
    });
    if (parsed && parsed.rows.length > 0) tables.push(parsed);
  }
  return tables;
}

/**
 * Stitch the "current year" column of product tables across successive 10-Ks
 * into one multi-year history (newest period first).
 */
export function stitchProductHistory(tablesByFiling: SegmentTable[][]): SegmentHistory | null {
  // Prefer product tables; fall back to geographic so non-Apple filers still
  // get multi-year mix when they only tag country/region revenue.
  return stitchHistoryByKind(tablesByFiling, "product")
    ?? stitchHistoryByKind(tablesByFiling, "geographic");
}

function stitchHistoryByKind(
  tablesByFiling: SegmentTable[][],
  kind: SegmentKind
): SegmentHistory | null {
  // Each entry: table's first period (latest year of that filing).
  type Col = {
    period: string;
    unitNote: string | null;
    form: string;
    filingDate: string;
    accession: string;
    values: Map<string, number | null>;
    total: number | null;
  };
  const cols: Col[] = [];

  for (const tables of tablesByFiling) {
    const product = tables.find((t) => t.kind === kind);
    if (!product || product.periods.length === 0) continue;
    const colIdx = 0; // newest column in that filing
    const values = new Map<string, number | null>();
    let total: number | null = null;
    for (const row of product.rows) {
      const v = row.values[colIdx] ?? null;
      if (isTotalRowName(row.name)) {
        total = v;
        continue;
      }
      if (/deferred|portion of total|cost of|gross profit|operating income|depreciation/i.test(row.name)) {
        continue;
      }
      if (isSubtotalSection(row.name)) continue;
      if (v == null || v <= 0) continue;
      values.set(row.name, v);
    }
    if (values.size === 0) continue;
    cols.push({
      period: product.periods[colIdx],
      unitNote: product.unitNote,
      form: product.form,
      filingDate: product.filingDate,
      accession: product.accession,
      values,
      total,
    });
  }

  // Dedupe periods (amended 10-Ks can repeat the same year) — keep first (newest filing).
  const seen = new Set<string>();
  const unique = cols.filter((c) => {
    if (seen.has(c.period)) return false;
    seen.add(c.period);
    return true;
  });

  if (unique.length < 2) return null;

  const nameSet = new Set<string>();
  for (const c of unique) for (const n of c.values.keys()) nameSet.add(n);
  const names = [...nameSet];

  const periods = unique.map((c) => c.period);
  const rows: SegmentRow[] = names.map((name) => {
    const values = unique.map((c) => c.values.get(name) ?? null);
    const pctOfTotal = unique.map((c, i) => {
      const v = values[i];
      const tot =
        c.total ??
        [...c.values.values()].reduce<number>((s, x) => s + (x ?? 0), 0);
      if (v == null || !tot) return null;
      return (v / tot) * 100;
    });
    return { name, values, pctOfTotal };
  });

  // Sort rows by latest value desc.
  rows.sort((a, b) => (b.values[0] ?? 0) - (a.values[0] ?? 0));

  return {
    kind,
    periods,
    rows,
    unitNote: unique[0]?.unitNote ?? null,
    sources: unique.map((c) => ({
      form: c.form,
      filingDate: c.filingDate,
      accession: c.accession,
    })),
  };
}

export async function getSegments(cik: string): Promise<SegmentsPayload> {
  if (!isValidCik(cik)) throw new Error(`Invalid CIK: ${cik}`);
  // v6: broader IFRS 8 / 20-F title scoring + external-revenue metric names
  const key = `segments:v6:${cik}`;

  return singleFlight(key, () =>
    cached(key, { ttl: 21_600, tags: ["segments", `cik:${cik}`] }, async () => {
      const empty: SegmentsPayload = {
        cik,
        form: null,
        filingDate: null,
        accession: null,
        filingUrl: null,
        tables: [],
        history: null,
        notes: [
          "Segment and product revenue come from 10-K / 20-F / 40-F / 10-Q XBRL detail tables, not the consolidated companyfacts feed.",
          "Multi-year mix stitches the current-year column of successive annual filings when available.",
          "Many filers do not tag product-level revenue. When nothing is tagged, this page stays empty rather than inventing a breakdown.",
          "KPIs like installed base / active users rarely appear in structured XBRL — they are usually narrative-only.",
        ],
      };

      const filings = await listSegmentFilings(cik);
      if (filings.length === 0) return empty;

      const tablesByFiling: SegmentTable[][] = [];
      for (const filing of filings) {
        const tables = await loadTablesFromFiling(cik, filing);
        tablesByFiling.push(tables);
      }

      // Primary UI: first filing that actually produced tables (skip empty).
      let primaryIdx = tablesByFiling.findIndex((t) => t.length > 0);
      if (primaryIdx < 0) primaryIdx = 0;
      const latestTables = [...(tablesByFiling[primaryIdx] ?? [])];
      const order: SegmentKind[] = ["product", "geographic", "reportable", "other"];
      latestTables.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));

      const history = stitchProductHistory(tablesByFiling);
      const filing = filings[primaryIdx];
      const base = archiveBase(cik, filing.accession);

      return {
        cik,
        form: filing.form,
        filingDate: filing.filingDate,
        accession: filing.accession,
        filingUrl: `${base}/${filing.primaryDocument}`,
        tables: latestTables,
        history,
        notes: empty.notes,
      };
    })
  );
}

export const _test = {
  parseFilingSummary,
  parseSegmentHtml,
  classifyKind,
  parseMoneyCell,
  isInterestingReport,
  reportScore,
  selectReports,
  stitchProductHistory,
  selectSegmentFilings,
};
