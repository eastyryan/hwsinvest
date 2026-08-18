"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowsClockwise, LinkSimple, Star } from "@phosphor-icons/react";
import type { CompanyFinancials } from "@/lib/research/edgar";
import { fmtPct, fmtValue } from "@/lib/research/format";
import { shouldIgnoreShortcut, watchlistNavDelta } from "@/lib/research/keyboard";
import {
  buildVisitSnapshot,
  diffSnapshots,
  loadVisitSnapshot,
} from "@/lib/research/visit-snapshot";
import {
  buildWatchlistShareUrl,
  getServerWatchlistSnapshot,
  getWatchlistSnapshot,
  importWatchTickers,
  patchWatchEntry,
  readWatchlistShareFromLocation,
  subscribeWatchlist,
  type WatchEntry,
} from "@/lib/research/watchlist";

type LoadStatus = "idle" | "loading" | "ready" | "error";

interface RowMetrics {
  status: LoadStatus;
  revYoy: number | null;
  /** Prefer net margin; fall back shown via opMargin. */
  netMargin: number | null;
  opMargin: number | null;
  fcf: number | null;
  fcfMargin: number | null;
  periodLabel: string | null;
  sinceVisit: string | null;
  /** Material metric move vs last visit snapshot. */
  alertMoved: boolean;
  /** New filing period vs stored snapshot periodKey. */
  alertNewPeriod: boolean;
  error?: string;
}

const CONCURRENCY = 3;
const IDLE: RowMetrics = {
  status: "idle",
  revYoy: null,
  netMargin: null,
  opMargin: null,
  fcf: null,
  fcfMargin: null,
  periodLabel: null,
  sinceVisit: null,
  alertMoved: false,
  alertNewPeriod: false,
};

async function resolveCik(
  ticker: string,
  known?: string
): Promise<{ cik: string; name?: string } | null> {
  if (known) return { cik: known };
  try {
    const s = await fetch(`/api/research/search?q=${encodeURIComponent(ticker)}`);
    if (!s.ok) return null;
    const body = (await s.json()) as {
      results?: { cik: string; ticker: string; name: string }[];
    };
    const hit = (body.results ?? []).find(
      (h) => h.ticker.toUpperCase() === ticker.toUpperCase()
    );
    if (!hit) return null;
    return { cik: hit.cik, name: hit.name };
  } catch {
    return null;
  }
}

function summarizeSinceVisit(fin: CompanyFinancials): {
  text: string;
  alertMoved: boolean;
  alertNewPeriod: boolean;
} {
  const current = buildVisitSnapshot(fin);
  const prev = loadVisitSnapshot(fin.ticker);
  if (!prev || prev.ticker !== fin.ticker.toUpperCase()) {
    return { text: "No prior visit", alertMoved: false, alertNewPeriod: false };
  }
  const diff = diffSnapshots(prev, current);
  const top = diff.deltas.slice(0, 2).map((d) => {
    if (d.format === "pct" && d.levelDelta != null) {
      const pp = (d.levelDelta * 100).toFixed(1);
      return `${d.label} ${d.levelDelta > 0 ? "+" : ""}${pp}pp`;
    }
    if (d.yoyDeltaPp != null) {
      const pp = (d.yoyDeltaPp * 100).toFixed(1);
      return `${d.label} YoY ${d.yoyDeltaPp > 0 ? "+" : ""}${pp}pp`;
    }
    return d.label;
  });
  let text: string;
  if (top.length > 0) text = top.join(" · ");
  else if (diff.periodChanged) text = diff.headline;
  else text = "No material move";
  if (diff.daysSince != null && diff.daysSince > 0) {
    text += ` · ${diff.daysSince}d`;
  }
  return {
    text,
    alertMoved: diff.deltas.length > 0,
    alertNewPeriod: diff.periodChanged,
  };
}

