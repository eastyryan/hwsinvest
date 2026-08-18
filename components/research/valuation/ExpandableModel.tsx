"use client";

import { useId, useState, type ReactNode } from "react";
import { CaretDown, CaretRight } from "@phosphor-icons/react";

/**
 * Collapsed-by-default valuation module shell.
 * After the first open, children stay mounted (hidden) so network loads and
 * onRange callbacks remain available to the football-field synthesizer.
 */
export default function ExpandableModel({
  title,
  subtitle,
  summary,
  defaultOpen = false,
  children,
}: {
  title: string;
  subtitle?: string;
  /** One-line teaser shown while collapsed (e.g. range preview). */
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
    <section className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={toggle}
        className="flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
      >
        <span className="mt-0.5 shrink-0 text-zinc-500 dark:text-zinc-400" aria-hidden>
          {open ? <CaretDown size={16} weight="bold" /> : <CaretRight size={16} weight="bold" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <span className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
              {title}
            </span>
            {!open && summary != null && summary !== false && (
              <span className="text-xs font-medium tabular-nums text-zinc-500 dark:text-zinc-400">
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
          className="space-y-4 border-t border-zinc-200 px-4 py-4 dark:border-zinc-800"
        >
          {children}
        </div>
      )}
    </section>
  );
}
