"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  ChartBar,
  House,
  MagnifyingGlass,
  Moon,
  SquaresFour,
  Sun,
} from "@phosphor-icons/react";
import useIsDark from "./useIsDark";

interface SearchResult {
  cik: string;
  ticker: string;
  name: string;
}

const COMPANY_TABS = [
  { key: "overview", label: "Overview" },
  { key: "income", label: "Income" },
  { key: "balance", label: "Balance Sheet" },
  { key: "cashflow", label: "Cash Flow" },
  { key: "ratios", label: "Ratios" },
  { key: "valuation", label: "Valuation" },
  { key: "segments", label: "Segments" },
  { key: "ownership", label: "Ownership" },
  { key: "charts", label: "Charts" },
  { key: "compare", label: "Compare" },
] as const;

type StaticAction =
  | { kind: "tab"; id: string; label: string; hint: string; key: string }
  | { kind: "theme"; id: string; label: string; hint: string }
  | { kind: "home"; id: string; label: string; hint: string }
  | { kind: "route"; id: string; label: string; hint: string; href: string };

type ListItem =
  | StaticAction
  | { kind: "company"; id: string; label: string; hint: string; result: SearchResult };

function companyTickerFromPath(pathname: string): string | null {
  const m = pathname.match(/^\/members\/research\/(?!screener)([^/]+)\/?$/i);
  return m?.[1] ? decodeURIComponent(m[1]) : null;
}

function matchesQuery(label: string, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  return label.toLowerCase().includes(q);
}

function toggleTheme() {
  const next = !document.documentElement.classList.contains("dark");
  document.documentElement.classList.toggle("dark", next);
  try {
    localStorage.setItem("theme", next ? "dark" : "light");
  } catch {
    // Private mode / storage disabled: still works for this session.
  }
}

