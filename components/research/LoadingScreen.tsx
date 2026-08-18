"use client";

import { useEffect, useState } from "react";

const LINES = [
  "Reading 10-Ks so you don't have to",
  "Pulling every filing since 2009",
  "Adding up the quarters",
  "Cross-checking the balance sheet",
  "Finding what's growing and what's slowing",
  "Sharpening the pencils",
];

export default function LoadingScreen({ name }: { name: string }) {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % LINES.length), 2400);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-8 px-6">
      {/* One stable announcement. The rotating copy below is decorative: piping
          it through a live region made a screen reader read six marketing lines
          on a loop while the page loaded. */}
      <p role="status" className="sr-only">
        Loading financial statements for {name}.
      </p>
      <div className="w-full max-w-sm" aria-hidden>
        <p className="font-mono text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Opening the books on
        </p>
        <p className="mt-1 truncate text-2xl font-semibold tracking-tight">{name}</p>
        <div className="mt-6 h-1 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
          <div className="animate-ticker-scan h-full w-full rounded-full bg-zinc-900 dark:bg-zinc-100" />
        </div>
        <p key={idx} className="animate-fade-swap mt-4 text-sm text-zinc-500 dark:text-zinc-400">
          {LINES[idx]}&hellip;
        </p>
      </div>
    </div>
  );
}
