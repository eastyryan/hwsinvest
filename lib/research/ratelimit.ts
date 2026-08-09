// Minimal per-IP fixed-window rate limiter.
//
// Primarily guards the AI summary endpoint, which spends real money per call:
// without this, a script iterating CIKs runs up an Anthropic bill.
//
// State is per-instance, so this is a speed bump rather than a hard guarantee,
// a distributed limiter needs shared storage. It still removes the trivial
// abuse case, and the response cache absorbs most repeat traffic.

import { ipAddress } from "@vercel/functions";

interface Window {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Window>();
const MAX_BUCKETS = 5_000;

export interface RateLimitResult {
  ok: boolean;
  retryAfterSeconds: number;
}

export function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || now >= existing.resetAt) {
    // Sweeping only expired windows cannot bound the map: a caller rotating
    // addresses creates unexpired buckets faster than any expire. Evict the
    // soonest-to-reset entries once over the cap, expired or not.
    if (buckets.size > MAX_BUCKETS) {
      for (const [k, w] of buckets) if (now >= w.resetAt) buckets.delete(k);
      if (buckets.size > MAX_BUCKETS) {
        const oldest = [...buckets.entries()]
          .sort((a, b) => a[1].resetAt - b[1].resetAt)
          .slice(0, buckets.size - MAX_BUCKETS);
        for (const [k] of oldest) buckets.delete(k);
      }
    }
    buckets.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return { ok: true, retryAfterSeconds: 0 };
  }

  existing.count += 1;
  if (existing.count > limit) {
    return {
      ok: false,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }
  return { ok: true, retryAfterSeconds: 0 };
}

/**
 * Client identity for rate limiting.
 *
 * Uses the platform-resolved address rather than the leftmost X-Forwarded-For
 * entry. The leftmost entry is client-asserted wherever a proxy appends rather
 * than replaces the header, which is the classic spoofable pattern; Vercel
 * overwrites it today, so this is hardening rather than a live hole.
 *
 * IPv6 addresses bucket on the /64 prefix. A client with a routed /64 has 2^64
 * source addresses, so limiting on the full address is limiting on nothing.
 */
export function clientKey(req: Request): string {
  const ip = ipAddress(req) ?? req.headers.get("x-real-ip") ?? "unknown";
  if (ip.includes(":")) {
    const parts = ip.split(":");
    return parts.slice(0, 4).join(":") + "::/64";
  }
  return ip;
}
