/**
 * Client-side alerts store (localStorage) — free, no server.
 *
 * Price-move events are produced by diffing saved snapshots against a fresh
 * quote list. Watchlist notes / Form 4 hints can be appended by callers.
 */

export type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
};

export type AlertEvent = {
  id: string;
  type: "price_move" | "watchlist_note" | "form4_hint";
  ticker: string;
  title: string;
  body: string;
  createdAt: number;
  read: boolean;
};

export type PriceSnapshot = { ticker: string; price: number; at: number };

const ALERTS_KEY = "financeAlerts";
const SNAPS_KEY = "financePriceSnapshots";
const MAX_ALERTS = 100;
const DEFAULT_THRESHOLD_PCT = 0.05;

function defaultStorage(): StorageLike | null {
  try {
    if (typeof localStorage !== "undefined") return localStorage;
  } catch {
    /* private mode / SSR */
  }
  return null;
}

function resolveStorage(storage?: StorageLike): StorageLike | null {
  return storage ?? defaultStorage();
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function isAlertEvent(e: unknown): e is AlertEvent {
  if (typeof e !== "object" || e === null) return false;
  const o = e as AlertEvent;
  return (
    typeof o.id === "string" &&
    (o.type === "price_move" ||
      o.type === "watchlist_note" ||
      o.type === "form4_hint") &&
    typeof o.ticker === "string" &&
    typeof o.title === "string" &&
    typeof o.body === "string" &&
    typeof o.createdAt === "number" &&
    typeof o.read === "boolean"
  );
}

function isPriceSnapshot(e: unknown): e is PriceSnapshot {
  if (typeof e !== "object" || e === null) return false;
  const o = e as PriceSnapshot;
  return (
    typeof o.ticker === "string" &&
    typeof o.price === "number" &&
    Number.isFinite(o.price) &&
    typeof o.at === "number" &&
    Number.isFinite(o.at)
  );
}

function parseJsonArray(raw: string | null): unknown[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function loadAlerts(storage?: StorageLike): AlertEvent[] {
  const s = resolveStorage(storage);
  if (!s) return [];
  try {
    return parseJsonArray(s.getItem(ALERTS_KEY)).filter(isAlertEvent);
  } catch {
    return [];
  }
}

export function saveAlerts(events: AlertEvent[], storage?: StorageLike): void {
  const s = resolveStorage(storage);
  if (!s) return;
  try {
    const trimmed = events.filter(isAlertEvent).slice(0, MAX_ALERTS);
    s.setItem(ALERTS_KEY, JSON.stringify(trimmed));
  } catch {
    /* quota / private mode */
  }
}

export function markAlertRead(id: string, storage?: StorageLike): void {
  const events = loadAlerts(storage);
  let changed = false;
  for (const e of events) {
    if (e.id === id && !e.read) {
      e.read = true;
      changed = true;
    }
  }
  if (changed) saveAlerts(events, storage);
}

export function clearAlerts(storage?: StorageLike): void {
  const s = resolveStorage(storage);
  if (!s) return;
  try {
    if (s.removeItem) s.removeItem(ALERTS_KEY);
    else s.setItem(ALERTS_KEY, "[]");
  } catch {
    /* ignore */
  }
}

/**
 * Compare previous vs current prices; emit events when abs change ≥ thresholdPct
 * (default 5%). Only tickers present in both lists with finite prices are considered.
 */
export function diffPriceSnapshots(
  prev: PriceSnapshot[],
  next: PriceSnapshot[],
  thresholdPct: number = DEFAULT_THRESHOLD_PCT
): AlertEvent[] {
  const thr =
    typeof thresholdPct === "number" && Number.isFinite(thresholdPct) && thresholdPct >= 0
      ? thresholdPct
      : DEFAULT_THRESHOLD_PCT;

  const prevBy = new Map<string, PriceSnapshot>();
  for (const p of prev) {
    if (!p?.ticker || !Number.isFinite(p.price) || p.price <= 0) continue;
    prevBy.set(p.ticker.toUpperCase(), p);
  }

  const out: AlertEvent[] = [];
  const seen = new Set<string>();

  for (const n of next) {
    if (!n?.ticker || !Number.isFinite(n.price) || n.price <= 0) continue;
    const t = n.ticker.toUpperCase();
    if (seen.has(t)) continue;
    seen.add(t);

    const p = prevBy.get(t);
    if (!p) continue;

    const change = (n.price - p.price) / p.price;
    if (!Number.isFinite(change) || Math.abs(change) < thr) continue;

    const pct = change * 100;
    const dir = change > 0 ? "up" : "down";
    const pctAbs = Math.abs(pct);
    const pctStr =
      pctAbs >= 10 ? pctAbs.toFixed(0) : pctAbs.toFixed(1);

    out.push({
      id: makeId(`pm-${t}`),
      type: "price_move",
      ticker: t,
      title: `${t} ${dir} ${pctStr}%`,
      body: `${t} moved from ${formatPrice(p.price)} to ${formatPrice(n.price)} (${change > 0 ? "+" : ""}${pct.toFixed(1)}%).`,
      createdAt: Number.isFinite(n.at) ? n.at : Date.now(),
      read: false,
    });
  }

  return out;
}

function formatPrice(p: number): string {
  if (p >= 1000) return p.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (p >= 1) return p.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return p.toLocaleString("en-US", { maximumFractionDigits: 4 });
}

export function loadPriceSnapshots(storage?: StorageLike): PriceSnapshot[] {
  const s = resolveStorage(storage);
  if (!s) return [];
  try {
    return parseJsonArray(s.getItem(SNAPS_KEY)).filter(isPriceSnapshot);
  } catch {
    return [];
  }
}

export function savePriceSnapshots(
  snaps: PriceSnapshot[],
  storage?: StorageLike
): void {
  const s = resolveStorage(storage);
  if (!s) return;
  try {
    const clean = snaps.filter(isPriceSnapshot).map((x) => ({
      ticker: x.ticker.toUpperCase(),
      price: x.price,
      at: x.at,
    }));
    s.setItem(SNAPS_KEY, JSON.stringify(clean));
  } catch {
    /* ignore */
  }
}
