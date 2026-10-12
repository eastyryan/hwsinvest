// Server lookup for company catalysts. Import only from API routes.

import { fetchJson, singleFlight } from "./http";
import { cached } from "./cache";
import { isValidCik, isValidTicker } from "./validate";
import { getMarketCalendar } from "./yahoo";
import {
  buildCatalysts,
  nasdaqEarningsCatalyst,
  parseNasdaqEarningsDate,
  parseShortInterestRows,
  todayInNewYork,
  withMarketCalendar,
  type CatalystSourceFiling,
  type CatalystsPayload,
  type NasdaqEarningsDate,
  type ShortInterestPrint,
} from "./catalysts";

const UA = "FinanceExplorer/1.0 (easton.ryan@hws.edu)";
const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const NASDAQ_HEADERS = {
  "User-Agent": BROWSER_UA,
  Accept: "application/json, text/plain, */*",
  Origin: "https://www.nasdaq.com",
  Referer: "https://www.nasdaq.com/",
};

interface SecRecent {
  accessionNumber?: string[];
  filingDate?: string[];
  form?: string[];
  primaryDocument?: string[];
  primaryDocDescription?: string[];
  items?: string[];
}

function rowsFromRecent(recent: SecRecent | undefined): CatalystSourceFiling[] {
  if (!recent?.form?.length) return [];
  const out: CatalystSourceFiling[] = [];
  for (let i = 0; i < recent.form.length && out.length < 600; i++) {
    const filingDate = (recent.filingDate?.[i] ?? "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(filingDate)) continue;
    out.push({
      form: recent.form[i] ?? "",
      filingDate,
      accession: recent.accessionNumber?.[i] ?? "",
      primaryDocument: recent.primaryDocument?.[i] ?? "",
      items: recent.items?.[i] ?? "",
      description: recent.primaryDocDescription?.[i] ?? "",
    });
  }
  return out;
}

function empty(cik: string, ticker: string): CatalystsPayload {
  return buildCatalysts({
    cik,
    ticker,
    filings: [],
    calendar: null,
    today: todayInNewYork(),
  });
}

/** Nasdaq settlement short interest. Cached on its own so a miss does not pin the filing list. */
async function getShortInterest(ticker: string): Promise<ShortInterestPrint | null> {
  const key = `short-interest:v1:${ticker}`;
  return singleFlight(key, () =>
    cached(
      key,
      { ttl: 21_600, tags: ["catalysts", `ticker:${ticker}`], nullTtl: 600 },
      async () => {
        const data = await fetchJson<{
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
          `https://api.nasdaq.com/api/quote/${encodeURIComponent(ticker)}/short-interest?assetclass=stocks`,
          {
            source: "Nasdaq short interest",
            headers: NASDAQ_HEADERS,
            timeoutMs: 10_000,
            retries: 1,
            nullOn: [404, 403, 429],
          }
        );
        return parseShortInterestRows(data?.data?.shortInterestTable?.rows ?? []);
      }
    )
  );
}

/** Nasdaq earnings-date prose. Cached apart from the filing list. */
async function getNasdaqEarnings(ticker: string): Promise<NasdaqEarningsDate | null> {
  const key = `nasdaq-earnings:v1:${ticker}`;
  return singleFlight(key, () =>
    cached(
      key,
      { ttl: 10_800, tags: ["catalysts", `ticker:${ticker}`], nullTtl: 600 },
      async () => {
        const data = await fetchJson<{
          data?: { reportText?: string | null; announcement?: string | null };
        }>(
          `https://api.nasdaq.com/api/analyst/${encodeURIComponent(ticker)}/earnings-date`,
          {
            source: "Nasdaq earnings date",
            headers: NASDAQ_HEADERS,
            timeoutMs: 10_000,
            retries: 1,
            nullOn: [404, 403, 429],
          }
        );
        return parseNasdaqEarningsDate(data?.data ?? null);
      }
    )
  );
}

/** Cached catalyst list for one filer. Yahoo failure leaves the filing list intact. */
export async function getCatalysts(cik: string, ticker: string): Promise<CatalystsPayload> {
  if (!isValidCik(cik)) return empty(cik, ticker);
  const symbol = isValidTicker(ticker) ? ticker.toUpperCase() : "";
  const key = `catalysts:v1:${cik}:${symbol}`;
  return singleFlight(key, () =>
    cached(key, { ttl: 10_800, tags: ["catalysts", `cik:${cik}`] }, async () => {
      const padded = cik.padStart(10, "0");
      const data = await fetchJson<{ filings?: { recent?: SecRecent } }>(
        `https://data.sec.gov/submissions/CIK${padded}.json`,
        {
          source: "SEC EDGAR",
          headers: { "User-Agent": UA },
          rateLimit: "sec",
          nullOn: [404],
          timeoutMs: 15_000,
        }
      );
      const filings = rowsFromRecent(data?.filings?.recent);
      // Calendar is merged after this cache. A Yahoo miss must not pin
      // "no earnings date" for the full filing TTL.
      return buildCatalysts({
        cik,
        ticker: symbol,
        filings,
        calendar: null,
        today: todayInNewYork(),
      });
    })
  ).then(async (filed) => {
    if (!symbol) return { ...filed, shortInterest: null };
    const today = todayInNewYork();
    const [calendar, shortInterest, nasdaqEarnings] = await Promise.all([
      getMarketCalendar(symbol).catch(() => null),
      getShortInterest(symbol).catch(() => null),
      getNasdaqEarnings(symbol).catch(() => null),
    ]);
    let withCal = calendar ? withMarketCalendar(filed, calendar, today) : filed;
    const earnings = nasdaqEarnings
      ? nasdaqEarningsCatalyst(nasdaqEarnings, today)
      : null;
    if (
      earnings &&
      !withCal.events.some((event) => event.kind === "Earnings" && event.when === "upcoming")
    ) {
      const events = [...withCal.events, earnings].sort((a, b) => {
        if (a.when !== b.when) return a.when === "upcoming" ? -1 : 1;
        return a.when === "upcoming"
          ? a.date.localeCompare(b.date)
          : b.date.localeCompare(a.date);
      });
      withCal = { ...withCal, events };
    }
    return { ...withCal, shortInterest };
  });
}
