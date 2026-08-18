// Sector/industry peer sets for the Overview strip.
//
// Yahoo rarely exposes a reliable free "peers" list from datacenter IPs, so we
// resolve peers from curated sector/industry maps of liquid US large-caps, then
// score them from SEC-normalized statements (same engine as the rest of the app).
// When Yahoo recommendationsbysymbol works we prefer those names first; when
// subject marketCap is known we sort the curated pool by cap proximity.
// "Sector avg" is the mean of the loaded set (subject + peers) for each metric.

import type { CompanyFinancials, StatementSet } from "./edgar";
import { buildRatios } from "./ratios";
import { getCompanyFinancials, getTickerDirectory } from "./edgar";
import { cached } from "./cache";
import { singleFlight, fetchJson } from "./http";
import { isValidTicker } from "./validate";

export interface PeerScorecard {
  ticker: string;
  name: string;
  cik: string;
  /** True for the company the user is viewing. */
  isSubject: boolean;
  periodLabel: string | null;
  /** Latest annual revenue YoY (fraction, e.g. 0.12 = +12%). */
  revYoy: number | null;
  grossMargin: number | null;
  opMargin: number | null;
  netMargin: number | null;
  fcfMargin: number | null;
}

export interface PeerAverages {
  revYoy: number | null;
  grossMargin: number | null;
  opMargin: number | null;
  netMargin: number | null;
  fcfMargin: number | null;
  /** How many names contributed to each average (max). */
  n: number;
}

export type PeerSource = "yahoo" | "industry" | "sector" | "fallback";

export interface PeersPayload {
  subject: string;
  sector: string | null;
  industry: string | null;
  /** Subject first, then peers. */
  cards: PeerScorecard[];
  averages: PeerAverages;
  notes: string[];
}

/** Yahoo-style sector labels → liquid US peers. */
const SECTOR_PEERS: Record<string, string[]> = {
  Technology: [
    "AAPL", "MSFT", "NVDA", "GOOGL", "META", "AVGO", "ORCL", "CRM", "ADBE", "AMD", "INTC", "CSCO", "IBM", "NOW", "INTU",
  ],
  "Communication Services": [
    "GOOGL", "META", "NFLX", "DIS", "CMCSA", "T", "VZ", "TMUS", "SPOT", "EA",
  ],
  "Consumer Cyclical": [
    "AMZN", "TSLA", "HD", "MCD", "NKE", "SBUX", "LOW", "BKNG", "TJX", "CMG",
  ],
  "Consumer Defensive": [
    "WMT", "PG", "KO", "PEP", "COST", "PM", "MO", "CL", "MDLZ", "KMB",
  ],
  Healthcare: [
    "UNH", "JNJ", "LLY", "ABBV", "MRK", "PFE", "TMO", "ABT", "DHR", "AMGN", "ISRG", "SYK",
  ],
  Financial: [
    "JPM", "V", "MA", "BAC", "WFC", "GS", "MS", "AXP", "SPGI", "BLK", "C", "SCHW",
  ],
  "Financial Services": [
    "JPM", "V", "MA", "BAC", "WFC", "GS", "MS", "AXP", "SPGI", "BLK", "C", "SCHW",
  ],
  Industrials: [
    "GE", "CAT", "RTX", "HON", "UNP", "BA", "DE", "LMT", "UPS", "MMM",
  ],
  Energy: ["XOM", "CVX", "COP", "SLB", "EOG", "MPC", "PSX", "VLO", "OXY", "WMB"],
  Utilities: ["NEE", "SO", "DUK", "CEG", "SRE", "AEP", "D", "EXC", "XEL", "PCG"],
  "Basic Materials": ["LIN", "APD", "SHW", "ECL", "FCX", "NEM", "NUE", "DOW", "DD", "VMC"],
  "Real Estate": ["PLD", "AMT", "EQIX", "WELL", "SPG", "O", "DLR", "PSA", "CCI", "VICI"],
};

