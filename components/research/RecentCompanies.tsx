"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { CaretDown } from "@phosphor-icons/react";

export interface RecentEntry {
  ticker: string;
  name: string;
}

const KEY = "recentCompanies";

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

const EMPTY: RecentEntry[] = [];
let snapshot: RecentEntry[] | null = null;
const listeners = new Set<() => void>();

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
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

function getSnapshot(): RecentEntry[] {
  if (snapshot === null) snapshot = readRecent();
  return snapshot;
}

function invalidate() {
  snapshot = null;
  for (const l of listeners) l();
}

/**
 * Left half under home search: plain expandable name list (no card chrome).
 */
export default function RecentCompanies({
  shifted = false,
}: {
  shifted?: boolean;
} = {}) {
  const recent = useSyncExternalStore(subscribe, getSnapshot, () => EMPTY);
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="min-w-0 transition-[margin,opacity] duration-200 ease-out motion-reduce:transition-none"
      style={{
        marginTop: shifted ? 4 : 0,
        opacity: shifted ? 0.9 : 1,
      }}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        disabled={recent.length === 0}
        className="group flex w-full items-center gap-1.5 py-1.5 text-left disabled:cursor-default disabled:opacity-50"
      >
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-800 dark:text-zinc-200">
          Recently viewed
          {recent.length > 0 && (
            <span className="ml-1.5 font-normal text-zinc-400 dark:text-zinc-500">
              {recent.length}
              {!expanded && recent[0] ? ` · ${recent[0].ticker}` : ""}
            </span>
          )}
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
          {recent.length === 0 ? (
            <p className="pb-1 text-xs text-zinc-400 dark:text-zinc-500">No recent companies</p>
          ) : (
            <ul className="space-y-0.5 pb-1">
              {recent.map((e) => (
                <li key={e.ticker}>
                  <Link
                    href={`/members/research/${e.ticker.toLowerCase()}`}
                    tabIndex={expanded ? 0 : -1}
                    className="flex min-w-0 items-baseline gap-2 py-1 text-sm hover:text-zinc-900 dark:hover:text-zinc-50"
                  >
                    <span className="shrink-0 font-mono text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                      {e.ticker}
                    </span>
                    <span className="truncate text-zinc-500 dark:text-zinc-400">{e.name}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
