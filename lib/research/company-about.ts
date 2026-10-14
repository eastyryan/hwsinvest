// Company background when Yahoo's profile is missing.
//
// SEC filings have a sector and a headquarters. They do not carry a business
// description, a founding year, or the CEO. Wikipedia's intro is that
// paragraph, and Wikidata has the year (P571) and the current CEO (P169).
// A page is used only when its title matches the filer and it reads as a
// company, so a lawsuit or a namesake does not fill the card.

import { cached } from "./cache";
import { fetchJson, singleFlight } from "./http";

const WIKI_UA = "TrenchTick/1.0 (https://hwsstatements.vercel.app; easton.ryan@hws.edu)";

export interface CompanyAbout {
  description?: string;
  /** Article the paragraph was taken from. Required for the CC BY-SA extract. */
  url?: string;
  founded?: number;
  ceo?: string;
}

export interface WikiPageCandidate {
  title: string;
  index?: number;
  extract?: string;
  description?: string;
  pageprops?: { wikibase_item?: string };
}

export interface WikiClaim {
  rank?: string;
  mainsnak?: {
    snaktype?: string;
    datavalue?: { value?: { time?: string; precision?: number; id?: string } };
  };
  qualifiers?: {
    P582?: { datavalue?: { value?: { time?: string } } }[];
    P580?: { datavalue?: { value?: { time?: string } } }[];
  };
}

const TRAILING_LEGAL =
  /\s+(incorporated|inc|corporation|corp|company|co|limited|ltd|plc|llc|lp|llp|nv|sa|ag|se|holdings|holding|group)$/;

const ORG_LANGUAGE =
  /\b(company|corporation|conglomerate|multinational|headquartered|business|firm|bank|airline|retailer|manufacturer|holding|publicly traded|subsidiary|incorporated)\b/i;

