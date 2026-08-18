// Server-side submissions lookup for filing deep links.
// Import only from API routes / server code — not client components.

import { fetchJson, singleFlight } from "./http";
import { cached } from "./cache";
import { isValidCik } from "./validate";
import {
  filingsFromRecent,
  type FilingsPayload,
  type SubmissionsRecent,
} from "./filings";

const UA = "FinanceExplorer/1.0 (easton.ryan@hws.edu)";

/**
 * Cached recent 10-K / 10-Q filing deep links for a CIK.
 * Returns an empty list when the company has no matching submissions.
 */
export async function getFilings(cik: string): Promise<FilingsPayload> {
  if (!isValidCik(cik)) {
    return { cik, filings: [] };
  }
  const key = `filings:v1:${cik}`;
  return singleFlight(key, () =>
    cached(key, { ttl: 21_600, tags: ["filings", `cik:${cik}`] }, async () => {
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
      const recent = d?.filings?.recent;
      if (!recent?.form?.length) {
        return { cik, filings: [] };
      }
      return { cik, filings: filingsFromRecent(cik, recent) };
    })
  );
}