function metricsFromFinancials(fin: CompanyFinancials): Omit<RowMetrics, "status" | "error"> {
  const snap = buildVisitSnapshot(fin);
  const get = (key: string) => snap.metrics.find((m) => m.key === key);
  const since = summarizeSinceVisit(fin);
  return {
    revYoy: get("revenue")?.yoy ?? null,
    netMargin: get("netMargin")?.value ?? null,
    opMargin: get("opMargin")?.value ?? null,
    fcf: get("fcf")?.value ?? null,
    fcfMargin: get("fcfMargin")?.value ?? null,
    periodLabel: snap.periodLabel,
    sinceVisit: since.text,
    alertMoved: since.alertMoved,
    alertNewPeriod: since.alertNewPeriod,
  };
}

function yoyTone(v: number | null): string {
  if (v == null) return "text-zinc-500 dark:text-zinc-400";
  if (v > 0.001) return "text-emerald-700 dark:text-emerald-400";
  if (v < -0.001) return "text-red-700 dark:text-red-400";
  return "text-zinc-500 dark:text-zinc-400";
}

function fmtMargin(v: number | null): string {
  if (v == null) return "—";
  return `${(v * 100).toFixed(1)}%`;
}

function sinceTone(text: string | null): string {
  if (!text || text === "No prior visit" || text.startsWith("No material")) {
    return "text-zinc-500 dark:text-zinc-400";
  }
  if (/\+\d/.test(text) && !/-\d/.test(text)) {
    return "text-emerald-700 dark:text-emerald-400";
  }
  if (/-\d/.test(text) && !/\+\d/.test(text)) {
    return "text-red-700 dark:text-red-400";
  }
  return "text-zinc-700 dark:text-zinc-300";
}

function AlertBadges({
  moved,
  newPeriod,
}: {
  moved: boolean;
  newPeriod: boolean;
}) {
  if (!moved && !newPeriod) return null;
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {newPeriod && (
        <span
          className="rounded border border-sky-400/50 bg-sky-50 px-1 py-px text-[10px] font-semibold uppercase tracking-wide text-sky-800 dark:bg-sky-950/50 dark:text-sky-200"
          title="Filing period changed since your last visit snapshot"
        >
          New period
        </span>
      )}
      {moved && (
        <span
          className="rounded border border-amber-400/50 bg-amber-50 px-1 py-px text-[10px] font-semibold uppercase tracking-wide text-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
          title="Material move in watched metrics vs last visit"
        >
          Moved
        </span>
      )}
    </span>
  );
}