/** Legal suffixes and punctuation removed, so "MICROSOFT CORP" matches "Microsoft". */
export function companyCoreName(name: string): string {
  let s = name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\([^)]*\)/g, " ")
    .replace(/[.'’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/^the\s+/, "");
  let prev = "";
  while (s !== prev) {
    prev = s;
    s = s.replace(TRAILING_LEGAL, "").trim();
  }
  return s.replace(/\s+and$/, "").trim();
}

function rejectedPage(page: WikiPageCandidate): boolean {
  const title = page.title ?? "";
  const description = page.description ?? "";
  const blob = `${title} ${description}`;
  if (/\b(v\.|vs\.?)\b/i.test(title)) return true;
  if (/disambiguation/i.test(blob)) return true;
  if (/^(list of|timeline of|history of|criticism of)\b/i.test(title)) return true;
  if (/\b(lawsuit|court case|legal case|antitrust|copyright infringement)\b/i.test(blob)) return true;
  if (/may refer to/i.test(page.extract ?? "")) return true;
  return false;
}

function looksLikeOrg(page: WikiPageCandidate): boolean {
  return ORG_LANGUAGE.test(`${page.description ?? ""} ${(page.extract ?? "").slice(0, 500)}`);
}

function nameMatch(company: string, title: string): "exact" | "prefix" | null {
  const a = companyCoreName(company);
  const b = companyCoreName(title);
  if (!a || !b) return null;
  if (a === b) return "exact";
  const shorter = a.length <= b.length ? a : b;
  const longer = a.length <= b.length ? b : a;
  if (shorter.length >= 4 && longer.startsWith(`${shorter} `)) return "prefix";
  return null;
}

/**
 * The company article, or null when every hit is a lawsuit, a list, or a
 * different thing that shares the name.
 */
export function pickCompanyPage(
  companyName: string,
  pages: WikiPageCandidate[] | null | undefined
): WikiPageCandidate | null {
  if (!companyName.trim() || !pages?.length) return null;
  let best: { page: WikiPageCandidate; score: number; index: number } | null = null;
  for (const page of pages) {
    if (!page?.title || rejectedPage(page)) continue;
    const match = nameMatch(companyName, page.title);
    if (!match) continue;
    const org = looksLikeOrg(page);
    const core = companyCoreName(companyName);
    if (!org && (match === "prefix" || core.length <= 5)) continue;
    const index = page.index ?? 99;
    const score = (match === "exact" ? 10 : 4) + (org ? 5 : 0) + Math.max(0, 4 - index);
    if (!best || score > best.score || (score === best.score && index < best.index)) {
      best = { page, score, index };
    }
  }
  return best?.page ?? null;
}

/** Drop the API's cut-off ellipsis and end on a sentence when one is available. */
export function cleanCompanyExtract(text: string | null | undefined): string | undefined {
  if (!text) return undefined;
  let s = text.replace(/\s+/g, " ").trim();
  const truncated = /(?:…|\.\.\.)\s*$/.test(s);
  s = s.replace(/\s*(?:…|\.\.\.)\s*$/, "").trim();
  if (truncated) {
    const end = s.lastIndexOf(". ");
    if (end >= 80) s = s.slice(0, end + 1);
  }
  return s.length >= 40 ? s : undefined;
}

function claimYear(time: string | undefined): number | null {
  if (!time) return null;
  const match = /^\+([0-9]{4})-/.exec(time);
  if (!match) return null;
  const year = Number(match[1]);
  const now = new Date().getFullYear();
  return year >= 1600 && year <= now ? year : null;
}

/** Year of inception. Decade-or-coarser precision is not a founding year. */
export function inceptionYear(claims: WikiClaim[] | null | undefined): number | null {
  if (!claims?.length) return null;
  const ranked = [...claims].sort((a, b) => rankWeight(b) - rankWeight(a));
  for (const claim of ranked) {
    if (claim.rank === "deprecated" || claim.mainsnak?.snaktype !== "value") continue;
    const value = claim.mainsnak.datavalue?.value;
    if ((value?.precision ?? 0) < 9) continue;
    const year = claimYear(value?.time);
    if (year != null) return year;
  }
  return null;
}

function rankWeight(claim: WikiClaim): number {
  if (claim.rank === "preferred") return 2;
  if (claim.rank === "deprecated") return 0;
  return 1;
}

/**
 * CEO who has not left. A preferred statement wins. Otherwise the latest
 * start date among statements with no end date.
 */
export function currentCeoEntityId(claims: WikiClaim[] | null | undefined): string | null {
  if (!claims?.length) return null;
  const open = claims.filter((claim) => {
    if (claim.rank === "deprecated" || claim.mainsnak?.snaktype !== "value") return false;
    if (!claim.mainsnak.datavalue?.value?.id) return false;
    return (claim.qualifiers?.P582?.length ?? 0) === 0;
  });
  if (open.length === 0) return null;
  const preferred = open.filter((claim) => claim.rank === "preferred");
  const pool = preferred.length > 0 ? preferred : open;
  pool.sort((a, b) => (claimYear(b.qualifiers?.P580?.[0]?.datavalue?.value?.time) ?? 0) -
    (claimYear(a.qualifiers?.P580?.[0]?.datavalue?.value?.time) ?? 0));
  return pool[0].mainsnak?.datavalue?.value?.id ?? null;
}

function cleanCeoLabel(label: string | undefined): string | undefined {
  if (!label) return undefined;
  const name = label.replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s+/g, " ").trim();
  if (name.length < 3 || name.length > 80) return undefined;
  if (/\d{3,}/.test(name)) return undefined;
  return name;
}

/** English label, or the Wikipedia article title when the label has not been written yet. */
export function ceoNameFromEntity(
  entity:
    | {
        labels?: { en?: { value?: string } };
        sitelinks?: { enwiki?: { title?: string } };
      }
    | null
    | undefined
): string | undefined {
  if (!entity) return undefined;
  return cleanCeoLabel(entity.labels?.en?.value) ?? cleanCeoLabel(entity.sitelinks?.enwiki?.title);
}

function wikiHeaders(): Record<string, string> {
  return { "User-Agent": WIKI_UA, Accept: "application/json" };
}

function asPages(raw: unknown): WikiPageCandidate[] {
  if (Array.isArray(raw)) return raw as WikiPageCandidate[];
  if (raw && typeof raw === "object") return Object.values(raw as Record<string, WikiPageCandidate>);
  return [];
}

