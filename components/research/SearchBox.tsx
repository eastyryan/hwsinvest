"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Search } from "lucide-react";

interface Result {
  cik: string;
  ticker: string;
  name: string;
}

export default function SearchBox({
  large = false,
  onSelect,
  placeholder = "Search a company name or ticker",
  disabled = false,
}: {
  large?: boolean;
  onSelect?: (r: Result) => void; // when set, selection calls back instead of navigating
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
  // of relying on an effect that never ran: the old bug left it disabled and
  // out of the tab order forever.
  const [navFrom, setNavFrom] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const boxRef = useRef<HTMLDivElement>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Query value we wrote ourselves after a selection, searching it again would
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
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
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
    []
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
    [router, onSelect, pathname]
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

  return (
    <div ref={boxRef} className="rsch-search">
      <Search
        size={large ? 19 : 16}
        strokeWidth={2}
        aria-hidden
        style={{
          position: "absolute",
          left: large ? 18 : 14,
          top: "50%",
          transform: "translateY(-50%)",
          color: "var(--faint)",
          pointerEvents: "none",
        }}
      />
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
        // Reflects the listbox specifically: that is the popup `aria-controls`
        // points at. It was previously true whenever the panel showed a "no
        // matches" or error message, which announces "expanded" and then hands
        // a screen reader nothing to navigate into.
        aria-expanded={listOpen}
        role="combobox"
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={listOpen ? optionId(active) : undefined}
        autoComplete="off"
        className={`rsch-input${large ? " rsch-input-lg" : ""}`}
        style={{ paddingLeft: large ? 46 : 38 }}
      />
      {navigating && (
        <span
          aria-hidden
          style={{
            position: "absolute",
            right: large ? 18 : 14,
            top: "50%",
            marginTop: -8,
            height: 16,
            width: 16,
            borderRadius: "50%",
            border: "2px solid var(--line)",
            borderTopColor: "var(--brandSolid)",
            animation: "rsch-spin 0.7s linear infinite",
          }}
        />
      )}
      <div hidden={!panelOpen} className="rsch-menu">
        {searchError ? (
          <p
            role="status"
            style={{ margin: 0, padding: "12px 14px", fontSize: 14, color: "var(--down)" }}
          >
            {searchError}
          </p>
        ) : (
          !hasResults && (
            <p
              role="status"
              style={{ margin: 0, padding: "12px 14px", fontSize: 14, color: "var(--muted)" }}
            >
              No companies match &ldquo;{query.trim()}&rdquo;.
            </p>
          )
        )}
        <ul
          id={listboxId}
          role="listbox"
          aria-label="Company search results"
          hidden={!listOpen}
          style={{ listStyle: "none", margin: 0, padding: 0 }}
        >
          {/* Option children must be presentational, no nested focusable controls.
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
              className={`rsch-opt${i === active ? " is-active" : ""}`}
            >
              <span className="rsch-tag">{r.ticker}</span>
              <span
                style={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  fontSize: 14.5,
                  fontWeight: 500,
                }}
              >
                {r.name}
              </span>
            </li>
          ))}
        </ul>
      </div>
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
