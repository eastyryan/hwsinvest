"use client";

import { useEffect, useState } from "react";
import { prettyDay } from "@/lib/research/catalysts";
import type { MacroPrint } from "@/lib/research/macro-calendar";

interface Payload {
  events: MacroPrint[];
  note: string;
}

function cell(value: string | null): string {
  return value ?? "—";
}

export default function MacroCalendar() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch("/api/research/calendar", { signal: ctrl.signal })
      .then(async (res) => {
        const json = (await res.json()) as Payload & { error?: string };
        if (!res.ok) throw new Error(json.error || "Could not load the calendar.");
        setData(json);
      })
      .catch((e: unknown) => {
        if (ctrl.signal.aborted) return;
        setError(e instanceof Error ? e.message : "Could not load the calendar.");
      });
    return () => ctrl.abort();
  }, []);

  if (error) {
    return <p className="text-sm text-red-700 dark:text-red-400">{error}</p>;
  }
  if (!data) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400" aria-busy="true">
        Loading the calendar…
      </p>
    );
  }

  const days: { date: string; rows: MacroPrint[] }[] = [];
  for (const event of data.events) {
    const last = days[days.length - 1];
    if (last && last.date === event.date) last.rows.push(event);
    else days.push({ date: event.date, rows: [event] });
  }

  return (
    <div>
      <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
        {data.note} A dash means the calendar has no number. The feed covers the current week only.
      </p>
      {days.length === 0 ? (
        <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-300">
          No high-importance US releases on this week&apos;s calendar.
        </p>
      ) : (
        <div className="mt-6 space-y-8">
          {days.map((day) => (
            <section key={day.date}>
              <h2 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                {prettyDay(day.date)}
              </h2>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full min-w-[36rem] text-left text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                      <th className="w-28 py-2 pr-3 font-medium">Time</th>
                      <th className="py-2 pr-3 font-medium">Release</th>
                      <th className="w-28 py-2 pr-3 text-right font-medium">Expectation</th>
                      <th className="w-28 py-2 pr-3 text-right font-medium">Last</th>
                      <th className="w-28 py-2 text-right font-medium">Actual</th>
                    </tr>
                  </thead>
                  <tbody>
                    {day.rows.map((row) => (
                      <tr
                        key={row.id}
                        className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/80"
                      >
                        <td className="py-2.5 pr-3 align-top font-mono text-xs whitespace-nowrap text-zinc-500 dark:text-zinc-400">
                          {row.timeEt || "—"}
                        </td>
                        <td className="py-2.5 pr-3 align-top text-zinc-900 dark:text-zinc-100">
                          {row.title}
                        </td>
                        <td className="py-2.5 pr-3 text-right align-top font-mono text-xs tabular-nums text-zinc-800 dark:text-zinc-200">
                          {cell(row.forecast)}
                        </td>
                        <td className="py-2.5 pr-3 text-right align-top font-mono text-xs tabular-nums text-zinc-800 dark:text-zinc-200">
                          {cell(row.previous)}
                        </td>
                        <td className="py-2.5 text-right align-top font-mono text-xs tabular-nums text-zinc-800 dark:text-zinc-200">
                          {cell(row.actual)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
