// Shared upstream-fetch policy: timeouts, bounded retries with backoff and
// jitter, and a client-side rate limiter for SEC's fair-access rules.
//
// Every outbound call in this app goes through fetchJson(). Nothing else should
// call global fetch() against a third party — without a timeout a hung upstream
// pins the function for the whole maxDuration budget.

export class UpstreamError extends Error {
  readonly status: number;
  /** Safe to show a user: upstream bodies can echo request context (API keys). */
  readonly publicMessage: string;

  constructor(source: string, status: number, publicMessage?: string) {
    super(`${source} responded ${status}`);
    this.name = "UpstreamError";
    this.status = status;
    this.publicMessage =
      publicMessage ??
      (status === 429 || status === 403
        ? `${source} is rate limiting us right now. Try again in a moment.`
        : `${source} is temporarily unavailable.`);
  }
}

export class TimeoutError extends Error {
  readonly publicMessage: string;
  constructor(source: string, ms: number) {
    super(`${source} timed out after ${ms}ms`);
    this.name = "TimeoutError";
    this.publicMessage = `${source} took too long to respond.`;
  }
}

/**
 * Serializes calls to a host and enforces a minimum gap between them.
 * SEC's documented limit is 10 req/s per IP, with hard 403 blocking above it.
 * Serverless instances share egress IPs, so we stay well under.
 */
class RateLimiter {
  private queue: Promise<void> = Promise.resolve();
  constructor(private readonly minGapMs: number) {}

  run<T>(fn: () => Promise<T>): Promise<T> {
    const result = this.queue.then(fn);
    // Advance the chain regardless of whether fn resolved or rejected, so one
    // failure doesn't wedge the queue forever.
    this.queue = result.then(
      () => sleep(this.minGapMs),
      () => sleep(this.minGapMs)
    );
    return result;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ~6 req/s, comfortably inside SEC's 10 req/s ceiling.
const secLimiter = new RateLimiter(160);

const RETRYABLE = new Set([408, 425, 429, 500, 502, 503, 504]);

export interface FetchJsonOptions {
  /** Label used in error messages, e.g. "SEC EDGAR". */
  source: string;
  headers?: Record<string, string>;
  timeoutMs?: number;
  retries?: number;
  /** Route through the SEC rate limiter. */
  rateLimit?: "sec" | null;
  /** Treat these statuses as a null result rather than an error. */
  nullOn?: number[];
}

export async function fetchJson<T>(
  url: string,
  opts: FetchJsonOptions
): Promise<T | null> {
  const {
    source,
    headers = {},
    timeoutMs = 10_000,
    retries = 2,
    rateLimit = null,
    nullOn = [],
  } = opts;

  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      // Exponential backoff with jitter, so concurrent instances don't retry in
      // lockstep and re-trigger the same rate limit.
      const base = 300 * 2 ** (attempt - 1);
      await sleep(base + Math.random() * base);
    }

    const call = async (): Promise<T | null> => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetch(url, {
          headers,
          signal: controller.signal,
          // We manage caching ourselves in lib/cache.ts. Next's fetch Data Cache
          // silently drops entries over 2MB, which is most SEC payloads.
          cache: "no-store",
        });
        if (nullOn.includes(res.status)) return null;
        if (!res.ok) throw new UpstreamError(source, res.status);
        return (await res.json()) as T;
      } finally {
        clearTimeout(timer);
      }
    };

    try {
      return rateLimit === "sec" ? await secLimiter.run(call) : await call();
    } catch (e) {
      lastError = e;
      if (e instanceof DOMException && e.name === "AbortError") {
        lastError = new TimeoutError(source, timeoutMs);
      }
      const status = e instanceof UpstreamError ? e.status : null;
      // Don't burn retries on errors that will never succeed (404, 400, ...).
      if (status !== null && !RETRYABLE.has(status)) throw e;
    }
  }

  throw lastError;
}

/**
 * Collapses concurrent calls for the same key into one in-flight promise.
 * Without this, N simultaneous cold requests for the same company each trigger
 * their own multi-megabyte SEC download.
 */
const inFlight = new Map<string, Promise<unknown>>();

export function singleFlight<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = inFlight.get(key);
  if (existing) return existing as Promise<T>;
  const p = fn().finally(() => inFlight.delete(key));
  inFlight.set(key, p);
  return p;
}

/** Message safe to return to a client — never leaks upstream response bodies. */
export function publicErrorMessage(e: unknown, fallback: string): string {
  if (e instanceof UpstreamError || e instanceof TimeoutError) {
    return e.publicMessage;
  }
  return fallback;
}
