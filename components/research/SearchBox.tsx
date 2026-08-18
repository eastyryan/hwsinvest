"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

interface Result {
  cik: string;
  ticker: string;
  name: string;
}

export default function SearchBox({
  large = false,
  onSelect,
  onPanelOpenChange,
  placeholder = "Search a company name or ticker",
  disabled = false,
}: {
  large?: boolean;
  onSelect?: (r: Result) => void; // when set, selection calls back instead of navigating
  /** Fires when the results/error panel opens or closes (home page layout uses this). */
  onPanelOpenChange?: (open: boolean) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  // The pathname we were on when a navigation started, or null. Deriving
  // `navigating` from it means the input re-enables on any route change instead
  // of relying on an effect that never ran — the old bug left it disabled and
  // out of the tab order forever.
  const [navFrom, setNavFrom] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const boxRef = useRef<HTMLDivElement>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Query value we wrote ourselves after a selection — searching it again would
  // be a wasted round trip for a company the user already picked.
  const suppressedQuery = useRef<string | null>(null);
  const listboxId = useId();
  const optionId = (i: number) => `${listboxId}-opt-${i}`;

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    // An empty query needs no state reset: the dropdown's visibility is derived
    // from the query below, so stale results simply stop being rendered. Doing
    // it that way avoids a synchronous setState in the effect body, which
    // triggers a cascading render.
    if (!query.trim()) return;
    if (suppressedQuery.current === query) return;

    const controller = new AbortController();
    debounce.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/research/search?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        const json: { results?: Result[]; error?: string } = await res.json();
        if (controller.signal.aborted) return;
        // A failing search backend must not masquerade as "no matches".
        if (json.error || !Array.isArray(json.results)) {
          setResults([]);
          setSearchError(json.error ?? "Search is temporarily unavailable.");
          setOpen(true);
          return;
        }
        setResults(json.results);
        setSearchError(null);
        setActive(0);
        setOpen(true);
      } catch {
        if (!controller.signal.aborted) {
          setResults([]);
          setSearchError("Search is temporarily unavailable.");
          setOpen(true);
        }
      }
    }, 150);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
      // Abort the in-flight request too, otherwise a slow earlier query can
      // land after a newer one and overwrite the results.
      controller.abort();
    };
  }, [query]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node))
        setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // The navigation safety-net timer outlives the component otherwise, and on
  // the compare panel this box is unmounted the moment a company is added.
  useEffect(
    () => () => {
      if (navTimeout.current) clearTimeout(navTimeout.current);
    },
    [],
  );

  const go = useCallback(
    (r: Result) => {
      setOpen(false);
      if (onSelect) {
        suppressedQuery.current = null;
        setQuery("");
        setResults([]);
        onSelect(r);
        return;
      }
      setNavFrom(pathname);
      const label = `${r.name} (${r.ticker})`;
      suppressedQuery.current = label;
      setQuery(label);
      setResults([]);
      router.push(`/members/research/${r.ticker.toLowerCase()}`);
      // Safety net for a push that resolves to the current route (pathname
      // never changes, so the derived flag would otherwise stay true).
      if (navTimeout.current) clearTimeout(navTimeout.current);
      navTimeout.current = setTimeout(() => setNavFrom(null), 8000);
    },
    [router, onSelect, pathname],
  );

  function onChange(value: string) {
    suppressedQuery.current = null;
    setQuery(value);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    // Escape has to work whenever the panel is showing, including the "no
    // matches" and "search unavailable" states. Gating the whole handler on
    // having results left those panels stuck open until a click elsewhere.
    if (e.key === "Escape") {
      if (open) {
        e.stopPropagation();
        setOpen(false);
      }
      return;
    }
    if (!open || !query.trim() || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Home") {
      e.preventDefault();
      setActive(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActive(results.length - 1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(results[active]);
    } else if (e.key === "Tab") {
      // Leaving the field should dismiss the popup rather than leave it
      // floating over whatever the user moves to next.
      setOpen(false);
    }
  }

  const navigating = navFrom !== null && pathname === navFrom;
  const isDisabled = disabled || navigating;
  // Everything below is gated on a non-empty query. Clearing the input hides the
  // dropdown without clearing `results`/`searchError`, so an emptied box can
  // never show results from the query that came before it.
  const queryActive = query.trim() !== "";
  const hasResults = queryActive && results.length > 0;
  const listOpen = open && hasResults;
  // The panel also opens for "no matches" and for backend failures, which the
  // API now reports separately.
  const panelOpen = open && queryActive;

  useEffect(() => {
    onPanelOpenChange?.(panelOpen);
  }, [panelOpen, onPanelOpenChange]);

  const panelInner = (
    <>
      {searchError ? (
        <p
          role="status"
          className="px-4 py-3 text-sm text-red-600 dark:text-red-400"
        >
          {searchError}
        </p>
      ) : (
        !hasResults && (
          <p role="status" className="px-4 py-3 text-sm text-zinc-500 dark:text-zinc-400">
            No companies match &ldquo;{query.trim()}&rdquo;.
          </p>
        )
      )}
      <ul
        id={listboxId}
        role="listbox"
        aria-label="Company search results"
        hidden={!listOpen}
      >
        {/* Option children must be presentational — no nested focusable controls.
            Keyboard interaction is driven from the input via aria-activedescendant. */}
        {results.map((r, i) => (
          <li
            key={r.cik + r.ticker}
            id={optionId(i)}
            role="option"
            aria-selected={i === active}
            onMouseEnter={() => setActive(i)}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => go(r)}
            className={`flex w-full cursor-pointer items-center gap-3 border-b border-zinc-100 px-4 py-3 text-left last:border-b-0 dark:border-zinc-800 ${
              i === active ? "bg-zinc-100 dark:bg-zinc-800" : ""
            }`}
          >
            <span className="flex h-8 w-16 shrink-0 items-center justify-center rounded-md bg-zinc-900 font-mono text-xs font-bold text-white dark:bg-zinc-100 dark:text-zinc-900">
              {r.ticker}
            </span>
            <span className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-200">
              {r.name}
            </span>
          </li>
        ))}
      </ul>
    </>
  );

  return (
    <div ref={boxRef} className="relative w-full">
      <input
        type="text"
        value={query}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={() => (hasResults || searchError) && setOpen(true)}
        placeholder={placeholder}
        autoFocus={large}
        disabled={isDisabled}
        aria-label="Search a company name or ticker"
        // Reflects the listbox specifically — that is the popup `aria-controls`
        // points at. It was previously true whenever the panel showed a "no
        // matches" or error message, which announces "expanded" and then hands
        // a screen reader nothing to navigate into.
        aria-expanded={listOpen}
        role="combobox"
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={listOpen ? optionId(active) : undefined}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        name="company-search"
        className={
          large
            ? "w-full rounded-xl border-2 border-zinc-900 bg-white px-5 py-4 text-lg text-zinc-900 placeholder-zinc-500 outline-none transition-shadow focus:shadow-[0_0_0_3px_rgba(24,24,27,0.12)] disabled:opacity-60 dark:border-zinc-100 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:shadow-[0_0_0_3px_rgba(244,244,245,0.15)]"
            : // Match primary toolbar chrome (h-9, border-2 zinc-900) used by Watch / Excel.
              "h-9 w-full rounded-lg border-2 border-zinc-900 bg-white px-3.5 text-sm text-zinc-900 placeholder-zinc-500 outline-none transition-shadow focus:shadow-[0_0_0_3px_rgba(24,24,27,0.12)] disabled:opacity-60 dark:border-zinc-100 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:shadow-[0_0_0_3px_rgba(244,244,245,0.15)]"
        }
      />
      {navigating && (
        <div className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 rounded-full border-2 border-zinc-300 border-t-zinc-900 animate-spin dark:border-zinc-600 dark:border-t-zinc-100" />
      )}
      {large ? (
        // Home page: in-flow panel so content below (Recently viewed) animates
        // down instead of sitting under an absolute overlay.
        <div
          className="grid transition-[grid-template-rows,opacity,margin] duration-200 ease-out motion-reduce:transition-none"
          style={{
            gridTemplateRows: panelOpen ? "1fr" : "0fr",
            opacity: panelOpen ? 1 : 0,
            marginTop: panelOpen ? 8 : 0,
          }}
          aria-hidden={!panelOpen}
        >
          <div className="min-h-0 overflow-hidden">
            <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl shadow-zinc-900/15 dark:border-zinc-700 dark:bg-zinc-900 dark:shadow-black/50">
              {panelInner}
            </div>
          </div>
        </div>
      ) : (
        <div
          hidden={!panelOpen}
          className="absolute z-50 mt-2 w-full overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl shadow-zinc-900/15 dark:border-zinc-700 dark:bg-zinc-900 dark:shadow-black/50"
        >
          {panelInner}
        </div>
      )}
      {/* Results appear without focus moving, so nothing would otherwise tell a
          screen-reader user that the list changed under them. Kept outside the
          `hidden` panel so it is always in the accessibility tree. */}
      <p role="status" aria-live="polite" className="sr-only">
        {listOpen
          ? `${results.length} ${results.length === 1 ? "company" : "companies"} found. Use the up and down arrow keys to review, Enter to open.`
          : ""}
      </p>
    </div>
  );
}
