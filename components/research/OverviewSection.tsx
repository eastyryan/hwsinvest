"use client";

import { useId, useState, type ReactNode } from "react";
import { CaretDown, CaretRight } from "@phosphor-icons/react";

/**
 * Full-width overview accordion. One card per topic — clean, not nested walls.
 * Bodies stay mounted after first open so child fetches aren't lost.
 * Print always reveals body (even if collapsed on screen).
 */
export default function OverviewSection({
  title,
  subtitle,
  summary,
  defaultOpen = false,
  children,
}: {
  title: string;
  subtitle?: string;
  summary?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [everOpened, setEverOpened] = useState(defaultOpen);
  const panelId = useId();

  function toggle() {
    setOpen((v) => {
      const next = !v;
      if (next) setEverOpened(true);
      return next;
    });
  }

  return (
    <section className="overview-section overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={toggle}
        className="flex w-full items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-zinc-50/80 dark:hover:bg-zinc-900/40 sm:px-5"
      >
        <span
          className="shrink-0 text-zinc-400 dark:text-zinc-500"
          aria-hidden
        >
          {open ? (
            <CaretDown size={18} weight="bold" />
          ) : (
            <CaretRight size={18} weight="bold" />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <span className="text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              {title}
            </span>
            {!open && summary != null && summary !== false && (
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                {summary}
              </span>
            )}
          </span>
          {subtitle && (
            <span className="mt-0.5 block text-xs leading-snug text-zinc-500 dark:text-zinc-400">
              {subtitle}
            </span>
          )}
        </span>
      </button>
      {everOpened && (
        <div
          id={panelId}
          hidden={!open}
          className="overview-section-body border-t border-zinc-100 px-4 py-5 dark:border-zinc-800 sm:px-5"
        >
          {children}
        </div>
      )}
    </section>
  );
}
