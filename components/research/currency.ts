"use client";

/**
 * Currency-aware display helpers.
 *
 * `lib/format.ts` hard-codes a `$` prefix, which is wrong twice over: filers
 * report in their own currency (SEC accepts EUR, GBP, ILS, …), and the prices
 * we chart are quoted in the exchange's currency, which need not match the
 * filing currency either. Anything that renders a money value with a symbol
 * goes through here so the label always matches the number.
 */

/** Symbols worth showing inline; everything else falls back to the ISO code. */
const SYMBOLS: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  JPY: "¥",
  CNY: "¥",
  CHF: "CHF ",
  CAD: "CA$",
  AUD: "AU$",
  ILS: "₪",
  INR: "₹",
  KRW: "₩",
  BRL: "R$",
  MXN: "MX$",
  SEK: "SEK ",
  DKK: "DKK ",
  NOK: "NOK ",
};

/** Prefix for a bare number, e.g. "$" or "SEK ". Never empty. */
export function currencyPrefix(code: string | null | undefined): string {
  const c = (code || "USD").toUpperCase();
  return SYMBOLS[c] ?? `${c} `;
}

/** A price or per-share figure: "$327.74", "SEK 1,204.00". */
export function fmtMoney(
  v: number,
  code: string | null | undefined,
  digits = 2,
): string {
  const abs = Math.abs(v).toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  return (v < 0 ? "-" : "") + currencyPrefix(code) + abs;
}

/**
 * Abbreviated magnitude for headline figures: "$4.81T", "€912.4B".
 *
 * Replaces `fmtMarketCap`, which always emitted a `$` and therefore rendered
 * "$1.2T EUR market cap" for European filers.
 */
export function fmtBig(v: number, code: string | null | undefined): string {
  const p = currencyPrefix(code);
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (abs >= 1e12) return `${sign}${p}${(abs / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${sign}${p}${(abs / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${sign}${p}${(abs / 1e6).toFixed(0)}M`;
  return `${sign}${p}${abs.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

/**
 * A statement value already expressed in millions, with the accounting
 * parenthesis convention preserved: "1,234", "(1,234)".
 *
 * `fmtValue` from lib does the same but callers kept appending a bare "M",
 * producing "(1,234)M". This keeps the suffix inside the parentheses.
 */
export function fmtMillions(v: number, code?: string | null): string {
  const m = v / 1e6;
  const abs = Math.abs(m);
  const s =
    abs.toLocaleString("en-US", { maximumFractionDigits: abs < 10 ? 1 : 0 }) + "M";
  const body = code ? currencyPrefix(code) + s : s;
  return m < 0 ? `(${body})` : body;
}

/** True when a reported figure is present and actually usable. */
export function isRealNumber(v: number | null | undefined): v is number {
  return typeof v === "number" && Number.isFinite(v) && v !== 0;
}