/** Finer industry overrides when Yahoo supplies a known industry string. */
const INDUSTRY_PEERS: Record<string, string[]> = {
  Semiconductors: ["NVDA", "AVGO", "AMD", "TSM", "QCOM", "TXN", "INTC", "MU", "AMAT", "LRCX", "KLAC", "ASML"],
  "Semiconductor Equipment & Materials": ["AMAT", "LRCX", "KLAC", "ASML", "TER", "ENTG"],
  "Consumer Electronics": ["AAPL", "SONY", "DELL", "HPQ"],
  "Software—Infrastructure": ["MSFT", "ORCL", "NOW", "PANW", "CRWD", "FTNT", "SNOW", "DDOG", "NET"],
  "Software—Application": ["CRM", "ADBE", "INTU", "WDAY", "TEAM", "SHOP", "SQ", "HUBS", "ZM"],
  "Information Technology Services": ["IBM", "ACN", "CTSH", "INFY", "WIT", "EPAM"],
  "Computer Hardware": ["AAPL", "DELL", "HPQ", "HPE", "SMCI", "NTAP"],
  "Electronic Components": ["APH", "TEL", "GLW", "KEYS", "TDY"],
  "Communication Equipment": ["CSCO", "ANET", "MSI", "ERIC", "NOK", "JNPR"],
  "Internet Content & Information": ["GOOGL", "META", "SNAP", "PINS", "BIDU", "RDDT"],
  "Internet Retail": ["AMZN", "MELI", "ETSY", "BABA", "JD", "PDD"],
  "Auto Manufacturers": ["TSLA", "F", "GM", "RIVN", "LCID", "TM", "HMC"],
  "Auto Parts": ["APTV", "BWA", "MGA", "ALV", "GPC"],
  "Drug Manufacturers—General": ["LLY", "JNJ", "MRK", "PFE", "ABBV", "BMY", "AZN", "NVS", "GSK", "SNY"],
  "Drug Manufacturers—Specialty & Generic": ["TEVA", "VTRS", "PRGO", "CTLT"],
  "Biotechnology": ["AMGN", "GILD", "VRTX", "REGN", "BIIB", "MRNA", "BNTX", "ALNY"],
  "Medical Devices": ["ABT", "MDT", "SYK", "BSX", "ISRG", "EW", "DXCM", "ZBH"],
  "Diagnostics & Research": ["TMO", "DHR", "IDXX", "A", "IQV", "MTD", "WAT"],
  "Healthcare Plans": ["UNH", "ELV", "CVS", "CI", "HUM", "CNC", "MOH"],
  "Medical Care Facilities": ["HCA", "UHS", "THC", "DVA", "FMS"],
  "Banks—Diversified": ["JPM", "BAC", "WFC", "C", "USB", "PNC", "TFC"],
  "Banks—Regional": ["PNC", "USB", "TFC", "CFG", "KEY", "RF", "FITB", "MTB"],
  "Credit Services": ["V", "MA", "AXP", "COF", "DFS", "PYPL", "SQ"],
  "Capital Markets": ["GS", "MS", "SCHW", "BLK", "BX", "KKR", "ICE", "CME"],
  "Insurance—Diversified": ["BRK.B", "AIG", "MET", "PRU", "AFL"],
  "Insurance—Property & Casualty": ["PGR", "CB", "TRV", "ALL", "HIG", "CINF"],
  "Insurance—Life": ["MET", "PRU", "AFL", "LNC", "VOYA"],
  "Asset Management": ["BLK", "BX", "KKR", "TROW", "BEN", "IVZ"],
  "Oil & Gas Integrated": ["XOM", "CVX", "BP", "SHEL", "TTE"],
  "Oil & Gas E&P": ["COP", "EOG", "OXY", "DVN", "FANG", "HES", "APA"],
  "Oil & Gas Midstream": ["WMB", "KMI", "OKE", "ET", "EPD", "MPLX"],
  "Oil & Gas Refining & Marketing": ["MPC", "PSX", "VLO", "DK"],
  "Oil & Gas Equipment & Services": ["SLB", "HAL", "BKR", "NOV", "FTI"],
  "Telecom Services": ["T", "VZ", "TMUS", "CMCSA", "CHTR"],
  "Entertainment": ["NFLX", "DIS", "WBD", "PARA", "LYV", "SPOT"],
  "Restaurants": ["MCD", "SBUX", "CMG", "YUM", "DPZ", "QSR", "DRI"],
  "Apparel Retail": ["TJX", "ROST", "GPS", "ANF", "URBN", "BURL"],
  "Specialty Retail": ["HD", "LOW", "TSCO", "ORLY", "AZO", "BBY"],
  "Discount Stores": ["WMT", "COST", "TGT", "DG", "DLTR"],
  "Packaged Foods": ["MDLZ", "GIS", "K", "HSY", "CPB", "CAG", "SJM"],
  "Beverages—Non-Alcoholic": ["KO", "PEP", "MNST", "KDP", "CELH"],
  "Household & Personal Products": ["PG", "CL", "KMB", "CHD", "CLX", "EL"],
  "Aerospace & Defense": ["RTX", "LMT", "BA", "GD", "NOC", "HII", "LHX"],
  "Farm & Heavy Construction Machinery": ["CAT", "DE", "PCAR", "CNHI"],
  "Specialty Industrial Machinery": ["GE", "HON", "EMR", "ITW", "ROK", "PH", "IR"],
  "Railroads": ["UNP", "CSX", "NSC", "CP", "CNI"],
  "Integrated Freight & Logistics": ["UPS", "FDX", "XPO", "CHRW", "EXPD"],
  "Utilities—Regulated Electric": ["NEE", "SO", "DUK", "AEP", "D", "EXC", "XEL"],
  "Utilities—Renewable": ["NEE", "CEG", "AES", "BEPC", "CWEN"],
  "REIT—Industrial": ["PLD", "PSA", "EXR", "CUBE", "FR", "EGP"],
  "REIT—Retail": ["SPG", "O", "KIM", "REG", "FRT"],
  "REIT—Residential": ["EQR", "AVB", "INVH", "MAA", "ESS", "UDR"],
  "REIT—Specialty": ["AMT", "CCI", "SBAC", "EQIX", "DLR", "IRM"],
  "Specialty Chemicals": ["LIN", "APD", "ECL", "SHW", "DD", "PPG", "ALB"],
  "Gold": ["NEM", "GOLD", "AEM", "KGC", "WPM"],
  "Copper": ["FCX", "SCCO", "TECK"],
  "Steel": ["NUE", "STLD", "CLF", "X", "RS"],
};

