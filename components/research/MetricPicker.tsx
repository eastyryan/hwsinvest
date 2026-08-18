"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { CaretDown, CaretRight } from "@phosphor-icons/react";
import {
  STATEMENT_METRIC_GROUPS,
  ALL_STATEMENT_METRICS,
  getStatementMetric,
  filterMetricGroups,
  type MetricDef,
  type MetricGroup,
  type MetricFormat,
  type MetricKind,
} from "@/lib/research/metric-catalog";
import { btnSelectCompact } from "./ui/buttonStyles";

export type { MetricFormat, MetricKind, MetricDef, MetricGroup };
export {
  STATEMENT_METRIC_GROUPS,
  ALL_STATEMENT_METRICS,
  getStatementMetric,
  filterMetricGroups,
};

/**
 * Expandable metric picker — groups for Income / Balance / Cash Flow / Margins
 * (or any custom groups). Used on Compare, Charts, and other statement pickers.
 */
export default function MetricPicker({
  value,
  onChange,
  groups = STATEMENT_METRIC_GROUPS,
  allowedKeys,
  ariaLabel = "Metric",
  className = "",
}: {
  value: string;
  onChange: (key: string) => void;
  groups?: MetricGroup[];
  /** When set, only metrics with these keys appear. */
  allowedKeys?: Set<string> | null;
  ariaLabel?: string;
  className?: string;
}) {
  const visibleGroups = useMemo(
    () => filterMetricGroups(groups, allowedKeys),
    [groups, allowedKeys]
  );
  const byKey = useMemo(() => {
    const m = new Map<string, MetricDef>();
    for (const g of visibleGroups) for (const x of g.metrics) m.set(x.key, x);
    return m;
  }, [visibleGroups]);

  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const g of STATEMENT_METRIC_GROUPS) {
      init[g.id] = g.metrics.some((m) => m.key === value);
    }
    if (!Object.values(init).some(Boolean)) init.income = true;
    return init;
  });
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const selected = byKey.get(value) ?? getStatementMetric(value);
  const selectedGroup = visibleGroups.find((g) => g.metrics.some((m) => m.key === value));

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function pickMetric(key: string) {
    const g = visibleGroups.find((x) => x.metrics.some((m) => m.key === key));
    if (g) setExpanded((prev) => ({ ...prev, [g.id]: true }));
    onChange(key);
    setOpen(false);
  }

  return (
    <div ref={rootRef} className={`relative min-w-[14rem] max-w-full ${className}`}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((o) => !o)}
        className={btnSelectCompact}
      >
        <span className="min-w-0 truncate">
          <span className="font-medium text-zinc-900 dark:text-zinc-100">
            {selected?.label ?? value}
          </span>
          {selectedGroup && (
            <span className="ml-1.5 font-normal text-zinc-500 dark:text-zinc-400">
              · {selectedGroup.label}
            </span>
          )}
        </span>
        <CaretDown
          size={12}
          weight="bold"
          aria-hidden
          className={`shrink-0 text-zinc-400 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          id={listId}
          role="listbox"
          aria-label={ariaLabel}
          className="absolute left-0 z-40 mt-1 max-h-[min(24rem,70vh)] w-[min(22rem,calc(100vw-2rem))] overflow-y-auto rounded-xl border border-zinc-200 bg-white py-1 shadow-2xl shadow-zinc-900/15 dark:border-zinc-700 dark:bg-zinc-900 dark:shadow-black/50"
        >
          {visibleGroups.map((g) => {
            const isOpen = expanded[g.id] ?? false;
            return (
              <div
                key={g.id}
                className="border-b border-zinc-100 last:border-b-0 dark:border-zinc-800"
              >
                <button
                  type="button"
                  onClick={() =>
                    setExpanded((prev) => ({ ...prev, [g.id]: !prev[g.id] }))
                  }
                  aria-expanded={isOpen}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-800/60"
                >
                  {isOpen ? (
                    <CaretDown size={12} weight="bold" aria-hidden className="shrink-0" />
                  ) : (
                    <CaretRight size={12} weight="bold" aria-hidden className="shrink-0" />
                  )}
                  <span className="flex-1">{g.label}</span>
                  <span className="font-mono text-[10px] font-normal normal-case tracking-normal text-zinc-400">
                    {g.metrics.length}
                  </span>
                </button>
                {isOpen && (
                  <ul className="pb-1">
                    {g.metrics.map((m) => {
                      const active = m.key === value;
                      return (
                        <li key={m.key} role="option" aria-selected={active}>
                          <button
                            type="button"
                            onClick={() => pickMetric(m.key)}
                            className={`flex w-full items-center px-3 py-1.5 pl-8 text-left text-sm ${
                              active
                                ? "bg-zinc-100 font-medium text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
                                : "text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800/50"
                            }`}
                          >
                            {m.label}
                            {m.format === "pct" && (
                              <span className="ml-auto text-[10px] text-zinc-400">%</span>
                            )}
                            {m.format === "x" && (
                              <span className="ml-auto text-[10px] text-zinc-400">×</span>
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
