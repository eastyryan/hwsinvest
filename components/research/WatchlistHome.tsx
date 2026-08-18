"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { CaretDown, X } from "@phosphor-icons/react";
import {
  buildWatchlistShareUrl,
  getServerWatchlistSnapshot,
  getWatchlistSnapshot,
  importWatchTickers,
  readWatchlistShareFromLocation,
  subscribeWatchlist,
  toggleWatch,
} from "@/lib/research/watchlist";

/**
 * Right half under home search: plain expandable watchlist names (no card).
 * Full metrics dashboard lives elsewhere; home only lists tickers to open.
 */
export default function WatchlistHome({
  shifted = false,
}: {
  shifted?: boolean;
} = {}) {
  const watchlist = useSyncExternalStore(
    subscribeWatchlist,
    getWatchlistSnapshot,
    getServerWatchlistSnapshot
  );
  const [expanded, setExpanded] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [importOffer, setImportOffer] = useState<string[] | null>(null);
  const [importNote, setImportNote] = useState<string | null>(null);
  const importHandled = useRef(false);

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
    const have = new Set(getWatchlistSnapshot().map((e) => e.ticker.toUpperCase()));
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
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete("wl");
      url.searchParams.delete("watch");
      if (url.hash.startsWith("#watch=") || url.hash.startsWith("#wl=")) url.hash = "";
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
      if (url.hash.startsWith("#watch=") || url.hash.startsWith("#wl=")) url.hash = "";
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
      // private mode
    }
  }, []);

  return (
    <div
      className="min-w-0 transition-[margin,opacity] duration-200 ease-out motion-reduce:transition-none"
      style={{
        marginTop: shifted ? 4 : 0,
        opacity: shifted ? 0.9 : 1,
      }}
    >
      {(importOffer || importNote) && (
        <div className="mb-2 space-y-1 text-xs text-zinc-500 dark:text-zinc-400">
          {importOffer && (
            <p>
              Import {importOffer.length} from share link?{" "}
              <button
                type="button"
                onClick={acceptImport}
                className="font-medium text-zinc-800 underline-offset-2 hover:underline dark:text-zinc-200"
              >
                Add
              </button>
              {" · "}
              <button
                type="button"
                onClick={dismissImport}
                className="underline-offset-2 hover:underline"
              >
                Dismiss
              </button>
            </p>
          )}
          {importNote && <p>{importNote}</p>}
        </div>
      )}

      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="group flex w-full items-center gap-1.5 py-1.5 text-left"
      >
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-800 dark:text-zinc-200">
          Watchlist
          <span className="ml-1.5 font-normal text-zinc-400 dark:text-zinc-500">
            {watchlist.length === 0
              ? "empty"
              : `${watchlist.length}${!expanded && watchlist[0] ? ` · ${watchlist[0].ticker}` : ""}`}
          </span>
        </span>
        <CaretDown
          size={14}
          weight="bold"
          aria-hidden
          className={`shrink-0 text-zinc-400 transition-transform duration-200 group-hover:text-zinc-600 dark:text-zinc-500 dark:group-hover:text-zinc-300 ${
            expanded ? "rotate-180" : ""
          }`}
        />
      </button>

      <div
        className="grid transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none"
        style={{
          gridTemplateRows: expanded ? "1fr" : "0fr",
          opacity: expanded ? 1 : 0,
        }}
        aria-hidden={!expanded}
      >
        <div className="min-h-0 overflow-hidden">
          {watchlist.length === 0 ? (
            <p className="pb-1 text-xs leading-snug text-zinc-400 dark:text-zinc-500">
              Star a company on its page to pin it here.
            </p>
          ) : (
            <>
              <ul className="space-y-0.5 pb-1">
                {watchlist.map((e) => (
                  <li key={e.ticker} className="group/row flex min-w-0 items-center gap-1">
                    <Link
                      href={`/members/research/${e.ticker.toLowerCase()}`}
                      tabIndex={expanded ? 0 : -1}
                      className="flex min-w-0 flex-1 items-baseline gap-2 py-1 text-sm hover:text-zinc-900 dark:hover:text-zinc-50"
                    >
                      <span className="shrink-0 font-mono text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                        {e.ticker}
                      </span>
                      <span className="truncate text-zinc-500 dark:text-zinc-400">{e.name}</span>
                    </Link>
                    <button
                      type="button"
                      tabIndex={expanded ? 0 : -1}
                      onClick={(ev) => {
                        ev.preventDefault();
                        ev.stopPropagation();
                        toggleWatch(e);
                      }}
                      aria-label={`Remove ${e.ticker} from watchlist`}
                      title={`Remove ${e.ticker}`}
                      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-zinc-400 opacity-70 hover:bg-zinc-100 hover:text-zinc-700 hover:opacity-100 focus-visible:opacity-100 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 sm:opacity-0 sm:group-hover/row:opacity-100 sm:focus-visible:opacity-100"
                    >
                      <X size={12} weight="bold" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                tabIndex={expanded ? 0 : -1}
                onClick={() => void copyShareLink()}
                className="pb-1 text-left text-[11px] text-zinc-400 underline-offset-2 hover:text-zinc-600 hover:underline dark:text-zinc-500 dark:hover:text-zinc-300"
              >
                {shareCopied ? "Link copied" : "Copy share link"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
