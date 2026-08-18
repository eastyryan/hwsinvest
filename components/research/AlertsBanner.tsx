"use client";

import { useEffect, useState } from "react";
import {
  diffPriceSnapshots,
  loadAlerts,
  loadPriceSnapshots,
  markAlertRead,
  saveAlerts,
  savePriceSnapshots,
  type AlertEvent,
  type PriceSnapshot,
} from "@/lib/research/alerts";
import {
  getWatchlistSnapshot,
  subscribeWatchlist,
} from "@/lib/research/watchlist";

/**
 * On home/company load: compare stored watchlist prices to last snapshot,
 * raise free client-side alerts when moves exceed 5%.
 */
export default function AlertsBanner() {
  const [events, setEvents] = useState<AlertEvent[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const unread = loadAlerts().filter((e) => !e.read).slice(0, 8);
      if (!cancelled) setEvents(unread);

      const watch = getWatchlistSnapshot();
      if (watch.length === 0) return;

      const prev = loadPriceSnapshots();
      const next: PriceSnapshot[] = [];

      // Cap concurrent free price checks
      const tickers = watch.slice(0, 12);
      for (const w of tickers) {
        try {
          const res = await fetch(
            `/api/research/prices/${encodeURIComponent(w.ticker)}?range=1y`
          );
          if (!res.ok) continue;
          const json = (await res.json()) as { price?: number | null };
          if (json.price != null && Number.isFinite(json.price)) {
            next.push({
              ticker: w.ticker.toUpperCase(),
              price: json.price,
              at: Date.now(),
            });
          }
        } catch {
          /* skip */
        }
      }

      if (cancelled || next.length === 0) return;
      const fresh = diffPriceSnapshots(prev, next, 0.05);
      if (fresh.length) {
        const merged = [...fresh, ...loadAlerts()].slice(0, 50);
        saveAlerts(merged);
        if (!cancelled) setEvents(merged.filter((e) => !e.read).slice(0, 8));
      }
      savePriceSnapshots(next);
    }

    void run();
    return subscribeWatchlist(() => {
      /* watchlist changed — leave existing alerts; next mount refreshes */
    });
  }, []);

  if (events.length === 0) return null;

  return (
    <div className="border-b border-amber-300/60 bg-amber-50/90 px-4 py-2 dark:border-amber-800 dark:bg-amber-950/40">
      <div className="mx-auto flex max-w-5xl flex-col gap-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-900 dark:text-amber-200">
          Watchlist alerts (local)
        </p>
        <ul className="space-y-1">
          {events.map((e) => (
            <li
              key={e.id}
              className="flex flex-wrap items-start justify-between gap-2 text-xs text-amber-950 dark:text-amber-100"
            >
              <span>
                <span className="font-mono font-bold">{e.ticker}</span> — {e.title}
                {e.body ? `: ${e.body}` : ""}
              </span>
              <button
                type="button"
                className="shrink-0 font-medium underline-offset-2 hover:underline"
                onClick={() => {
                  markAlertRead(e.id);
                  setEvents((prev) => prev.filter((x) => x.id !== e.id));
                }}
              >
                Dismiss
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
