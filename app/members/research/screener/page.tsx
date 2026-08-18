import Screener from "@/components/research/Screener";
import Link from "next/link";

export const metadata = {
  title: "Screener · Research · HWS Investment Club",
  description: "Free SEC-filing based stock screener for liquid US names.",
};

export default function ScreenerPage() {
  return (
    <main className="min-h-[70vh] pb-16">
      <div className="flex items-center justify-between px-4 pt-6 sm:px-6">
        <Link
          href="/members/research"
          className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          ← Research home
        </Link>
      </div>
      <Screener />
    </main>
  );
}
