"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";

export interface RecentEntry {
  ticker: string;
  name: string;
}

const KEY = "hwsRecentCompanies";

/**
 * localStorage is user-writable and can hold anything (a stale schema, `"5"`,
 * `null`). Validate the shape before trusting it — a bare length check lets a
 * string through and blows up on `.map`.
 */
function parseRecent(raw: string | null): RecentEntry[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(
    (e): e is RecentEntry =>
      typeof e === "object" &&
      e !== null &&
      typeof (e as RecentEntry).ticker === "string" &&
      typeof (e as RecentEntry).name === "string"
  );
}

function readRecent(): RecentEntry[] {
  try {
    return parseRecent(localStorage.getItem(KEY));
  } catch {
    return [];
  }
}

export function recordRecent(entry: RecentEntry) {
  try {
    const list = readRecent();
    const next = [entry, ...list.filter((e) => e.ticker !== entry.ticker)].slice(0, 6);
    localStorage.setItem(KEY, JSON.stringify(next));
    invalidate();
  } catch {
    // Private mode / storage disabled: recents just don't persist.
  }
}

// localStorage is an external store, so read it with the primitive built for
// that rather than a setState-in-effect round trip. The server snapshot is a
// stable empty array, which also keeps SSR and the pre-hydration render matched.
const EMPTY: RecentEntry[] = [];
let snapshot: RecentEntry[] | null = null;
const listeners = new Set<() => void>();

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  // `storage` fires for changes made in *other* tabs; recordRecent() in this tab
  // goes through invalidate().
  const handler = () => {
    snapshot = null;
    onStoreChange();
  };
  window.addEventListener("storage", handler);
  return () => {
    listeners.delete(onStoreChange);
    window.removeEventListener("storage", handler);
  };
}

// useSyncExternalStore requires a referentially stable snapshot; re-parsing on
// every call would return a new array each time and loop forever.
function getSnapshot(): RecentEntry[] {
  if (snapshot === null) snapshot = readRecent();
  return snapshot;
}

/**
 * Called by recordRecent() so the list refreshes without a reload.
 *
 * Dropping the memo is not enough on its own: `useSyncExternalStore` only
 * re-reads when a subscriber is notified, so a mounted list would keep
 * rendering the stale array until something else happened to nudge it.
 */
function invalidate() {
  snapshot = null;
  for (const l of listeners) l();
}

export default function RecentCompanies() {
  const recent = useSyncExternalStore(subscribe, getSnapshot, () => EMPTY);

  if (recent.length === 0) return null;

  return (
    <div style={{ marginTop: 30 }}>
      <p className="rsch-panel-label">Recently viewed</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 9, marginTop: 11 }}>
        {recent.map((e) => (
          <Link
            key={e.ticker}
            href={`/members/research/${e.ticker.toLowerCase()}`}
            className="card card-hover-brand"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 9,
              padding: "7px 12px 7px 8px",
              borderRadius: 10,
              textDecoration: "none",
              color: "var(--text)",
            }}
          >
            <span className="rsch-tag rsch-tag-ghost">{e.ticker}</span>
            <span
              style={{
                fontSize: 13.5,
                color: "var(--muted)",
                maxWidth: 180,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {e.name}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
