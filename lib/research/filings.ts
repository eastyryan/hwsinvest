// SEC 10-K / 10-Q archive deep links for statement period ends.
//
// Pure URL builders and period-matching helpers — safe for client components.
// Server fetch: lib/filings-server.ts (getFilings).

/** How many recent annual + quarterly filings to keep. */
const FILING_LIMIT = 48;

/** Match reportDate to a companyfacts period end within this window. */
const MATCH_TOLERANCE_MS = 5 * 86400000;

const ANNUAL_FORMS = new Set([
  "10-K",
  "10-K/A",
  "20-F",
  "20-F/A",
  "40-F",
  "40-F/A",
]);
const QUARTERLY_FORMS = new Set(["10-Q", "10-Q/A"]);

export interface FilingLink {
  form: string;
  accession: string;
  filingDate: string;
  /** Period of report end (ISO date) — aligns with companyfacts period ends. */
  reportDate: string;
  primaryDocument: string;
  /** Primary HTML (or other) document on SEC Archives. */
  documentUrl: string;
  /** Interactive Data viewer when XBRL is present. */
  interactiveUrl: string;
  /** Filing index page listing all exhibits. */
  indexUrl: string;
}

export interface FilingsPayload {
  cik: string;
  filings: FilingLink[];
}

export interface SubmissionsRecent {
  accessionNumber: string[];
  filingDate: string[];
  reportDate: string[];
  form: string[];
  primaryDocument: string[];
}

function accessionPath(accession: string): string {
  return accession.replace(/-/g, "");
}

/** Unpadded numeric CIK for the Archives path segment. */
function archiveCik(cik: string): string {
  return String(Number(cik));
}

/**
 * Primary document URL on SEC Archives.
 *
 * Format:
 *   https://www.sec.gov/Archives/edgar/data/{cik}/{accessionNoDashes}/{primaryDocument}
 */
export function documentUrl(
  cik: string,
  accession: string,
  primaryDocument: string
): string {
  const doc = (primaryDocument || "index.htm").replace(/^xsl[^/]+\//, "");
  return `https://www.sec.gov/Archives/edgar/data/${archiveCik(cik)}/${accessionPath(accession)}/${doc}`;
}

/** Filing folder index (lists every exhibit). */
export function indexUrl(cik: string, accession: string): string {
  return `https://www.sec.gov/Archives/edgar/data/${archiveCik(cik)}/${accessionPath(accession)}/`;
}

/** SEC Interactive Data viewer for the accession. */
export function interactiveUrl(cik: string, accession: string): string {
  const padded = cik.padStart(10, "0");
  return `https://www.sec.gov/cgi-bin/viewer?action=view&cik=${padded}&accession_number=${accession}&xbrl_type=v`;
}

function isStatementForm(form: string): boolean {
  return ANNUAL_FORMS.has(form) || QUARTERLY_FORMS.has(form);
}

function isAmendment(form: string): boolean {
  return form.endsWith("/A");
}

function formRank(form: string, preferQuarterly: boolean): number {
  // Lower is better. Prefer originals over amendments; prefer the period kind
  // the statement table is showing.
  const kindBoost =
    preferQuarterly
      ? QUARTERLY_FORMS.has(form)
        ? 0
        : 10
      : ANNUAL_FORMS.has(form)
        ? 0
        : 10;
  return kindBoost + (isAmendment(form) ? 1 : 0);
}

/**
 * Build FilingLink list from the submissions "recent" arrays.
 * Exported for unit tests (no network).
 */
export function filingsFromRecent(
  cik: string,
  recent: SubmissionsRecent,
  limit = FILING_LIMIT
): FilingLink[] {
  const out: FilingLink[] = [];
  // Submissions are newest-first. Prefer the original over a later amendment
  // when both cover the same reportDate+form family.
  const seenReport = new Set<string>(); // formFamily|reportDate

  const push = (i: number) => {
    const form = recent.form[i];
    if (!isStatementForm(form)) return false;
    const accession = recent.accessionNumber[i];
    if (!accession) return false;
    const reportDate = (recent.reportDate[i] || recent.filingDate[i] || "").slice(0, 10);
    if (!reportDate) return false;
    const family = form.replace(/\/A$/, "");
    const key = `${family}|${reportDate}`;
    if (seenReport.has(key)) return false;
    seenReport.add(key);
    const primaryDocument = recent.primaryDocument[i] || "";
    out.push({
      form,
      accession,
      filingDate: recent.filingDate[i] || "",
      reportDate,
      primaryDocument,
      documentUrl: documentUrl(cik, accession, primaryDocument),
      interactiveUrl: interactiveUrl(cik, accession),
      indexUrl: indexUrl(cik, accession),
    });
    return true;
  };

  // Pass 1: originals only.
  for (let i = 0; i < recent.form.length && out.length < limit; i++) {
    if (isAmendment(recent.form[i])) continue;
    push(i);
  }
  // Pass 2: amendments only when no original for that report period.
  for (let i = 0; i < recent.form.length && out.length < limit; i++) {
    if (!isAmendment(recent.form[i])) continue;
    push(i);
  }
  return out;
}

/**
 * Pick the best filing for a period end date.
 * Prefer exact reportDate match; fall back to nearest within MATCH_TOLERANCE_MS.
 */
export function resolveFilingForPeriod(
  filings: FilingLink[],
  periodEnd: string,
  opts: { quarterly?: boolean } = {}
): FilingLink | null {
  if (!filings.length) return null;
  const end = periodEnd.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(end)) return null;
  const preferQuarterly = !!opts.quarterly;
  const endMs = new Date(end + "T00:00:00Z").getTime();
  if (!Number.isFinite(endMs)) return null;

  let best: FilingLink | null = null;
  let bestScore = Infinity;

  for (const f of filings) {
    const rd = f.reportDate.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(rd)) continue;
    const rdMs = new Date(rd + "T00:00:00Z").getTime();
    if (!Number.isFinite(rdMs)) continue;
    const delta = Math.abs(rdMs - endMs);
    if (delta > MATCH_TOLERANCE_MS) continue;
    // Score: date distance (ms) + form preference * large constant.
    const score = delta + formRank(f.form, preferQuarterly) * 1e12;
    if (score < bestScore) {
      bestScore = score;
      best = f;
    }
  }
  return best;
}

/** Map period end → filing for every resolvable period. */
export function mapFilingsToPeriods(
  filings: FilingLink[],
  periodEnds: string[],
  opts: { quarterly?: boolean } = {}
): Record<string, FilingLink> {
  const out: Record<string, FilingLink> = {};
  for (const end of periodEnds) {
    const hit = resolveFilingForPeriod(filings, end, opts);
    if (hit) out[end.slice(0, 10)] = hit;
  }
  return out;
}