export default function WatchlistDashboard({
  shifted = false,
}: {
  shifted?: boolean;
} = {}) {
  const watchlist = useSyncExternalStore(
    subscribeWatchlist,
    getWatchlistSnapshot,
    getServerWatchlistSnapshot
  );
  const [metrics, setMetrics] = useState<Record<string, RowMetrics>>({});
  const [bulkLoading, setBulkLoading] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [importOffer, setImportOffer] = useState<string[] | null>(null);
  const [importNote, setImportNote] = useState<string | null>(null);
  const [focusedIdx, setFocusedIdx] = useState(0);
  const runId = useRef(0);
  const importHandled = useRef(false);
  const sectionRef = useRef<HTMLElement>(null);
  const router = useRouter();

  // J/K when focus is inside the watchlist: move between row links.
  useEffect(() => {
    if (watchlist.length < 2) return;

    function onKeyDown(e: KeyboardEvent) {
      if (shouldIgnoreShortcut(e)) return;
      const section = sectionRef.current;
      if (!section || !section.contains(document.activeElement)) return;
      const delta = watchlistNavDelta(e);
      if (delta == null) return;
      e.preventDefault();
      setFocusedIdx((prev) => {
        const next = (prev + delta + watchlist.length) % watchlist.length;
        const t = watchlist[next]?.ticker;
        if (t) {
          requestAnimationFrame(() => {
            const link = section.querySelector<HTMLElement>(
              `[data-watch-ticker="${CSS.escape(t.toUpperCase())}"]`
            );
            link?.focus();
          });
        }
        return next;
      });
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [watchlist]);

  // Shareable URL: ?wl=aapl,msft or #watch=aapl,msft — offer import once per load.
  useEffect(() => {
    if (importHandled.current) return;
    if (typeof window === "undefined") return;
    const shared = readWatchlistShareFromLocation(
      window.location.search,
      window.location.hash
    );
    if (shared.length === 0) {
      importHandled.current = true;
      return;
    }
    const have = new Set(
      getWatchlistSnapshot().map((e) => e.ticker.toUpperCase())
    );
    const missing = shared.filter((t) => !have.has(t));
    importHandled.current = true;
    if (missing.length === 0) {
      setImportNote(
        `Share link: all ${shared.length} ticker${shared.length === 1 ? "" : "s"} already on your watchlist.`
      );
      return;
    }
    setImportOffer(missing);
  }, []);

  const acceptImport = useCallback(() => {
    if (!importOffer?.length) return;
    const n = importWatchTickers(importOffer);
    setImportOffer(null);
    setImportNote(
      n > 0
        ? `Imported ${n} ticker${n === 1 ? "" : "s"} into your local watchlist.`
        : "Nothing new to import."
    );
    // Strip share params so a refresh doesn't re-prompt.
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete("wl");
      url.searchParams.delete("watch");
      if (url.hash.startsWith("#watch=") || url.hash.startsWith("#wl=")) {
        url.hash = "";
      }
      window.history.replaceState(null, "", url.pathname + url.search + url.hash);
    } catch {
      // ignore
    }
  }, [importOffer]);

  const dismissImport = useCallback(() => {
    setImportOffer(null);
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete("wl");
      url.searchParams.delete("watch");
      if (url.hash.startsWith("#watch=") || url.hash.startsWith("#wl=")) {
        url.hash = "";
      }
      window.history.replaceState(null, "", url.pathname + url.search + url.hash);
    } catch {
      // ignore
    }
  }, []);

  const copyShareLink = useCallback(async () => {
    try {
      const url = buildWatchlistShareUrl(window.location.origin);
      await navigator.clipboard.writeText(url);
      setShareCopied(true);
      window.setTimeout(() => setShareCopied(false), 2000);
    } catch {
      // private mode / denied
    }
  }, []);

  const setRow = useCallback((ticker: string, row: RowMetrics) => {
    setMetrics((prev) => ({ ...prev, [ticker.toUpperCase()]: row }));
  }, []);

  const loadAll = useCallback(async () => {
    const list = getWatchlistSnapshot();
    if (list.length === 0) return;

    const id = ++runId.current;
    setBulkLoading(true);

    // Mark every row loading up front so the table updates immediately.
    setMetrics((prev) => {
      const next = { ...prev };
      for (const e of list) {
        const k = e.ticker.toUpperCase();
        next[k] = { ...(next[k] ?? IDLE), status: "loading" };
      }
      return next;
    });

    const queue = [...list];
    async function worker() {
      while (queue.length) {
        if (runId.current !== id) return;
        const entry = queue.shift()!;
        const key = entry.ticker.toUpperCase();
        try {
          const resolved = await resolveCik(entry.ticker, entry.cik);
          if (runId.current !== id) return;
          if (!resolved) {
            setRow(key, {
              ...IDLE,
              status: "error",
              error: "CIK not found",
              sinceVisit: null,
            });
            continue;
          }
          if (!entry.cik || resolved.name) {
            patchWatchEntry(entry.ticker, {
              cik: resolved.cik,
              ...(resolved.name ? { name: resolved.name } : {}),
            });
          }
          const res = await fetch(
            `/api/research/financials/${resolved.cik}?ticker=${encodeURIComponent(entry.ticker)}`
          );
          if (runId.current !== id) return;
          if (!res.ok) {
            setRow(key, {
              ...IDLE,
              status: "error",
              error: "Failed to load",
            });
            continue;
          }
          const fin = (await res.json()) as CompanyFinancials;
          setRow(key, { status: "ready", ...metricsFromFinancials(fin) });
        } catch {
          if (runId.current !== id) return;
          setRow(key, {
            ...IDLE,
            status: "error",
            error: "Failed to load",
          });
        }
      }
    }

    const workers = Math.min(CONCURRENCY, list.length);
    await Promise.all(Array.from({ length: workers }, () => worker()));
    if (runId.current === id) setBulkLoading(false);
  }, [setRow]);

  const anyReady = watchlist.some(
    (e) => metrics[e.ticker.toUpperCase()]?.status === "ready"
  );
  const anyIdle = watchlist.some((e) => {
    const s = metrics[e.ticker.toUpperCase()]?.status;
    return s == null || s === "idle";
  });

  if (watchlist.length === 0 && !importOffer) {
    return (
      <section
        className="animate-rise mt-8 w-full max-w-4xl [animation-delay:280ms]"
        aria-label="Watchlist"
      >
        {importNote && (
          <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">{importNote}</p>
        )}
        <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50/50 px-4 py-6 text-center dark:border-zinc-700 dark:bg-zinc-950/40">
          <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-100 text-amber-600 dark:bg-zinc-800 dark:text-amber-400">
            <Star size={18} weight="bold" aria-hidden />
          </div>
          <h2 className="mt-3 text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            Watchlist is empty
          </h2>
          <p className="mx-auto mt-1 max-w-sm text-xs text-zinc-500 dark:text-zinc-400">
            Star a company on its page to pin it here. Metrics and “since last
            visit” signals load on demand — nothing hits the SEC until you ask.
            Share links use <span className="font-mono">/?wl=aapl,msft</span>.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section
      ref={sectionRef}
      className="animate-rise mt-6 w-full max-w-4xl min-w-0 transition-[margin,opacity] duration-200 ease-out motion-reduce:transition-none sm:mt-8 [animation-delay:280ms]"
      style={{
        marginTop: shifted ? 28 : undefined,
        opacity: shifted ? 0.92 : 1,
      }}
      aria-label="Watchlist"
    >
      {importOffer && importOffer.length > 0 && (
        <div
          className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-300/70 bg-amber-50/80 px-3 py-2.5 dark:border-amber-800 dark:bg-amber-950/40"
          role="status"
        >
          <p className="text-xs text-amber-950 dark:text-amber-100">
            Import{" "}
            <span className="font-semibold">{importOffer.length}</span> ticker
            {importOffer.length === 1 ? "" : "s"} from share link (
            <span className="font-mono">
              {importOffer.slice(0, 6).join(", ")}
              {importOffer.length > 6 ? "…" : ""}
            </span>
            )? Local only — stored in this browser.
          </p>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={dismissImport}
              className="rounded-lg border-[0.5px] border-zinc-300 bg-white px-2.5 py-1 text-xs font-medium text-zinc-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300 dark:focus-visible:outline-zinc-100"
            >
              Dismiss
            </button>
            <button
              type="button"
              onClick={acceptImport}
              className="rounded-lg bg-zinc-900 px-2.5 py-1 text-xs font-medium text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 dark:focus-visible:outline-zinc-100"
            >
              Import {importOffer.length}
            </button>
          </div>
        </div>
      )}
      {importNote && !importOffer && (
        <p className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">{importNote}</p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
            <Star size={16} weight="fill" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
              Watchlist
            </h2>
            <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
              {watchlist.length} {watchlist.length === 1 ? "company" : "companies"}
              {anyReady ? " · metrics loaded" : " · metrics on demand"}
              {watchlist.length >= 2 ? " · J/K when focused" : ""}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {watchlist.length > 0 && (
            <button
              type="button"
              onClick={() => void copyShareLink()}
              className="inline-flex items-center gap-1.5 rounded-lg border-[0.5px] border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:border-zinc-400 hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:border-zinc-500 dark:hover:bg-zinc-900 dark:focus-visible:outline-zinc-100"
              title="Copy a link that opens this watchlist (?wl=…)"
            >
              <LinkSimple size={14} weight="bold" aria-hidden />
              {shareCopied ? "Copied" : "Copy share link"}
            </button>
          )}
          <button
            type="button"
            onClick={() => void loadAll()}
            disabled={bulkLoading || watchlist.length === 0}
            aria-busy={bulkLoading}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border-[0.5px] border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:border-zinc-400 hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:border-zinc-500 dark:hover:bg-zinc-900 dark:focus-visible:outline-zinc-100"
          >
            <ArrowsClockwise
              size={14}
              weight="bold"
              aria-hidden
              className={bulkLoading ? "animate-spin" : undefined}
            />
            {bulkLoading
              ? "Loading…"
              : anyReady || !anyIdle
                ? "Refresh metrics"
                : "Load metrics"}
          </button>
        </div>
      </div>

      {watchlist.length === 0 ? (
        <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
          Accept the import above, or star companies from their pages.
        </p>
      ) : (
        <>
          {/* Mobile cards */}
          <ul className="mt-3 space-y-2 md:hidden">
            {watchlist.map((e, i) => (
              <WatchCard
                key={e.ticker}
                entry={e}
                row={metrics[e.ticker.toUpperCase()]}
                onFocusRow={() => setFocusedIdx(i)}
              />
            ))}
          </ul>

          {/* Desktop table */}
          <div className="mt-3 hidden overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800 md:block">
            <table className="w-full min-w-[640px] text-left text-sm">
              <caption className="sr-only">
                Watchlist companies with optional revenue growth, margins, free
                cash flow, and changes since last visit. With a row focused, press
                J or K to move between tickers.
              </caption>
              <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-400">
                <tr>
                  <th scope="col" className="px-3 py-2.5 font-medium">
                    Ticker
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-medium">
                    Name
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-medium text-right">
                    Rev YoY
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-medium text-right">
                    Net / Op mgn
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-medium text-right">
                    FCF
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-medium">
                    Since last visit
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
                {watchlist.map((e, i) => {
                  const row = metrics[e.ticker.toUpperCase()];
                  const status = row?.status ?? "idle";
                  const focused = i === focusedIdx;
                  return (
                    <tr
                      key={e.ticker}
                      className={`group bg-white transition-colors hover:bg-zinc-50 dark:bg-zinc-950 dark:hover:bg-zinc-900/70 ${
                        focused ? "bg-zinc-50 dark:bg-zinc-900/70" : ""
                      }`}
                    >
                      <th scope="row" className="px-3 py-2.5 font-normal">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Link
                            href={`/members/research/${e.ticker.toLowerCase()}`}
                            data-watch-ticker={e.ticker.toUpperCase()}
                            onFocus={() => setFocusedIdx(i)}
                            onKeyDown={(ev) => {
                              if (ev.key === " ") {
                                ev.preventDefault();
                                router.push(`/members/research/${e.ticker.toLowerCase()}`);
                              }
                            }}
                            className="font-mono text-xs font-bold text-zinc-900 underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:text-zinc-100 dark:focus-visible:outline-zinc-100"
                          >
                            {e.ticker}
                          </Link>
                          {status === "ready" && (
                            <AlertBadges
                              moved={row?.alertMoved ?? false}
                              newPeriod={row?.alertNewPeriod ?? false}
                            />
                          )}
                        </div>
                      </th>
                      <td className="max-w-[180px] truncate px-3 py-2.5 text-zinc-600 dark:text-zinc-300">
                        <Link
                          href={`/members/research/${e.ticker.toLowerCase()}`}
                          onFocus={() => setFocusedIdx(i)}
                          className="hover:text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:hover:text-zinc-100 dark:focus-visible:outline-zinc-100"
                        >
                          {e.name}
                        </Link>
                      </td>
                      <td
                        className={`px-3 py-2.5 text-right font-mono text-xs tabular-nums ${yoyTone(row?.revYoy ?? null)}`}
                      >
                        {cellMetric(status, row?.revYoy != null ? fmtPct(row.revYoy) : null)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-xs tabular-nums text-zinc-700 dark:text-zinc-300">
                        {cellMetric(
                          status,
                          row
                            ? row.netMargin != null
                              ? fmtMargin(row.netMargin)
                              : row.opMargin != null
                                ? `${fmtMargin(row.opMargin)} op`
                                : null
                            : null
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-xs tabular-nums text-zinc-700 dark:text-zinc-300">
                        {cellMetric(
                          status,
                          row
                            ? row.fcf != null
                              ? fmtValue(row.fcf)
                              : row.fcfMargin != null
                                ? fmtMargin(row.fcfMargin)
                                : null
                            : null
                        )}
                      </td>
                      <td
                        className={`max-w-[220px] truncate px-3 py-2.5 text-xs ${sinceTone(row?.sinceVisit ?? null)}`}
                        title={row?.sinceVisit ?? undefined}
                      >
                        {status === "loading"
                          ? "…"
                          : status === "error"
                            ? row?.error ?? "Error"
                            : status === "ready"
                              ? row?.sinceVisit ?? "—"
                              : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="mt-2 text-[11px] text-zinc-400 dark:text-zinc-500">
            Click a row to open the company
            {watchlist.length >= 2
              ? ". With a row focused, J/K move between tickers"
              : ""}
            . “Since last visit” uses the baseline saved when you last opened that
            page — loading metrics here does not overwrite it. Share with{" "}
            <span className="font-mono">/?wl=aapl,msft</span>
            {" · "}
            Compare peers via{" "}
            <span className="font-mono">#compare?vs=msft,googl</span> on a company page.
          </p>
        </>
      )}
    </section>
  );
}

function cellMetric(status: LoadStatus, value: string | null | undefined): string {
  if (status === "loading") return "…";
  if (status === "error") return "—";
  if (status === "idle" || value == null || value === "") return "—";
  return value;
}

function WatchCard({
  entry,
  row,
  onFocusRow,
}: {
  entry: WatchEntry;
  row?: RowMetrics;
  onFocusRow?: () => void;
}) {
  const status = row?.status ?? "idle";
  const margin =
    row?.netMargin != null
      ? fmtMargin(row.netMargin)
      : row?.opMargin != null
        ? `${fmtMargin(row.opMargin)} op`
        : "—";
  const fcf =
    row?.fcf != null
      ? fmtValue(row.fcf)
      : row?.fcfMargin != null
        ? fmtMargin(row.fcfMargin)
        : "—";

  return (
    <li>
      <Link
        href={`/members/research/${entry.ticker.toLowerCase()}`}
        data-watch-ticker={entry.ticker.toUpperCase()}
        onFocus={onFocusRow}
        className="block rounded-xl border border-zinc-200 bg-white px-3.5 py-3 transition-colors hover:border-zinc-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-600 dark:focus-visible:outline-zinc-100"
      >
        <div className="flex items-baseline justify-between gap-2">
          <span className="flex flex-wrap items-center gap-1.5 font-mono text-xs font-bold text-zinc-900 dark:text-zinc-100">
            {entry.ticker}
            {status === "ready" && (
              <AlertBadges
                moved={row?.alertMoved ?? false}
                newPeriod={row?.alertNewPeriod ?? false}
              />
            )}
          </span>
          {row?.periodLabel && status === "ready" && (
            <span className="text-[11px] text-zinc-400 dark:text-zinc-500">
              {row.periodLabel}
            </span>
          )}
        </div>
        <p className="mt-0.5 truncate text-sm text-zinc-600 dark:text-zinc-300">
          {entry.name}
        </p>
        <dl className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
          <div>
            <dt className="text-zinc-400 dark:text-zinc-500">Rev YoY</dt>
            <dd className={`font-mono tabular-nums ${yoyTone(row?.revYoy ?? null)}`}>
              {cellMetric(status, row?.revYoy != null ? fmtPct(row.revYoy) : null)}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-400 dark:text-zinc-500">Margin</dt>
            <dd className="font-mono tabular-nums text-zinc-700 dark:text-zinc-300">
              {cellMetric(status, margin === "—" ? null : margin)}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-400 dark:text-zinc-500">FCF</dt>
            <dd className="font-mono tabular-nums text-zinc-700 dark:text-zinc-300">
              {cellMetric(status, fcf === "—" ? null : fcf)}
            </dd>
          </div>
        </dl>
        <p
          className={`mt-2 text-xs ${sinceTone(row?.sinceVisit ?? null)}`}
        >
          {status === "loading"
            ? "Loading metrics…"
            : status === "error"
              ? row?.error ?? "Failed to load"
              : status === "ready"
                ? row?.sinceVisit ?? "—"
                : "Load metrics to compare since last visit"}
        </p>
      </Link>
    </li>
  );
}
