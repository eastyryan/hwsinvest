"use client";

import { useId, useState, type ReactNode } from "react";
import { CaretDown, CaretRight } from "@phosphor-icons/react";

/**
 * The six open overview cards share this height. Tall enough to read a
 * paragraph or a block of figures, short enough that the next row stays in reach.
 */
export const OPEN_CARD_CLASS =
  "overview-scroll-card flex h-[24rem] min-h-0 flex-col overflow-hidden print:h-auto";
export const OPEN_CARD_BODY_CLASS =
  "overview-scroll-body min-h-0 flex-1 overflow-y-auto overflow-x-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/70";

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
  scrollBody = false,
  className = "",
  children,
}: {
  title: string;
  subtitle?: string;
  summary?: ReactNode;
  defaultOpen?: boolean;
  /** Fixed height with a vertical scroll, used by the six cards that open with the page. */
  scrollBody?: boolean;
  className?: string;
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

  const pinned = scrollBody && open;

  return (
    <section
      className={`overview-section min-w-0 rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 ${
        pinned ? OPEN_CARD_CLASS : scrollBody ? "h-auto self-start overflow-hidden" : "h-full overflow-hidden"
      } ${className}`}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={toggle}
        className="flex w-full shrink-0 items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-zinc-50/80 dark:hover:bg-zinc-900/40 sm:px-5"
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
          tabIndex={pinned ? 0 : undefined}
          aria-label={pinned ? title : undefined}
          className={`overview-section-body @container border-t border-zinc-100 px-4 py-5 dark:border-zinc-800 sm:px-5 ${
            pinned ? OPEN_CARD_BODY_CLASS : ""
          }`}
        >
          {children}
        </div>
      )}
    </section>
  );
}
