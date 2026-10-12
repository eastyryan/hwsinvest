// High-importance macro prints for the calendar and for a company.
//
// The weekly feed publishes a consensus ("forecast") and the prior release
// ("previous"). Empty strings stay empty. This module does not invent a number.

import { sectorBeta } from "./dcf-sector";

export type MacroTheme =
  | "inflation"
  | "labor"
  | "growth"
  | "rates"
  | "housing"
  | "energy"
  | "consumer";

export type MacroImpact = "High" | "Medium" | "Low" | "Holiday";

export interface MacroPrint {
  id: string;
  title: string;
  country: string;
  /** Original timestamp from the feed. */
  at: string;
  /** Calendar day in America/New_York, YYYY-MM-DD. */
  date: string;
  /** Clock time in Eastern, for example "8:30 AM ET". */
  timeEt: string;
  impact: MacroImpact;
  /** Published consensus. Null when the feed has no number. */
  forecast: string | null;
  /** Prior release. Null when the feed has no number. */
  previous: string | null;
  /** This release, once the feed prints it. */
  actual: string | null;
  themes: MacroTheme[];
}

const UNIVERSAL: MacroTheme[] = ["inflation", "labor", "growth", "rates"];

function cleanNumber(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t ? t : null;
}

export function themesForTitle(title: string): MacroTheme[] {
  const t = title.toLowerCase();
  const out: MacroTheme[] = [];
  if (/cpi|ppi|pce|inflation|price index/.test(t)) out.push("inflation");
  if (/non-farm|nonfarm|unemployment|payroll|jobless|employment change|initial jobless|claims|adp/.test(t)) {
    out.push("labor");
  }
  if (/gdp|ism |pmi|industrial production|durable goods|retail sales/.test(t)) {
    out.push("growth");
  }
  if (/fomc|fed |federal funds|interest rate|beige book|fed chair|chairman/.test(t)) {
    out.push("rates");
  }
  if (/housing|home sales|building permits|mortgage|housing starts/.test(t)) {
    out.push("housing");
  }
  if (/crude|oil invent|natural gas|petroleum|eia /.test(t)) out.push("energy");
  if (/retail sales|consumer confidence|consumer sentiment|personal spending|personal income/.test(t)) {
    out.push("consumer");
  }
  return out;
}

function asImpact(value: unknown): MacroImpact | null {
  if (value === "High" || value === "Medium" || value === "Low" || value === "Holiday") {
    return value;
  }
  return null;
}

function easternParts(iso: string): { date: string; timeEt: string } {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return { date: iso.slice(0, 10), timeEt: "" };
  }
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
  const time = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
  return { date, timeEt: `${time} ET` };
}

/** Normalize the weekly economic-calendar feed. Drops rows without a title or time. */
export function normalizeMacroRows(rows: unknown[]): MacroPrint[] {
  const byId = new Map<string, MacroPrint>();
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const rec = row as Record<string, unknown>;
    const title = typeof rec.title === "string" ? rec.title.trim() : "";
    const country = typeof rec.country === "string" ? rec.country.trim() : "";
    const at = typeof rec.date === "string" ? rec.date.trim() : "";
    const impact = asImpact(rec.impact);
    if (!title || !country || !at || !impact || impact === "Holiday") continue;
    const { date, timeEt } = easternParts(at);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const id = `${country}|${date}|${title.toLowerCase()}`;
    if (byId.has(id)) continue;
    byId.set(id, {
      id,
      title,
      country,
      at,
      date,
      timeEt,
      impact,
      forecast: cleanNumber(rec.forecast),
      previous: cleanNumber(rec.previous),
      actual: cleanNumber(rec.actual),
      themes: themesForTitle(title),
    });
  }
  return [...byId.values()].sort((a, b) => a.at.localeCompare(b.at) || a.title.localeCompare(b.title));
}

/** USD releases the feed marks High. This is the general calendar. */
export function highImportanceUsd(events: MacroPrint[]): MacroPrint[] {
  return events.filter((event) => event.country === "USD" && event.impact === "High");
}

/**
 * Themes that matter for this business.
 * Yahoo sector/industry wins. SIC is used only when both are blank.
 */
export function themesForBusiness(
  sector: string | null,
  industry: string | null,
  sic?: string | null
): MacroTheme[] {
  const named = `${sector ?? ""} ${industry ?? ""}`.trim();
  const sicName = named ? "" : (sectorBeta(sic)?.sector ?? "");
  const s = `${named} ${sicName}`.toLowerCase();
  const themes = new Set<MacroTheme>(UNIVERSAL);
  if (/energy|oil|gas|petroleum/.test(s)) themes.add("energy");
  if (/real estate|reit|homebuild|housing|construction/.test(s)) themes.add("housing");
  if (/retail|consumer|restaurant|apparel|staple/.test(s)) themes.add("consumer");
  return [...themes];
}

export function macroScopeLine(
  sector: string | null,
  industry: string | null,
  sic?: string | null
): string {
  const base =
    "High-importance US releases for the current week. Expectation is the published consensus. Last is the prior release.";
  const extras = themesForBusiness(sector, industry, sic).filter(
    (theme) => theme === "energy" || theme === "housing" || theme === "consumer"
  );
  if (extras.includes("energy")) return `${base} Energy names also list inventory prints.`;
  if (extras.includes("housing")) return `${base} Real estate names also list housing prints.`;
  if (extras.includes("consumer")) {
    return `${base} Consumer names also list confidence and spending prints.`;
  }
  return base;
}

/**
 * High-importance US releases, plus industry prints (inventories, housing,
 * confidence) when this business is exposed to them.
 */
export function macroForCompany(
  events: MacroPrint[],
  sector: string | null,
  industry: string | null,
  sic?: string | null
): MacroPrint[] {
  const themes = new Set(themesForBusiness(sector, industry, sic));
  const extra = new Set(
    [...themes].filter((theme) => !UNIVERSAL.includes(theme))
  );
  return events.filter((event) => {
    if (event.country !== "USD") return false;
    if (event.impact === "High") {
      if (event.themes.length === 0) return true;
      return event.themes.some((theme) => themes.has(theme) || UNIVERSAL.includes(theme));
    }
    return event.themes.some((theme) => extra.has(theme));
  });
}