const FALLBACK_PEERS = [
  "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "JPM", "XOM", "UNH", "JNJ",
];

/**
 * Sector → liquid US large-cap tickers used by the peer strip and free screener.
 * Read-only; do not mutate. "Financial Services" aliases "Financial".
 */
export function getSectorPeerLists(): Readonly<Record<string, readonly string[]>> {
  return SECTOR_PEERS;
}

/** Industry overrides (Yahoo-style labels) — optional finer pool for tools. */
export function getIndustryPeerLists(): Readonly<Record<string, readonly string[]>> {
  return INDUSTRY_PEERS;
}

/** Large-cap fallback when sector/industry is unknown. */
export function getFallbackPeerTickers(): readonly string[] {
  return FALLBACK_PEERS;
}

/**
 * Approximate market caps (USD) for liquid names we already curate.
 * Used only to sort a candidate pool when the subject has a live marketCap —
 * not for display. Order of magnitude is enough; figures are static snapshots.
 */
const APPROX_MARKET_CAP: Record<string, number> = {
  AAPL: 3.4e12, MSFT: 3.2e12, NVDA: 3.0e12, GOOGL: 2.1e12, GOOG: 2.1e12, AMZN: 2.0e12,
  META: 1.5e12, BRK_B: 1.0e12, "BRK.B": 1.0e12, LLY: 8e11, AVGO: 8e11, TSLA: 8e11,
  JPM: 7e11, V: 6e11, WMT: 6e11, XOM: 5e11, UNH: 5e11, MA: 5e11, ORCL: 4e11,
  COST: 4e11, PG: 4e11, JNJ: 4e11, HD: 4e11, ABBV: 3.5e11, CVX: 3e11, KO: 3e11,
  MRK: 3e11, CRM: 3e11, BAC: 3e11, AMD: 2.5e11, PEP: 2.5e11, TMO: 2.2e11,
  CSCO: 2.2e11, ADBE: 2.2e11, LIN: 2.2e11, MCD: 2.1e11, ACN: 2.1e11, IBM: 2e11,
  GE: 2e11, ABT: 2e11, CAT: 2e11, QCOM: 2e11, NOW: 1.9e11, TXN: 1.8e11,
  VZ: 1.8e11, DIS: 2e11, PM: 1.8e11, INTU: 1.8e11, AMGN: 1.7e11, ISRG: 1.7e11,
  PFE: 1.6e11, RTX: 1.6e11, SPGI: 1.6e11, T: 1.5e11, NEE: 1.5e11, BLK: 1.5e11,
  LOW: 1.5e11, AMAT: 1.5e11, SYK: 1.4e11, GS: 1.6e11, MS: 1.5e11, PGR: 1.4e11,
  UNP: 1.4e11, HON: 1.4e11, BKNG: 1.4e11, LRCX: 1.2e11, TJX: 1.3e11, PLD: 1.2e11,
  SBUX: 1.1e11, DE: 1.1e11, GILD: 1.1e11, MDT: 1.1e11, MU: 1.2e11, INTC: 1.0e11,
  C: 1.2e11, WFC: 2.5e11, COP: 1.4e11, SCHW: 1.4e11, AXP: 1.6e11, NFLX: 3e11,
  TSM: 9e11, ASML: 3e11, AZN: 2.2e11, NVS: 2.2e11, SHEL: 2.1e11, BABA: 2e11,
  TM: 2.5e11, SAP: 3e11, SNOW: 5e10, CRWD: 8e10, PANW: 1.1e11, DDOG: 4e10,
  MELI: 9e10, SHOP: 1.1e11, SQ: 4e10, PYPL: 7e10, UBER: 1.5e11, ABNB: 8e10,
};

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

