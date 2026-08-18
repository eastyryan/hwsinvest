/**
 * Named saved model assumption slots per ticker (localStorage).
 *
 * Storage key: `modelPresets:v1:${TICKER}` (ticker uppercased).
 * Cap: 20 presets per ticker (newest retained when over cap).
 *
 * All mutators accept an optional `StorageLike` for tests / SSR. When omitted,
 * browser `localStorage` is used on the client; the server returns empty lists
 * and no-ops writes.
 */

export type ModelPreset = {
  id: string;
  name: string;
  ticker: string;
  createdAt: number;
  updatedAt: number;
  /** Opaque JSON bag for DCF/LBO/etc assumptions */
  payload: Record<string, unknown>;
};

export type StorageLike = {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem?(k: string): void;
};

const KEY_PREFIX = "modelPresets:v1:";
const MAX_PRESETS = 20;

export function presetStorageKey(ticker: string): string {
  return `${KEY_PREFIX}${normalizeTicker(ticker)}`;
}

function normalizeTicker(ticker: string): string {
  return ticker.trim().toUpperCase();
}

function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function resolveStorage(storage?: StorageLike): StorageLike | null {
  if (storage) return storage;
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function isPreset(x: unknown): x is ModelPreset {
  if (typeof x !== "object" || x === null) return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.name === "string" &&
    typeof o.ticker === "string" &&
    typeof o.createdAt === "number" &&
    typeof o.updatedAt === "number" &&
    typeof o.payload === "object" &&
    o.payload !== null &&
    !Array.isArray(o.payload)
  );
}

function parsePresets(raw: string | null): ModelPreset[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(isPreset);
}

function readList(ticker: string, store: StorageLike): ModelPreset[] {
  try {
    return parsePresets(store.getItem(presetStorageKey(ticker)));
  } catch {
    return [];
  }
}

function writeList(ticker: string, list: ModelPreset[], store: StorageLike): void {
  store.setItem(presetStorageKey(ticker), JSON.stringify(list));
}

/** List presets for a ticker. SSR-safe: empty when no storage available. */
export function listPresets(
  ticker: string,
  storage?: StorageLike
): ModelPreset[] {
  const store = resolveStorage(storage);
  if (!store) return [];
  const t = normalizeTicker(ticker);
  if (!t) return [];
  return readList(t, store).slice();
}

/**
 * Create or update a preset. When `id` matches an existing slot, that row is
 * updated in place (name / payload); otherwise a new id is assigned.
 * Enforces the 20-preset cap (drops oldest by `updatedAt` when needed).
 */
export function savePreset(
  p: Omit<ModelPreset, "id" | "createdAt" | "updatedAt"> & { id?: string },
  storage?: StorageLike
): ModelPreset {
  const store = resolveStorage(storage);
  const ticker = normalizeTicker(p.ticker);
  const now = Date.now();
  const name = typeof p.name === "string" ? p.name : "";
  const payload =
    p.payload && typeof p.payload === "object" && !Array.isArray(p.payload)
      ? { ...p.payload }
      : {};

  if (!store) {
    // SSR / no storage: return a non-persisted preset so callers still get a shape.
    return {
      id: p.id ?? newId(),
      name,
      ticker,
      createdAt: now,
      updatedAt: now,
      payload,
    };
  }

  const list = readList(ticker, store);
  const existingIdx =
    p.id != null ? list.findIndex((x) => x.id === p.id) : -1;

  let saved: ModelPreset;
  if (existingIdx >= 0) {
    const prev = list[existingIdx]!;
    saved = {
      ...prev,
      name,
      ticker,
      updatedAt: now,
      payload,
    };
    list[existingIdx] = saved;
  } else {
    saved = {
      id: p.id ?? newId(),
      name,
      ticker,
      createdAt: now,
      updatedAt: now,
      payload,
    };
    list.unshift(saved);
  }

  // Cap: keep the 20 most recently updated.
  list.sort((a, b) => b.updatedAt - a.updatedAt);
  const capped = list.slice(0, MAX_PRESETS);
  writeList(ticker, capped, store);
  return saved;
}

export function deletePreset(
  ticker: string,
  id: string,
  storage?: StorageLike
): void {
  const store = resolveStorage(storage);
  if (!store) return;
  const t = normalizeTicker(ticker);
  if (!t || !id) return;
  const list = readList(t, store).filter((x) => x.id !== id);
  writeList(t, list, store);
}

export function getPreset(
  ticker: string,
  id: string,
  storage?: StorageLike
): ModelPreset | null {
  const store = resolveStorage(storage);
  if (!store) return null;
  const t = normalizeTicker(ticker);
  if (!t || !id) return null;
  return readList(t, store).find((x) => x.id === id) ?? null;
}
