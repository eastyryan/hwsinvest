"use client";

import type { Insights, Insight } from "@/lib/research/insights";
import type { Narrative } from "@/lib/research/narrative";

export interface AiSummary {
  business: string;
  momentum: string;
  catalysts: string;
}

function Group({
  title,
  items,
  accent,
}: {
  title: string;
  items: Insight[];
  accent: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-100 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-900/30">
      <h3 className={`text-xs font-semibold uppercase tracking-wide ${accent}`}>
        {title}
      </h3>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Nothing notable in recent quarters.
        </p>
      ) : (
        <ul className="mt-2 space-y-2.5">
          {items.map((ins, i) => (
            <li key={i}>
              <p className="text-sm leading-snug">{ins.text}</p>
              {ins.detail && (
                <p className="mt-0.5 text-xs leading-snug text-zinc-500 dark:text-zinc-400">
                  {ins.detail}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function Summary({
  insights,
  narrative,
  summary,
  loading = false,
  /** Which blocks to show — overview accordion splits these. */
  parts = "both",
  /** Hide internal h2 when parent accordion already titles the section. */
  hideChrome = false,
}: {
  insights: Insights;
  narrative?: Narrative | null;
  summary?: AiSummary | null;
  loading?: boolean;
  parts?: "analyst" | "numbers" | "both";
  hideChrome?: boolean;
}) {
  const shown = summary ?? narrative ?? null;
  const isAi = summary != null;
  const showAnalyst = parts === "analyst" || parts === "both";
  const showNumbers = parts === "numbers" || parts === "both";

  return (
    <div className="space-y-6">
      {showAnalyst && shown && (
        <div>
          {!hideChrome && (
            <>
              <div className="flex flex-wrap items-baseline gap-x-3">
                <h2 className="text-lg font-semibold tracking-tight">
                  Analyst read
                </h2>
                {loading && !isAi && (
                  <span
                    role="status"
                    aria-live="polite"
                    className="text-xs text-zinc-500 dark:text-zinc-400"
                  >
                    Refining with Claude&hellip;
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                {isAi
                  ? "Written by Claude from the filed numbers. Not investment advice."
                  : "Computed directly from the filed numbers. Not investment advice."}
              </p>
            </>
          )}
          {hideChrome && loading && !isAi && (
            <p
              role="status"
              aria-live="polite"
              className="mb-2 text-xs text-zinc-500 dark:text-zinc-400"
            >
              Refining with Claude&hellip;
            </p>
          )}
          <div
            className={`w-full space-y-3 ${
              hideChrome
                ? ""
                : "mt-3 rounded-xl border border-zinc-200 bg-zinc-50/60 p-5 dark:border-zinc-800 dark:bg-zinc-900/40"
            }`}
          >
            <p className="text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">
              {shown.business}
            </p>
            <p className="text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">
              {shown.momentum}
            </p>
            <p className="text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">
              {shown.catalysts}
            </p>
            {hideChrome && (
              <p className="pt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                {isAi
                  ? "Written by Claude from the filed numbers. Not investment advice."
                  : "Computed from filings. Not investment advice."}
              </p>
            )}
          </div>
        </div>
      )}

      {showAnalyst && !shown && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {loading
            ? "Preparing analyst read…"
            : "Analyst read unavailable for this filer."}
        </p>
      )}

      {showNumbers && (
        <div>
          {!hideChrome && (
            <>
              <h2 className="text-lg font-semibold tracking-tight">
                What the numbers say
              </h2>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Computed from the last few quarters of filings. Not investment
                advice.
              </p>
            </>
          )}
          <div
            className={`grid gap-3 md:grid-cols-3 ${hideChrome ? "" : "mt-4"}`}
          >
            <Group
              title="Growing"
              items={insights.growing}
              accent="text-emerald-700 dark:text-emerald-400"
            />
            <Group
              title="Slowing"
              items={insights.slowing}
              accent="text-red-700 dark:text-red-400"
            />
            <Group
              title="Catalysts to watch"
              items={insights.catalysts}
              accent="text-sky-700 dark:text-sky-400"
            />
          </div>
        </div>
      )}
    </div>
  );
}