function normalizeKey(s: string): string {
  return s.trim().toLowerCase().replace(/[\s–—-]+/g, " ");
}

function approxCap(ticker: string): number | null {
  const u = ticker.toUpperCase();
  return APPROX_MARKET_CAP[u] ?? APPROX_MARKET_CAP[u.replace(".", "_")] ?? null;
}

/**
 * Sort tickers by |log(cap) − log(subjectCap)| when both caps known;
 * unknown caps sort after known ones, preserving relative order.
 */
export function sortByMarketCapProximity(
  tickers: string[],
  subjectMarketCap: number | null | undefined
): string[] {
  if (subjectMarketCap == null || !(subjectMarketCap > 0)) return [...tickers];
  const logSub = Math.log(subjectMarketCap);
  return [...tickers]
    .map((t, i) => {
      const cap = approxCap(t);
      const dist =
        cap != null && cap > 0 ? Math.abs(Math.log(cap) - logSub) : Number.POSITIVE_INFINITY;
      return { t, dist, i };
    })
    .sort((a, b) => a.dist - b.dist || a.i - b.i)
    .map((x) => x.t);
}

/**
 * Free Yahoo "people also watch" style recommendations. Degrades to [] when
 * blocked — no crumb required on this endpoint in practice.
 */
export async function fetchYahooRecommendedPeers(
  ticker: string
): Promise<string[]> {
  if (!isValidTicker(ticker)) return [];
  const t = ticker.toUpperCase();
  const key = `yahoorecs:v1:${t}`;
  try {
    return await singleFlight(key, () =>
      cached(key, { ttl: 86_400, tags: ["peers", "yahoo"], nullTtl: 600 }, async () => {
        const data = await fetchJson<{
          finance?: {
            result?: { symbol?: string; recommendedSymbols?: { symbol?: string }[] }[];
          };
        }>(
          `https://query2.finance.yahoo.com/v6/finance/recommendationsbysymbol/${encodeURIComponent(t)}`,
          {
            source: "Yahoo recommendations",
            headers: { "User-Agent": BROWSER_UA },
            timeoutMs: 6_000,
            retries: 0,
            nullOn: [401, 403, 404, 429],
          }
        );
        const recs = data?.finance?.result?.[0]?.recommendedSymbols ?? [];
        const out: string[] = [];
        const seen = new Set<string>();
        for (const r of recs) {
          const sym = r.symbol?.trim().toUpperCase();
          if (!sym || !isValidTicker(sym) || seen.has(sym)) continue;
          seen.add(sym);
          out.push(sym);
        }
        return out;
      })
    );
  } catch {
    return [];
  }
}

