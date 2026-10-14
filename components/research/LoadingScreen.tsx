"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import CompanyLogo from "./CompanyLogo";

const LINES = [
  "Reading 10-Ks so you don't have to",
  "Pulling every filing since 2009",
  "Adding up the quarters",
  "Cross-checking the balance sheet",
  "Finding what's growing and what's slowing",
  "Sharpening the pencils",
];

export default function LoadingScreen({
  name,
  ticker,
}: {
  name: string;
  ticker?: string;
}) {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % LINES.length), 2400);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <header className="flex items-center px-4 pt-3 sm:px-6 sm:pt-4">
        <Link
          href="/members/research"
          className="text-[15px] font-semibold tracking-tight text-zinc-950 hover:text-zinc-600 dark:text-zinc-50 dark:hover:text-zinc-300"
        >
          TrenchTick
        </Link>
      </header>
      <div className="flex flex-1 flex-col items-center justify-center gap-8 px-6">
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
          <div className="mt-1 flex min-w-0 items-center gap-2">
            {ticker && <CompanyLogo ticker={ticker} size={32} />}
            <p className="min-w-0 truncate text-2xl font-semibold tracking-tight">{name}</p>
            {ticker && (
              <span className="shrink-0 rounded-md bg-zinc-900 px-2 py-1 font-mono text-xs font-bold text-white dark:bg-zinc-100 dark:text-zinc-900">
                {ticker}
              </span>
            )}
          </div>
          <div className="mt-6 h-1 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
            <div className="animate-ticker-scan h-full w-full rounded-full bg-zinc-900 dark:bg-zinc-100" />
          </div>
          <p key={idx} className="animate-fade-swap mt-4 text-sm text-zinc-500 dark:text-zinc-400">
            {LINES[idx]}&hellip;
          </p>
        </div>
      </div>
    </div>
  );
}