function jumpToCompanyTab(key: string) {
  // Match CompanyView: bare `#key`, replaceState so we don't spam history,
  // then notify listeners (hashchange does not fire for replaceState alone).
  const bare = window.location.hash.slice(1).split(/[?&]/, 1)[0] ?? "";
  if (bare === key && key !== "compare") {
    // Already on this tab — still re-fire so a deep-linked strip scrolls.
    window.dispatchEvent(new Event("hashchange"));
    return;
  }
  if (key === "compare") {
    const h = window.location.hash.slice(1);
    if (h === "compare" || h.startsWith("compare?") || h.startsWith("compare&")) {
      window.dispatchEvent(new Event("hashchange"));
      return;
    }
  }
  window.history.replaceState(null, "", `#${key}`);
  window.dispatchEvent(new Event("hashchange"));
}

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [active, setActive] = useState(0);

  const router = useRouter();
  const pathname = usePathname();
  const dark = useIsDark();
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevFocus = useRef<HTMLElement | null>(null);
  const listboxId = useId();
  const optionId = (i: number) => `${listboxId}-opt-${i}`;

  const companyTicker = companyTickerFromPath(pathname ?? "");

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setResults([]);
    setSearchError(null);
    setSearching(false);
    setActive(0);
  }, []);

  const openPalette = useCallback(() => {
    prevFocus.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setOpen(true);
    setQuery("");
    setResults([]);
    setSearchError(null);
    setSearching(false);
    setActive(0);
  }, []);

  // Global ⌘K / Ctrl+K
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (open) close();
        else openPalette();
        return;
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, close, openPalette]);

  // Restore focus + lock body scroll while open. Escape at document level so
  // focus never "falls out" of the dialog without a way back.
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Focus after paint so the input is mounted.
    const t = requestAnimationFrame(() => inputRef.current?.focus());

    function onDocKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        close();
        return;
      }
      // Focus trap: keep Tab cycling on the combobox input (only real tab stop).
      if (e.key === "Tab") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onDocKeyDown, true);

    return () => {
      cancelAnimationFrame(t);
      document.removeEventListener("keydown", onDocKeyDown, true);
      document.body.style.overflow = prevOverflow;
      const restore = prevFocus.current;
      prevFocus.current = null;
      // Defer so React can unmount the dialog before focus moves back.
      requestAnimationFrame(() => {
        try {
          restore?.focus?.();
        } catch {
          // Element may have unmounted (route change).
        }
      });
    };
  }, [open, close]);

  // Debounced company search. Empty-query cleanup is derived below (same as
  // SearchBox) so we never setState synchronously in this effect body.
  useEffect(() => {
    if (!open) return;
    if (debounce.current) clearTimeout(debounce.current);
    const q = query.trim();
    if (!q) return;

    const controller = new AbortController();
    debounce.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/research/search?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
        });
        const json: { results?: SearchResult[]; error?: string } =
          await res.json();
        if (controller.signal.aborted) return;
        if (json.error || !Array.isArray(json.results)) {
          setResults([]);
          setSearchError(json.error ?? "Search is temporarily unavailable.");
          setSearching(false);
          return;
        }
        setResults(json.results);
        setSearchError(null);
        setSearching(false);
      } catch {
        if (!controller.signal.aborted) {
          setResults([]);
          setSearchError("Search is temporarily unavailable.");
          setSearching(false);
        }
      }
    }, 150);
    // Mark pending only after scheduling — still async relative to React's
    // render, via the timeout's first tick would be late for "Searching…", so
    // flip the flag in a microtask instead of the effect body.
    queueMicrotask(() => {
      if (!controller.signal.aborted) setSearching(true);
    });

    return () => {
      if (debounce.current) clearTimeout(debounce.current);
      controller.abort();
    };
  }, [query, open]);

  const staticItems = useMemo((): StaticAction[] => {
    const q = query.trim();
    const items: StaticAction[] = [];

    if (companyTicker) {
      for (const t of COMPANY_TABS) {
        const label = `Go to ${t.label}`;
        if (matchesQuery(label, q) || matchesQuery(t.label, q) || matchesQuery(t.key, q)) {
          items.push({
            kind: "tab",
            id: `tab-${t.key}`,
            label,
            hint: `#${t.key}`,
            key: t.key,
          });
        }
      }
    }

    const themeLabel = dark ? "Switch to light mode" : "Switch to dark mode";
    if (
      matchesQuery(themeLabel, q) ||
      matchesQuery("theme", q) ||
      matchesQuery("dark", q) ||
      matchesQuery("light", q)
    ) {
      items.push({
        kind: "theme",
        id: "theme",
        label: themeLabel,
        hint: "Theme",
      });
    }

    if (
      pathname !== "/" &&
      (matchesQuery("home", q) ||
        matchesQuery("new search", q) ||
        matchesQuery("go home", q) ||
        !q)
    ) {
      items.push({
        kind: "home",
        id: "home",
        label: "Go to home",
        hint: "Search",
      });
    }

    if (
      matchesQuery("screener", q) ||
      matchesQuery("screen", q) ||
      matchesQuery("filter stocks", q) ||
      !q
    ) {
      items.push({
        kind: "route",
        id: "screener",
        label: "Open free screener",
        hint: "EDGAR metrics",
        href: "/members/research/screener",
      });
    }

    if (
      companyTicker &&
      (matchesQuery("valuation", q) ||
        matchesQuery("dcf", q) ||
        matchesQuery("football", q) ||
        matchesQuery("lbo", q))
    ) {
      items.push({
        kind: "tab",
        id: "tab-valuation-jump",
        label: "Go to Valuation suite",
        hint: "#valuation",
        key: "valuation",
      });
    }

    return items;
  }, [query, companyTicker, dark, pathname]);

  const queryActive = query.trim() !== "";
  // Stale results/errors from a prior query must not appear after clear.
  const liveSearchError = queryActive ? searchError : null;
  const liveSearching = queryActive && searching;

  const items = useMemo((): ListItem[] => {
    const liveResults = queryActive ? results : [];
    const companyItems: ListItem[] = liveResults.map((r) => ({
      kind: "company" as const,
      id: `co-${r.cik}-${r.ticker}`,
      label: r.name,
      hint: r.ticker,
      result: r,
    }));
    // Companies lead when the user is clearly searching a ticker/name.
    if (queryActive && companyItems.length > 0) {
      return [...companyItems, ...staticItems];
    }
    return [...staticItems, ...companyItems];
  }, [results, staticItems, queryActive]);

  // Derive a safe index so a shrinking list never points past the end.
  const activeIndex =
    items.length === 0 ? 0 : Math.min(active, items.length - 1);

  // Keep the active option in view inside the list.
  useEffect(() => {
    if (!open || items.length === 0) return;
    const el = listRef.current?.querySelector<HTMLElement>(
      `#${CSS.escape(optionId(activeIndex))}`
    );
    el?.scrollIntoView({ block: "nearest" });
    // optionId is stable per mount via useId.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, open, items]);

  const runItem = useCallback(
    (item: ListItem) => {
      if (item.kind === "company") {
        close();
        router.push(`/members/research/${item.result.ticker.toLowerCase()}`);
        return;
      }
      if (item.kind === "tab") {
        close();
        jumpToCompanyTab(item.key);
        return;
      }
      if (item.kind === "theme") {
        toggleTheme();
        close();
        return;
      }
      if (item.kind === "home") {
        close();
        router.push("/members/research");
        return;
      }
      if (item.kind === "route") {
        close();
        router.push(item.href);
      }
    },
    [close, router]
  );

  // Enter with a ticker-like query and no active company hit: resolve via API.
  const runEnterFallback = useCallback(async () => {
    const q = query.trim();
    if (!q) return;
    try {
      const res = await fetch(`/api/research/search?q=${encodeURIComponent(q)}`);
      const json: { results?: SearchResult[] } = await res.json();
      const hit =
        (json.results ?? []).find(
          (r) => r.ticker.toUpperCase() === q.toUpperCase()
        ) ?? json.results?.[0];
      if (hit) {
        close();
        router.push(`/members/research/${hit.ticker.toLowerCase()}`);
      }
    } catch {
      // Leave the palette open; searchError already covers hard failures.
    }
  }, [query, close, router]);

  function onInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (items.length === 0) return;
      setActive((a) => Math.min(Math.min(a, items.length - 1) + 1, items.length - 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (items.length === 0) return;
      setActive((a) => Math.max(Math.min(a, items.length - 1) - 1, 0));
      return;
    }
    if (e.key === "Home" && items.length > 0) {
      e.preventDefault();
      setActive(0);
      return;
    }
    if (e.key === "End" && items.length > 0) {
      e.preventDefault();
      setActive(items.length - 1);
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (items[activeIndex]) {
        runItem(items[activeIndex]);
      } else if (query.trim()) {
        void runEnterFallback();
      }
      return;
    }
    if (e.key === "Tab") {
      // Simple focus stay: only one real tab stop (the input). Prevent leaving.
      e.preventDefault();
    }
  }

  if (!open) return null;

  const modHint =
    typeof navigator !== "undefined" &&
    /Mac|iPhone|iPad|iPod/.test(navigator.platform ?? "")
      ? "⌘"
      : "Ctrl";

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center px-4 pt-[12vh] sm:pt-[14vh]"
      role="presentation"
    >
      <button
        type="button"
        aria-label="Close command palette"
        className="absolute inset-0 bg-zinc-900/40 backdrop-blur-[2px] dark:bg-black/60"
        onClick={close}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        aria-describedby={`${listboxId}-hint`}
        className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl shadow-zinc-900/20 dark:border-zinc-700 dark:bg-zinc-900 dark:shadow-black/50"
      >
        <div className="flex items-center gap-3 border-b border-zinc-200 px-4 dark:border-zinc-800">
          <MagnifyingGlass
            size={18}
            weight="bold"
            aria-hidden
            className="shrink-0 text-zinc-400 dark:text-zinc-500"
          />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={onInputKeyDown}
            placeholder={
              companyTicker
                ? "Search company or jump to a tab…"
                : "Search company or run a command…"
            }
            aria-label="Command palette search"
            aria-controls={listboxId}
            aria-expanded={true}
            aria-haspopup="listbox"
            aria-activedescendant={
              items.length > 0 ? optionId(activeIndex) : undefined
            }
            role="combobox"
            aria-autocomplete="list"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            className="w-full bg-transparent py-3.5 text-base text-zinc-900 outline-none placeholder:text-zinc-400 focus-visible:ring-0 dark:text-zinc-100 dark:placeholder:text-zinc-500"
          />
          <kbd className="hidden shrink-0 rounded-md border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 font-mono text-[10px] font-medium text-zinc-500 sm:inline dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
            esc
          </kbd>
        </div>

        <ul
          ref={listRef}
          id={listboxId}
          role="listbox"
          aria-label="Commands"
          className="max-h-[min(50vh,360px)] overflow-y-auto overscroll-contain py-1"
        >
          {items.length === 0 && !liveSearching && !liveSearchError && (
            <li
              role="presentation"
              className="px-4 py-6 text-center text-sm text-zinc-500 dark:text-zinc-400"
            >
              {query.trim()
                ? "No matching commands or companies."
                : companyTicker
                  ? "Jump to a tab, toggle theme, or search a company."
                  : "Search a company or toggle theme."}
            </li>
          )}
          {liveSearchError && items.length === 0 && (
            <li
              role="presentation"
              className="px-4 py-3 text-sm text-red-600 dark:text-red-400"
            >
              <span role="alert">{liveSearchError}</span>
            </li>
          )}
          {items.map((item, i) => {
            const selected = i === activeIndex;
            return (
              <li
                key={item.id}
                id={optionId(i)}
                role="option"
                aria-selected={selected}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => runItem(item)}
                className={`flex cursor-pointer items-center gap-3 px-3 py-2.5 mx-1 rounded-lg ${
                  selected
                    ? "bg-zinc-100 dark:bg-zinc-800"
                    : "hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
                }`}
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${
                    item.kind === "company"
                      ? "bg-zinc-900 font-mono text-[10px] font-bold text-white dark:bg-zinc-100 dark:text-zinc-900"
                      : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                  }`}
                >
                  {item.kind === "company" ? (
                    item.result.ticker.slice(0, 4)
                  ) : item.kind === "theme" ? (
                    dark ? (
                      <Sun size={16} weight="bold" aria-hidden />
                    ) : (
                      <Moon size={16} weight="bold" aria-hidden />
                    )
                  ) : item.kind === "home" ? (
                    <House size={16} weight="bold" aria-hidden />
                  ) : item.kind === "tab" && item.key === "charts" ? (
                    <ChartBar size={16} weight="bold" aria-hidden />
                  ) : (
                    <SquaresFour size={16} weight="bold" aria-hidden />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {item.kind === "company" ? item.result.name : item.label}
                  </span>
                  {item.kind === "company" && (
                    <span className="block truncate text-xs text-zinc-500 dark:text-zinc-400">
                      Open company
                    </span>
                  )}
                </span>
                <span className="shrink-0 font-mono text-[11px] text-zinc-400 dark:text-zinc-500">
                  {item.hint}
                </span>
              </li>
            );
          })}
        </ul>

        <div
          id={`${listboxId}-hint`}
          className="flex items-center justify-between gap-2 border-t border-zinc-200 px-4 py-2 text-[11px] text-zinc-400 dark:border-zinc-800 dark:text-zinc-500"
        >
          <span>
            <kbd className="font-mono">{modHint}K</kbd> toggle ·{" "}
            <kbd className="font-mono">↑↓</kbd> navigate ·{" "}
            <kbd className="font-mono">↵</kbd> select ·{" "}
            <kbd className="font-mono">esc</kbd> close
          </span>
          {liveSearching && (
            <span className="animate-pulse" role="status" aria-live="polite">
              Searching…
            </span>
          )}
        </div>
      </div>

      <p role="status" aria-live="polite" className="sr-only">
        {open
          ? items.length > 0
            ? `${items.length} ${items.length === 1 ? "result" : "results"}. Use arrow keys and Enter.`
            : liveSearching
              ? "Searching."
              : "No results."
          : ""}
      </p>
    </div>
  );
}
