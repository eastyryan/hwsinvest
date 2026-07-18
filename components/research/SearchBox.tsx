"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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
}: {
  large?: boolean;
  onSelect?: (r: Result) => void; // when set, selection calls back instead of navigating
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [navigating, setNavigating] = useState(false);
  const router = useRouter();
  const boxRef = useRef<HTMLDivElement>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    if (!query.trim()) {
      setResults([]);
      setOpen(false);
      return;
    }
    debounce.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/research/search?q=${encodeURIComponent(query)}`);
        const data: Result[] = await res.json();
        setResults(data);
        setActive(0);
        setOpen(data.length > 0);
      } catch {
        setResults([]);
      }
    }, 150);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [query]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const go = useCallback(
    (r: Result) => {
      setOpen(false);
      if (onSelect) {
        setQuery("");
        setResults([]);
        onSelect(r);
        return;
      }
      setNavigating(true);
      setQuery(`${r.name} (${r.ticker})`);
      router.push(`/members/research/${r.ticker.toLowerCase()}`);
    },
    [router, onSelect]
  );

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(results[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

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
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={() => results.length > 0 && setOpen(true)}
        placeholder={placeholder}
        autoFocus={large}
        disabled={navigating}
        aria-label="Search a company name or ticker"
        aria-expanded={open}
        role="combobox"
        aria-controls="rsch-search-results"
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
      {open && (
        <ul id="rsch-search-results" role="listbox" className="rsch-menu">
          {results.map((r, i) => (
            <li key={r.cik + r.ticker} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseEnter={() => setActive(i)}
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
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
