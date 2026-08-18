"use client";

/**
 * Clarifies annual vs quarterly vs TTM semantics for free SEC data.
 */
export default function PeriodBasisNote({
  freq,
}: {
  freq: "annual" | "quarterly";
}) {
  return (
    <p className="text-[11px] leading-snug text-zinc-500 dark:text-zinc-400">
      {freq === "annual" ? (
        <>
          <span className="font-medium text-zinc-600 dark:text-zinc-300">
            Annual basis
          </span>
          : as-filed fiscal years (newest first). Not restated vendor history.
        </>
      ) : (
        <>
          <span className="font-medium text-zinc-600 dark:text-zinc-300">
            Quarterly basis
          </span>
          : as-filed quarters. Ratios use TTM where the engine supports it;
          statement dollars are period flows, not annualized unless labeled.
        </>
      )}
    </p>
  );
}
