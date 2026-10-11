// Next earnings date, recent 8-Ks, and short interest.
// Nasdaq's public quote pages and SEC submissions. No paid feed.

import { fetchJson, singleFlight } from "./http";
import { cached } from "./cache";
import { isValidCik, isValidTicker } from "./validate";
import { documentUrl, type SubmissionsRecent } from "./filings";
import {
  labelsFor8KItems,
  parseEarningsDate,
  parseShortInterestRows,
  toneFor8KItems,
  type CompanyCatalysts,
  type EightKEvent,
} from "./catalysts";

const UA_SEC = "FinanceExplorer/1.0 (easton.ryan@hws.edu)";
const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const NASDAQ_HEADERS = {
  "User-Agent": BROWSER_UA,
  Accept: "application/json, text/plain, */*",
  Origin: "https://www.nasdaq.com",
  Referer: "https://www.nasdaq.com/",
};

const MAX_8K = 5;
const EIGHT_K_WINDOW_MS = 548 * 86400000;

interface SubmissionsWithItems extends SubmissionsRecent {
  items?: string[];
}

function recent8Ks(cik: string, recent: SubmissionsWithItems): EightKEvent[] {
  const out: EightKEvent[] = [];
  const now = Date.now();
  const forms = recent.form ?? [];
  for (let i = 0; i < forms.length && out.length < MAX_8K; i++) {
    const form = forms[i];
    if (form !== "8-K" && form !== "8-K/A") continue;
    const filingDate = (recent.filingDate?.[i] || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(filingDate)) continue;
    const filedMs = Date.parse(filingDate + "T00:00:00Z");
    if (!Number.isFinite(filedMs) || now - filedMs > EIGHT_K_WINDOW_MS) continue;
    const accession = recent.accessionNumber?.[i];
    if (!accession) continue;
    const items = recent.items?.[i] ?? "";
    const labels = labelsFor8KItems(items);
    if (form === "8-K/A" && !labels.includes("Amendment")) {
      labels.unshift("Amendment");
    }
    out.push({
      filingDate,
      labels: labels.length ? labels : [form],
      href: documentUrl(cik, accession, recent.primaryDocument?.[i] || ""),
      tone: toneFor8KItems(items),
    });
  }
  return out;
}

export async function getCompanyCatalysts(
  ticker: string,
  cik: string | null
): Promise<CompanyCatalysts | null> {
  if (!isValidTicker(ticker)) return null;
  const t = ticker.toUpperCase();
  const cikOk = cik && isValidCik(cik) ? cik : null;
  const key = `catalysts:v1:${t}:${cikOk ?? "nocik"}`;

  return singleFlight(key, () =>
    cached(
      key,
      { ttl: 10_800, tags: ["catalysts", `ticker:${t}`], nullTtl: 600 },
      async () => {
        const [earningsRes, shortRes, filingsRes] = await Promise.allSettled([
          fetchJson<{
            data?: { reportText?: string; announcement?: string };
          }>(
            `https://api.nasdaq.com/api/analyst/${encodeURIComponent(t)}/earnings-date`,
            {
              source: "Nasdaq earnings date",
              headers: NASDAQ_HEADERS,
              timeoutMs: 10_000,
              retries: 1,
              nullOn: [404, 403, 429],
            }
          ),
          fetchJson<{
            data?: {
              shortInterestTable?: {
                rows?: {
                  settlementDate?: string;
                  interest?: string | number;
                  daysToCover?: string | number;
                }[];
              };
            };
          }>(
            `https://api.nasdaq.com/api/quote/${encodeURIComponent(t)}/short-interest?assetclass=stocks`,
            {
              source: "Nasdaq short interest",
              headers: NASDAQ_HEADERS,
              timeoutMs: 10_000,
              retries: 1,
              nullOn: [404, 403, 429],
            }
          ),
          cikOk
            ? fetchJson<{ filings?: { recent?: SubmissionsWithItems } }>(
                `https://data.sec.gov/submissions/CIK${cikOk.padStart(10, "0")}.json`,
                {
                  source: "SEC EDGAR",
                  headers: { "User-Agent": UA_SEC },
                  rateLimit: "sec",
                  nullOn: [404],
                  timeoutMs: 15_000,
                }
              )
            : Promise.resolve(null),
        ]);

        const earnings =
          earningsRes.status === "fulfilled"
            ? parseEarningsDate(earningsRes.value?.data ?? null)
            : null;
        const shortInterest =
          shortRes.status === "fulfilled"
            ? parseShortInterestRows(
                shortRes.value?.data?.shortInterestTable?.rows ?? []
              )
            : null;
        const filings =
          filingsRes.status === "fulfilled" && filingsRes.value?.filings?.recent
            ? recent8Ks(cikOk!, filingsRes.value.filings.recent)
            : [];

        if (!earnings && !shortInterest && filings.length === 0) return null;
        return { ticker: t, earnings, filings, shortInterest };
      }
    )
  );
}
