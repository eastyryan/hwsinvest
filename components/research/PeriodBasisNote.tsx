"use client";

/**
 * Clarifies annual vs quarterly vs TTM semantics for free SEC data.
 */
export default function PeriodBasisNote({
  freq,
  statement,
}: {
  freq: "annual" | "quarterly";
  statement?: "income" | "balance" | "cashflow";
}) {
  const quarterlyDetail =
    statement === "balance"
      ? "Balance-sheet dollars are the quarter-end snapshot, not a flow for the quarter."
      : statement === "income" || statement === "cashflow"
        ? "Income and cash-flow dollars are period flows, not annualized unless labeled. The balance sheet, on its own tab, is the quarter-end snapshot."
        : "Flow ratios are trailing twelve months. Balance-sheet ratios are the quarter-end snapshot.";

  return (
    <p className="text-[11px] leading-snug text-zinc-500 dark:text-zinc-400">
      {freq === "annual" ? (
        <>
          <span className="font-medium text-zinc-600 dark:text-zinc-300">
            Annual basis
          </span>
          : as-filed fiscal years (newest first). Not restated vendor history.
          {statement === "balance"
            ? " Balance-sheet dollars are the year-end snapshot."
            : ""}
        </>
      ) : (
        <>
          <span className="font-medium text-zinc-600 dark:text-zinc-300">
            Quarterly basis
          </span>
          : as-filed quarters. {quarterlyDetail}
        </>
      )}
    </p>
  );
}
