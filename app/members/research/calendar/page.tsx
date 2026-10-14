import Link from "next/link";
import MacroCalendar from "@/components/research/MacroCalendar";

export const metadata = {
  title: "Calendar · Research · HWS Investment Club",
  description:
    "High-importance US economic releases with the consensus expectation and the last print.",
};

export default function CalendarPage() {
  return (
    <main className="min-h-[70vh] pb-16">
      <div className="mx-auto max-w-3xl px-4 pt-6 sm:px-6">
        <div className="flex items-center justify-between">
          <Link
            href="/members/research"
            className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            ← Research home
          </Link>
          <Link
            href="/members/research/screener"
            className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            Screener
          </Link>
        </div>
        <h1 className="mt-8 text-3xl font-semibold tracking-tighter text-zinc-900 sm:text-4xl dark:text-zinc-50">
          Calendar
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          High-importance US releases. Expectation is the published consensus and last is the prior release. Company filings, earnings dates, and presentations stay on each company overview.
        </p>
        <div className="mt-8">
          <MacroCalendar />
        </div>
      </div>
    </main>
  );
}
