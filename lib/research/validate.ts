// Input validation for values that reach upstream URLs or response headers.

/**
 * SEC CIKs are numeric, at most 10 digits.
 *
 * This matters because the CIK is interpolated into the EDGAR URL after
 * `padStart(10, "0")`, and padStart only prepends, it strips nothing. A cik of
 * "../../foo" produced ".../companyfacts/CIK0../../foo.json", which normalizes
 * to a different data.sec.gov path whose JSON was handed straight back to the
 * caller.
 */
export function isValidCik(cik: string): boolean {
  return /^\d{1,10}$/.test(cik);
}

/**
 * Tickers are short alphanumerics; SEC uses "-" and "." for share classes.
 *
 * The leading lookahead requires at least one alphanumeric, which is what
 * rejects "." and "..". encodeURIComponent does not escape a dot and the URL
 * parser resolves dot segments, so a ticker of ".." climbed one path level on
 * the upstream price API. The host is a fixed literal so it could not be
 * redirected off-site, but it is the same bug class the CIK guard exists for.
 */
export function isValidTicker(ticker: string): boolean {
  return /^(?=.*[A-Za-z0-9])[A-Za-z0-9.\-]{1,12}$/.test(ticker);
}

/** Strip anything that could break out of a quoted Content-Disposition filename. */
export function safeFilename(name: string): string {
  return name.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 64) || "download";
}

export const MAX_SEARCH_QUERY = 64;
