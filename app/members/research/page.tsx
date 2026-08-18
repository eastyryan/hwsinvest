"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import SearchBox from "@/components/research/SearchBox";
import ThemeToggle from "@/components/research/ThemeToggle";
import RecentCompanies from "@/components/research/RecentCompanies";
import WatchlistHome from "@/components/research/WatchlistHome";
import AlertsBanner from "@/components/research/AlertsBanner";
import PortfolioWeights from "@/components/research/PortfolioWeights";

const homeHeaderBtn =
  "inline-flex h-9 shrink-0 items-center justify-center rounded-lg border border-zinc-300 bg-white px-3.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900";

export default function ResearchPage() {
  const [searchOpen, setSearchOpen] = useState(false);
  const onPanelOpenChange = useCallback((open: boolean) => {
    setSearchOpen(open);
  }, []);

  return (
    <main className="flex min-h-[70vh] flex-col overflow-x-hidden">
      <AlertsBanner />
      <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 pt-6 sm:px-6">
        <Link
          href="/members"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          <ArrowLeft size={15} strokeWidth={2.2} /> Dashboard
        </Link>
        <div className="flex items-center gap-2">
          <Link href="/members/research/screener" className={homeHeaderBtn}>
            Screener
          </Link>
          <kbd
            className={`${homeHeaderBtn} hidden min-w-9 px-2.5 font-mono text-[11px] text-zinc-500 sm:inline-flex dark:text-zinc-400`}
            title="Open command palette"
          >
            ⌘K
          </kbd>
          <ThemeToggle />
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-3xl min-w-0 flex-1 flex-col justify-center px-4 pb-16 pt-10 sm:px-6 sm:pb-24 sm:pt-14">
        <p className="kicker mb-3">Research</p>
        <h1 className="animate-rise text-[2rem] font-semibold tracking-tight leading-[1.05] text-zinc-900 sm:text-4xl md:text-5xl dark:text-zinc-50">
          What company do you
          <br />
          want to look at?
        </h1>
        <p className="lede mt-4 max-w-[52ch] text-zinc-600 dark:text-zinc-400">
          Search any US-listed company and read its full financial history from SEC
          filings: statements, ratios, ownership, valuation models, segments, and Excel export.
        </p>
        <div className="animate-rise mt-8 min-w-0 sm:mt-10 [animation-delay:120ms]">
          <SearchBox large onPanelOpenChange={onPanelOpenChange} />
        </div>

        <div
          className="animate-rise mt-3 grid grid-cols-2 gap-x-4 sm:gap-x-8 [animation-delay:200ms]"
          style={{ marginTop: searchOpen ? 16 : 12 }}
        >
          <RecentCompanies shifted={searchOpen} />
          <WatchlistHome shifted={searchOpen} />
        </div>

        <div className="animate-rise mt-8 [animation-delay:240ms]">
          <PortfolioWeights />
        </div>
      </div>
    </main>
  );
}