/** Resolve peer tickers for a sector/industry, excluding the subject. */
export function resolvePeerTickers(
  sector: string | null | undefined,
  industry: string | null | undefined,
  subjectTicker: string,
  limit = 5,
  opts?: {
    /** Prefer these first (e.g. Yahoo recommendations). */
    preferred?: string[];
    /** Subject market cap — reorders curated pool by proximity. */
    marketCap?: number | null;
  }
): { tickers: string[]; source: PeerSource } {
  const self = subjectTicker.toUpperCase();
  const ind = industry?.trim() ?? "";
  const sec = sector?.trim() ?? "";

  // Exact industry, then case-insensitive / fuzzy key match.
  let pool: string[] | undefined = INDUSTRY_PEERS[ind];
  let source: PeerSource = "industry";
  if (!pool && ind) {
    const nk = normalizeKey(ind);
    for (const [k, v] of Object.entries(INDUSTRY_PEERS)) {
      if (normalizeKey(k) === nk || normalizeKey(k).includes(nk) || nk.includes(normalizeKey(k))) {
        pool = v;
        break;
      }
    }
  }
  if (!pool) {
    pool = SECTOR_PEERS[sec];
    source = "sector";
    if (!pool && sec) {
      const nk = normalizeKey(sec);
      for (const [k, v] of Object.entries(SECTOR_PEERS)) {
        if (normalizeKey(k) === nk || normalizeKey(k).includes(nk) || nk.includes(normalizeKey(k))) {
          pool = v;
          break;
        }
      }
    }
  }
  if (!pool) {
    pool = FALLBACK_PEERS;
    source = "fallback";
  }

  const preferred = (opts?.preferred ?? [])
    .map((t) => t.toUpperCase())
    .filter((t) => t && t !== self);

  // Cap-proximity reorder of the curated pool (preferred list already ranked by Yahoo).
  const rankedPool = sortByMarketCapProximity(pool, opts?.marketCap);

  const out: string[] = [];
  const seen = new Set<string>([self]);
  for (const t of [...preferred, ...rankedPool]) {
    const u = t.toUpperCase();
    if (seen.has(u)) continue;
    seen.add(u);
    out.push(u);
    if (out.length >= limit) break;
  }

  // If Yahoo contributed at least one accepted peer, label source yahoo.
  if (preferred.some((p) => out.includes(p))) {
    source = "yahoo";
  }

  return { tickers: out, source };
}

function findLine(set: StatementSet, key: string) {
  for (const st of set.statements) {
    const l = st.lines.find((x) => x.key === key);
    if (l) return l;
  }
  return undefined;
}

/** Build a compact scorecard from already-normalized financials. */
export function buildPeerScorecard(
  fin: CompanyFinancials,
  opts?: { isSubject?: boolean }
): PeerScorecard {
  const set = fin.annual.periods.length > 0 ? fin.annual : fin.quarterly;
  const p = set.periods[0];
  const rev = findLine(set, "revenue");
  const ratios = buildRatios(fin, set === fin.annual ? "annual" : "quarterly");
  const ratioAt = (key: string): number | null => {
    if (!p) return null;
    const line = ratios.lines.find((l) => l.key === key);
    return line?.values[p.key] ?? null;
  };

  return {
    ticker: fin.ticker.toUpperCase(),
    name: fin.name,
    cik: fin.cik,
    isSubject: opts?.isSubject ?? false,
    periodLabel: p?.label ?? null,
    revYoy: p && rev ? rev.yoy[p.key] ?? null : null,
    grossMargin: ratioAt("grossMargin"),
    opMargin: ratioAt("opMargin"),
    netMargin: ratioAt("netMargin"),
    fcfMargin: ratioAt("fcfMargin"),
  };
}

