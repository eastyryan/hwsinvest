// Shared control sizing so toolbar vs compact tools stay consistent app-wide.
//
// Two tiers (same border colour within each tier; compact uses a thinner stroke):
//   • primary  — h-9, border-2 border-zinc-900 (Watch, Excel, Annual/Quarterly, search)
//   • compact  — h-7, border-[0.5px] border-zinc-300 (Copy TSV, $ / % of revenue, filters)

const focus =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:focus-visible:outline-zinc-100";

/** Shared chrome for every primary control. */
const primaryChrome =
  "border-2 border-zinc-900 dark:border-zinc-100";

/** Shared chrome for every compact control — thinner stroke than primary. */
const compactChrome =
  "border-[0.5px] border-zinc-300 dark:border-zinc-700";

/** Fixed height for every primary toolbar control. */
export const btnToolbarBase = `inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg ${primaryChrome} px-3.5 text-sm font-medium transition-colors ${focus}`;

/** Neutral primary toolbar button (Watch, Print / PDF, Copy compare link). */
export const btnToolbar = `${btnToolbarBase} bg-white text-zinc-900 hover:bg-zinc-50 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900`;

/** Emphasized primary button (Download Excel) — same border as siblings, filled on hover. */
export const btnToolbarPrimary = `${btnToolbarBase} bg-white text-zinc-900 hover:bg-zinc-900 hover:text-white dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-100 dark:hover:text-zinc-900`;

/** Watch button when starred — same size/border, amber fill. */
export const btnToolbarWatchActive = `${btnToolbarBase} border-amber-600 bg-amber-50 text-amber-950 dark:border-amber-400 dark:bg-amber-950/40 dark:text-amber-100`;

/** Outer shell for segmented primary toolbars (Annual | Quarterly). */
export const btnSegmentedToolbar = `inline-flex h-9 shrink-0 items-stretch rounded-lg ${primaryChrome} bg-white p-0.5 dark:bg-zinc-950`;

/** Segment option inside a primary-height group. */
export const btnSegmentedToolbarItem = (active: boolean) =>
  `inline-flex items-center justify-center rounded-md px-3.5 text-sm font-medium capitalize transition-colors ${focus} ${
    active
      ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
      : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
  }`;

/** Compact outline button (Copy TSV, Reset, secondary tools). */
export const btnCompact = `inline-flex h-7 shrink-0 items-center justify-center gap-1 rounded-lg ${compactChrome} bg-white px-2.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900 ${focus}`;

/** Compact primary (same compact chrome, hover fill). */
export const btnCompactPrimary = `inline-flex h-7 shrink-0 items-center justify-center gap-1 rounded-lg ${compactChrome} bg-white px-2.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-900 hover:text-white dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-100 dark:hover:text-zinc-900 ${focus}`;

/**
 * Compact select / dropdown trigger (MetricPicker, etc.).
 * Same height + border as btnCompact / btnSegmentedCompact so rows of tools align.
 */
export const btnSelectCompact = `inline-flex h-7 w-full min-w-[14rem] shrink-0 items-center justify-between gap-2 rounded-lg ${compactChrome} bg-white px-2.5 text-left text-xs transition-colors hover:bg-zinc-50 dark:bg-zinc-950 dark:hover:bg-zinc-900 ${focus}`;

/** Outer shell for compact segmented controls ($ | % of revenue). */
export const btnSegmentedCompact = `inline-flex h-7 shrink-0 items-stretch rounded-lg ${compactChrome} bg-white p-0.5 dark:bg-zinc-950`;

/** Segment option inside a compact group. */
export const btnSegmentedCompactItem = (active: boolean) =>
  `inline-flex items-center justify-center rounded-md px-2.5 text-xs font-medium transition-colors ${focus} ${
    active
      ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
      : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
  }`;

/** Search input — matches primary toolbar height and border chrome. */
export const inputPrimary = `w-full rounded-lg ${primaryChrome} bg-white px-3.5 text-sm text-zinc-900 placeholder-zinc-500 outline-none transition-shadow focus:shadow-[0_0_0_3px_rgba(24,24,27,0.12)] disabled:opacity-60 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:shadow-[0_0_0_3px_rgba(244,244,245,0.15)]`;
