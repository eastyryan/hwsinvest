// User watchlist — local only, same external-store pattern as recent companies.

import { isValidTicker } from "./validate";

export interface WatchEntry {
  ticker: string;
  name: string;
  cik?: string;
}

const KEY = "companyWatchlist";
const MAX_WATCH = 24;

function parseWatch(raw: string | null): WatchEntry[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(
    (e): e is WatchEntry =>
      typeof e === "object" &&
      e !== null &&
      typeof (e as WatchEntry).ticker === "string" &&
      typeof (e as WatchEntry).name === "string"
  );
}

function readWatch(): WatchEntry[] {
  try {
    return parseWatch(localStorage.getItem(KEY));
  } catch {
    return [];
  }
}

const EMPTY: WatchEntry[] = [];
let snapshot: WatchEntry[] | null = null;
const listeners = new Set<() => void>();

function invalidate() {
  snapshot = null;
  for (const l of listeners) l();
}

export function subscribeWatchlist(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  const handler = () => {
    snapshot = null;
    onStoreChange();
  };
  if (typeof window !== "undefined") {
    window.addEventListener("storage", handler);
  }
  return () => {
    listeners.delete(onStoreChange);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", handler);
    }
  };
}

export function getWatchlistSnapshot(): WatchEntry[] {
  if (typeof window === "undefined") return EMPTY;
  if (snapshot === null) snapshot = readWatch();
  return snapshot;
}

export function getServerWatchlistSnapshot(): WatchEntry[] {
  return EMPTY;
}

export function isWatched(ticker: string): boolean {
  const t = ticker.toUpperCase();
  return getWatchlistSnapshot().some((e) => e.ticker.toUpperCase() === t);
}

export function toggleWatch(entry: WatchEntry): boolean {
  try {
    const list = readWatch();
    const t = entry.ticker.toUpperCase();
    const exists = list.some((e) => e.ticker.toUpperCase() === t);
    const next = exists
      ? list.filter((e) => e.ticker.toUpperCase() !== t)
      : [{ ...entry, ticker: t }, ...list].slice(0, MAX_WATCH);
    localStorage.setItem(KEY, JSON.stringify(next));
    invalidate();
    return !exists;
  } catch {
    return false;
  }
}

/**
 * Parse a shareable watchlist ticker list (query or hash).
 * Accepts comma/space/semicolon separators; uppercases and de-dupes.
 */
export function parseWatchlistShareParam(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(/[,;\s]+/)) {
    const t = part.trim().toUpperCase();
    if (!t || !isValidTicker(t) || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= MAX_WATCH) break;
  }
  return out;
}

/**
 * Merge tickers into the local watchlist. Existing entries keep name/cik;
 * new ones are added with name = ticker until a company page resolves them.
 * Returns how many were newly added.
 */
export function importWatchTickers(tickers: string[]): number {
  try {
    const list = readWatch();
    const have = new Set(list.map((e) => e.ticker.toUpperCase()));
    let added = 0;
    const next = [...list];
    for (const raw of tickers) {
      const t = raw.trim().toUpperCase();
      if (!t || !isValidTicker(t) || have.has(t)) continue;
      next.unshift({ ticker: t, name: t });
      have.add(t);
      added++;
      if (next.length >= MAX_WATCH) break;
    }
    if (added === 0) return 0;
    localStorage.setItem(KEY, JSON.stringify(next.slice(0, MAX_WATCH)));
    invalidate();
    return added;
  } catch {
    return 0;
  }
}

/** Absolute share URL for the current watchlist (`/?wl=aapl,msft`). */
export function buildWatchlistShareUrl(
  origin: string,
  tickers: string[] = getWatchlistSnapshot().map((e) => e.ticker)
): string {
  const list = tickers
    .map((t) => t.trim().toLowerCase())
    .filter((t) => isValidTicker(t))
    .slice(0, MAX_WATCH);
  const base = origin.replace(/\/$/, "");
  if (list.length === 0) return `${base}/`;
  return `${base}/?wl=${list.join(",")}`;
}

/**
 * Read shareable watchlist tickers from the current location.
 * Supports `?wl=` query and `#watch=` / `#wl=` hash forms.
 */
export function readWatchlistShareFromLocation(
  search: string,
  hash: string
): string[] {
  // Query: ?wl=aapl,msft
  if (search) {
    const q = search.startsWith("?") ? search.slice(1) : search;
    const params = new URLSearchParams(q);
    const wl = params.get("wl") ?? params.get("watch");
    const parsed = parseWatchlistShareParam(wl);
    if (parsed.length) return parsed;
  }
  // Hash: #watch=aapl,msft or #wl=aapl,msft
  if (hash) {
    const h = hash.startsWith("#") ? hash.slice(1) : hash;
    if (h.startsWith("watch=") || h.startsWith("wl=")) {
      const value = h.slice(h.indexOf("=") + 1);
      return parseWatchlistShareParam(decodeURIComponent(value));
    }
    // #watch?aapl style is not supported; keep parse simple.
  }
  return [];
}

export function listWatch(): WatchEntry[] {
  return getWatchlistSnapshot();
}

/**
 * Patch name/cik on an existing watch entry without toggling.
 * Used to backfill CIK after search resolution or when the company page
 * re-mounts with a known cik for an older watchlist item.
 */
export function patchWatchEntry(
  ticker: string,
  patch: { name?: string; cik?: string }
): void {
  try {
    const list = readWatch();
    const t = ticker.toUpperCase();
    let changed = false;
    const next = list.map((e) => {
      if (e.ticker.toUpperCase() !== t) return e;
      const updated: WatchEntry = { ...e };
      if (patch.cik && patch.cik !== e.cik) {
        updated.cik = patch.cik;
        changed = true;
      }
      if (patch.name && patch.name !== e.name) {
        updated.name = patch.name;
        changed = true;
      }
      return updated;
    });
    if (!changed) return;
    localStorage.setItem(KEY, JSON.stringify(next));
    invalidate();
  } catch {
    // private mode
  }
}
