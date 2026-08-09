// Two-tier cache: a bounded per-instance LRU in front of Vercel's Runtime Cache.
//
// Why not Next's fetch Data Cache: it silently drops any entry over 2MB
// (node_modules/next/dist/server/lib/incremental-cache/index.js), and SEC
// companyfacts payloads are routinely 10-50MB for large filers. The
// `next: { revalidate }` hints previously used here were no-ops in production.
//
// The Runtime Cache has the same 2MB item limit, so we cache the *normalized*
// output rather than the raw upstream payload. That stays comfortably under the
// limit and also skips the expensive re-parse on a hit.

import { getCache } from "@vercel/functions";

interface Entry<T> {
  value: T;
  expiresAt: number;
}

/** Bounded LRU. Unbounded module-level Maps leak on long-lived instances. */
class Lru<T> {
  private map = new Map<string, Entry<T>>();
  constructor(private readonly maxEntries: number) {}

  get(key: string): T | null {
    const hit = this.map.get(key);
    if (!hit) return null;
    if (Date.now() > hit.expiresAt) {
      this.map.delete(key);
      return null;
    }
    // Re-insert to mark as most-recently-used.
    this.map.delete(key);
    this.map.set(key, hit);
    return hit.value;
  }

  set(key: string, value: T, ttlSeconds: number): void {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
    while (this.map.size > this.maxEntries) {
      const oldest = this.map.keys().next().value;
      if (oldest === undefined) break;
      this.map.delete(oldest);
    }
  }
}

// Normalized financials run a few hundred KB each; 24 keeps a working set of
// recently-viewed companies without meaningful memory pressure.
const memory = new Lru<unknown>(24);

/** Runtime Cache is unavailable outside Vercel (local dev, tests). */
function runtimeCache(): ReturnType<typeof getCache> | null {
  try {
    return getCache();
  } catch {
    return null;
  }
}

export interface CachedOptions {
  /** Seconds. Applied to both tiers. */
  ttl: number;
  /** Runtime Cache tags, for later invalidation. */
  tags?: string[];
  /**
   * Seconds to keep a `null` result. Shorter than `ttl` by default: a null is
   * usually an upstream that is down or blocking us, and pinning that for the
   * full window would outlast the outage.
   */
  nullTtl?: number;
}

/**
 * Values are boxed before storage so a cached `null` is distinguishable from a
 * cache miss.
 *
 * Storing the bare value made `null` unreadable: three call sites return null on
 * their normal path: the AI summary on a refusal, the Yahoo profile whenever
 * its crumb handshake fails, the SEC profile on a 404, and each re-ran on every
 * single request forever. Yahoo's handshake is blocked from datacenter IPs, so
 * in production that meant two uncached upstream fetches per page view that
 * could never succeed, and a null AI summary meant a fresh Opus call per
 * request.
 */
interface Boxed<T> {
  v: T;
}

/**
 * Read-through cache. On miss, runs `fn`, stores the result in both tiers, and
 * returns it. Concurrent misses for the same key are collapsed by the caller
 * via singleFlight().
 *
 * Cache failures are never fatal: a broken cache degrades to a slow request,
 * not an error.
 */
export async function cached<T>(
  key: string,
  opts: CachedOptions,
  fn: () => Promise<T>
): Promise<T> {
  const hit = memory.get(key) as Boxed<T> | null;
  if (hit !== null) return hit.v;

  const remote = runtimeCache();
  if (remote) {
    try {
      const boxed = (await remote.get(key)) as Boxed<T> | null | undefined;
      // `undefined` is the miss sentinel; a stored box carrying null is a hit.
      if (boxed !== null && boxed !== undefined && typeof boxed === "object" && "v" in boxed) {
        memory.set(key, boxed, opts.ttl);
        return boxed.v;
      }
    } catch (e) {
      console.warn(`[cache] runtime cache read failed for ${key}:`, e);
    }
  }

  const value = await fn();
  const ttl = value === null ? (opts.nullTtl ?? Math.min(opts.ttl, 300)) : opts.ttl;
  const boxed: Boxed<T> = { v: value };
  memory.set(key, boxed, ttl);

  if (remote) {
    try {
      await remote.set(key, boxed, { ttl, tags: opts.tags });
    } catch (e) {
      // Most likely the 2MB item limit. Worth surfacing, it means this key is
      // effectively memory-only and will miss across instances.
      console.warn(`[cache] runtime cache write failed for ${key}:`, e);
    }
  }

  return value;
}
