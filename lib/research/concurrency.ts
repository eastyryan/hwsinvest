// A bounded gate for expensive in-process work.
//
// Vercel's Fluid Compute reuses one instance across concurrent invocations, so
// they share a heap. Building an Excel workbook costs roughly 17 MB of heap and
// 21 MB of RSS while it runs — measured, not estimated — and scales linearly
// with concurrency. Against a ~240 MB baseline that puts the OOM-kill at about
// 37 simultaneous builds on a 1 GB function and 86 on 2 GB.
//
// An OOM kill takes down every request the instance is serving, not just the
// ones over the line, so the failure mode is far worse than the load that
// caused it. A gate converts that into a small number of explicit 503s.

export interface Gate {
  /**
   * Wait up to `timeoutMs` for a slot. Resolves to a release function, or null
   * if the wait expired.
   *
   * A short wait rather than an immediate rejection: real traffic arrives in
   * bursts that clear in well under a second, and rejecting those would be
   * needlessly hostile. The wait is bounded so a queued request can never
   * outlive the function's own budget.
   */
  acquire(timeoutMs: number): Promise<(() => void) | null>;
  /** In-flight count, for diagnostics. */
  active(): number;
}

export function createGate(limit: number): Gate {
  let active = 0;
  const waiters: { resolve: (v: (() => void) | null) => void; timer: ReturnType<typeof setTimeout> }[] = [];

  function release() {
    active--;
    const next = waiters.shift();
    if (next) {
      clearTimeout(next.timer);
      active++;
      next.resolve(release);
    }
  }

  return {
    active: () => active,
    acquire(timeoutMs: number) {
      if (active < limit) {
        active++;
        return Promise.resolve(release);
      }
      return new Promise<(() => void) | null>((resolve) => {
        const entry = {
          resolve,
          timer: setTimeout(() => {
            const i = waiters.indexOf(entry);
            if (i >= 0) waiters.splice(i, 1);
            resolve(null);
          }, timeoutMs),
        };
        waiters.push(entry);
      });
    },
  };
}