function mean(vals: (number | null | undefined)[]): number | null {
  const xs = vals.filter((v): v is number => v != null && Number.isFinite(v));
  if (xs.length === 0) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function averageScorecards(cards: PeerScorecard[]): PeerAverages {
  return {
    revYoy: mean(cards.map((c) => c.revYoy)),
    grossMargin: mean(cards.map((c) => c.grossMargin)),
    opMargin: mean(cards.map((c) => c.opMargin)),
    netMargin: mean(cards.map((c) => c.netMargin)),
    fcfMargin: mean(cards.map((c) => c.fcfMargin)),
    n: cards.length,
  };
}

async function lookupCiks(tickers: string[]): Promise<Map<string, { cik: string; name: string }>> {
  const dir = await getTickerDirectory();
  const byTicker = new Map(dir.map((e) => [e.ticker.toUpperCase(), e]));
  const out = new Map<string, { cik: string; name: string }>();
  for (const t of tickers) {
    const hit = byTicker.get(t.toUpperCase());
    if (hit) out.set(t.toUpperCase(), { cik: hit.cik, name: hit.name });
  }
  return out;
}

/**
 * Load scorecards for subject + sector/industry peers.
 * SEC-bound; keep peer count small and rely on financials cache.
 */
export async function getPeersForCompany(args: {
  ticker: string;
  cik: string;
  name: string;
  sector: string | null;
  industry: string | null;
  /** Optional preloaded subject financials to avoid a double fetch. */
  subjectFin?: CompanyFinancials;
  peerLimit?: number;
  /** Subject market cap for proximity ranking of curated peers. */
  marketCap?: number | null;
}): Promise<PeersPayload> {
  const subject = args.ticker.toUpperCase();
  const capKey =
    args.marketCap != null && args.marketCap > 0
      ? String(Math.round(Math.log10(args.marketCap) * 10))
      : "";
  const key = `peers:v2:${subject}:${args.sector ?? ""}:${args.industry ?? ""}:${capKey}`;

  return singleFlight(key, () =>
    cached(key, { ttl: 14_400, tags: ["peers", `ticker:${subject}`] }, async () => {
      // Optional Yahoo boost — never blocks peer strip if it fails.
      const yahooPeers = await fetchYahooRecommendedPeers(subject);

      const { tickers: peerTickers, source } = resolvePeerTickers(
        args.sector,
        args.industry,
        subject,
        args.peerLimit ?? 5,
        { preferred: yahooPeers, marketCap: args.marketCap }
      );

      const notes: string[] = [];
      if (source === "yahoo") {
        notes.push(
          "Peers blend Yahoo-related names with the industry/sector set" +
            (args.marketCap != null && args.marketCap > 0
              ? ", ordered toward similar market cap where known."
              : ".")
        );
      } else if (source === "industry") {
        notes.push(
          `Peers chosen from the ${args.industry} industry set` +
            (args.marketCap != null && args.marketCap > 0
              ? ", sorted by approximate market-cap proximity."
              : ".")
        );
      } else if (source === "sector") {
        notes.push(
          `Peers chosen from the ${args.sector} sector set` +
            (args.marketCap != null && args.marketCap > 0
              ? ", sorted by approximate market-cap proximity."
              : ".")
        );
      } else {
        notes.push(
          "Sector/industry unavailable — showing large-cap reference names. Peer averages are of this set, not a true sector index."
        );
      }
      notes.push(
        "Averages are the mean of the companies shown (including this one when present). Not a full sector index."
      );

      const cikMap = await lookupCiks(peerTickers);

      // Subject card
      let subjectCard: PeerScorecard;
      if (args.subjectFin) {
        subjectCard = buildPeerScorecard(args.subjectFin, { isSubject: true });
      } else {
        try {
          const fin = await getCompanyFinancials(args.cik, subject);
          subjectCard = buildPeerScorecard(fin, { isSubject: true });
        } catch {
          subjectCard = {
            ticker: subject,
            name: args.name,
            cik: args.cik,
            isSubject: true,
            periodLabel: null,
            revYoy: null,
            grossMargin: null,
            opMargin: null,
            netMargin: null,
            fcfMargin: null,
          };
        }
      }

      // Peers with bounded parallelism (SEC rate limit).
      const cards: PeerScorecard[] = [subjectCard];
      const queue = [...peerTickers];
      const workers = 2;
      async function worker() {
        while (queue.length) {
          const t = queue.shift()!;
          const meta = cikMap.get(t);
          if (!meta) continue;
          try {
            const fin = await getCompanyFinancials(meta.cik, t);
            cards.push(buildPeerScorecard(fin, { isSubject: false }));
          } catch {
            // Skip peers that don't load — strip stays useful with fewer names.
          }
        }
      }
      await Promise.all(Array.from({ length: workers }, () => worker()));

      // Stable order: subject, then original peer list order.
      const order = new Map(peerTickers.map((t, i) => [t, i]));
      cards.sort((a, b) => {
        if (a.isSubject) return -1;
        if (b.isSubject) return 1;
        return (order.get(a.ticker) ?? 99) - (order.get(b.ticker) ?? 99);
      });

      return {
        subject,
        sector: args.sector,
        industry: args.industry,
        cards,
        averages: averageScorecards(cards),
        notes,
      };
    })
  );
}

export const _test = {
  resolvePeerTickers,
  buildPeerScorecard,
  averageScorecards,
  sortByMarketCapProximity,
  SECTOR_PEERS,
  INDUSTRY_PEERS,
  APPROX_MARKET_CAP,
};
