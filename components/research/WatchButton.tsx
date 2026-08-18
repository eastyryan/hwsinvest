"use client";

import { useEffect, useSyncExternalStore } from "react";
import {
  getServerWatchlistSnapshot,
  getWatchlistSnapshot,
  patchWatchEntry,
  subscribeWatchlist,
  toggleWatch,
} from "@/lib/research/watchlist";
import { btnToolbar, btnToolbarWatchActive } from "./ui/buttonStyles";

export default function WatchButton({
  ticker,
  name,
  cik,
}: {
  ticker: string;
  name: string;
  cik?: string;
}) {
  const list = useSyncExternalStore(
    subscribeWatchlist,
    getWatchlistSnapshot,
    getServerWatchlistSnapshot
  );
  const watched = list.some((e) => e.ticker.toUpperCase() === ticker.toUpperCase());

  // Backfill CIK/name on already-watched entries once CompanyView has them.
  useEffect(() => {
    if (!cik) return;
    const t = ticker.toUpperCase();
    const entry = list.find((e) => e.ticker.toUpperCase() === t);
    if (!entry) return;
    if (entry.cik === cik && entry.name === name) return;
    if (!entry.cik || entry.name !== name) {
      patchWatchEntry(ticker, { cik, name });
    }
  }, [cik, ticker, name, list]);

  return (
    <button
      type="button"
      onClick={() => toggleWatch({ ticker, name, cik })}
      aria-pressed={watched}
      title={watched ? "Remove from watchlist" : "Add to watchlist"}
      className={watched ? btnToolbarWatchActive : btnToolbar}
    >
      <span aria-hidden>{watched ? "★" : "☆"}</span>
      {watched ? "Watching" : "Watch"}
    </button>
  );
}