async function fetchClaims(qid: string, property: string): Promise<WikiClaim[]> {
  const url = new URL("https://www.wikidata.org/w/api.php");
  url.searchParams.set("action", "wbgetclaims");
  url.searchParams.set("entity", qid);
  url.searchParams.set("property", property);
  url.searchParams.set("format", "json");
  const data = await fetchJson<{ claims?: Record<string, WikiClaim[]> }>(url.toString(), {
    source: "Wikidata",
    headers: wikiHeaders(),
    timeoutMs: 6_000,
    retries: 0,
    nullOn: [404, 429],
  });
  return data?.claims?.[property] ?? [];
}

async function ceoLabel(qid: string): Promise<string | undefined> {
  const url = new URL("https://www.wikidata.org/w/api.php");
  url.searchParams.set("action", "wbgetentities");
  url.searchParams.set("ids", qid);
  url.searchParams.set("props", "labels|sitelinks");
  url.searchParams.set("languages", "en");
  url.searchParams.set("sitefilter", "enwiki");
  url.searchParams.set("format", "json");
  const data = await fetchJson<{
    entities?: Record<
      string,
      {
        labels?: { en?: { value?: string } };
        sitelinks?: { enwiki?: { title?: string } };
      }
    >;
  }>(url.toString(), {
    source: "Wikidata",
    headers: wikiHeaders(),
    timeoutMs: 6_000,
    retries: 0,
    nullOn: [404, 429],
  });
  return ceoNameFromEntity(data?.entities?.[qid]);
}

async function lookupCompanyAbout(name: string): Promise<CompanyAbout | null> {
  const url = new URL("https://en.wikipedia.org/w/api.php");
  url.searchParams.set("action", "query");
  url.searchParams.set("format", "json");
  url.searchParams.set("formatversion", "2");
  url.searchParams.set("generator", "search");
  url.searchParams.set("gsrsearch", name);
  url.searchParams.set("gsrlimit", "6");
  url.searchParams.set("gsrnamespace", "0");
  url.searchParams.set("prop", "extracts|pageprops|description");
  url.searchParams.set("exintro", "1");
  url.searchParams.set("explaintext", "1");
  url.searchParams.set("exchars", "700");
  url.searchParams.set("ppprop", "wikibase_item");
  url.searchParams.set("redirects", "1");

  const data = await fetchJson<{ query?: { pages?: unknown } }>(url.toString(), {
    source: "Wikipedia",
    headers: wikiHeaders(),
    timeoutMs: 7_000,
    retries: 0,
    nullOn: [404, 429],
  });
  const page = pickCompanyPage(name, asPages(data?.query?.pages));
  if (!page) return null;

  const about: CompanyAbout = {};
  const description = cleanCompanyExtract(page.extract);
  if (description) {
    about.description = description;
    about.url = `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, "_"))}`;
  }

  const qid = page.pageprops?.wikibase_item;
  if (qid && /^Q[1-9]\d*$/.test(qid)) {
    try {
      const [inception, executives] = await Promise.all([
        fetchClaims(qid, "P571"),
        fetchClaims(qid, "P169"),
      ]);
      const year = inceptionYear(inception);
      if (year != null) about.founded = year;
      const ceoId = currentCeoEntityId(executives);
      if (ceoId && /^Q[1-9]\d*$/.test(ceoId)) {
        const nameLabel = await ceoLabel(ceoId);
        if (nameLabel) about.ceo = nameLabel;
      }
    } catch {
      // The paragraph still ships when Wikidata is down.
    }
  }

  return about.description || about.founded != null || about.ceo ? about : null;
}

/** Paragraph, founding year, and CEO. Null when nothing matches. Never throws. */
export async function getCompanyAbout(name: string): Promise<CompanyAbout | null> {
  const cleaned = name.trim();
  const core = companyCoreName(cleaned);
  if (core.length < 2) return null;
  const key = `companyabout:v1:${core}`;
  try {
    return await singleFlight(key, () =>
      cached(key, { ttl: 7 * 86_400, nullTtl: 600, tags: ["profile"] }, () =>
        lookupCompanyAbout(cleaned)
      )
    );
  } catch {
    return null;
  }
}
