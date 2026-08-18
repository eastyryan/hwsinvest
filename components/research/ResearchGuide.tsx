"use client";

import { useEffect, useState } from "react";

const STEPS = [
  {
    id: "overview",
    title: "Orient",
    body: "Skim the scorecard, narrative, and “what changed.” Note sector mode and data confidence badges.",
    hash: "overview",
  },
  {
    id: "statements",
    title: "Read the statements",
    body: "Income → balance → cash flow. Toggle common-size and YoY. Hover lines for source tags where available.",
    hash: "income",
  },
  {
    id: "qoe",
    title: "Quality of earnings",
    body: "Check accruals, cash conversion, and restatement callouts before trusting a multiple or DCF.",
    hash: "overview",
  },
  {
    id: "valuation",
    title: "Build a DCF",
    body: "Open Valuation → DCF. Start from history or street growth, stress WACC and terminal growth.",
    hash: "valuation",
  },
  {
    id: "triangulate",
    title: "Triangulate",
    body: "Expand comps, 52-week range, and football field. Treat illustrative precedents as templates only.",
    hash: "valuation",
  },
  {
    id: "ownership",
    title: "Ownership pulse",
    body: "Form 4 insiders, 13G/D holders, and politician trades — catalysts and governance context.",
    hash: "ownership",
  },
] as const;

const STORAGE_KEY = "researchGuide:v1";

/**
 * Collapsible guided research checklist for Overview.
 * Progress is local-only (free, no account).
 */
export default function ResearchGuide({ ticker }: { ticker: string }) {
  const key = `${STORAGE_KEY}:${ticker.toUpperCase()}`;
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [open, setOpen] = useState(true);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) setDone(JSON.parse(raw) as Record<string, boolean>);
      else setDone({});
    } catch {
      setDone({});
    }
  }, [key]);

  function toggle(id: string) {
    setDone((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        /* private mode */
      }
      return next;
    });
  }

  const completed = STEPS.filter((s) => done[s.id]).length;

  return (
    <section className="rounded-xl border border-zinc-200 bg-zinc-50/40 dark:border-zinc-800 dark:bg-zinc-900/30">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <div>
          <p className="text-sm font-semibold tracking-tight">Research guide</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            A free checklist for a complete first pass · {completed}/{STEPS.length} done
          </p>
        </div>
        <span className="font-mono text-xs text-zinc-400">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <ol className="space-y-2 border-t border-zinc-200 px-4 py-3 dark:border-zinc-800">
          {STEPS.map((step, i) => (
            <li
              key={step.id}
              className="flex gap-3 rounded-lg bg-white/80 px-3 py-2.5 dark:bg-zinc-950/50"
            >
              <input
                type="checkbox"
                checked={!!done[step.id]}
                onChange={() => toggle(step.id)}
                className="mt-1"
                aria-label={`Mark ${step.title} done`}
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="text-[11px] font-mono text-zinc-400">
                    {i + 1}.
                  </span>
                  <span className="text-sm font-medium">{step.title}</span>
                  <button
                    type="button"
                    className="text-[11px] font-medium text-sky-700 underline-offset-2 hover:underline dark:text-sky-300"
                    onClick={() => {
                      const next = `#${step.hash}`;
                      window.history.replaceState(null, "", next);
                      window.dispatchEvent(new Event("hashchange"));
                    }}
                  >
                    Go
                  </button>
                </div>
                <p className="mt-0.5 text-xs leading-snug text-zinc-500 dark:text-zinc-400">
                  {step.body}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
