"use client";

import { useSyncExternalStore } from "react";

/**
 * Shared subscription to `(prefers-reduced-motion: reduce)`.
 *
 * The CSS animations in globals.css are already gated on this media query, but
 * Recharts animates in JavaScript and ignores it entirely, every chart wipes
 * itself in over ~1.5s on mount and on every data change. That is exactly the
 * kind of motion the preference exists to suppress, so the charts read it too.
 *
 * One MediaQueryList for the whole app, and `getSnapshot` reads it
 * synchronously so a chart's *first* render already has animations off rather
 * than starting an animation and cancelling it a frame later.
 */
const QUERY = "(prefers-reduced-motion: reduce)";

let mql: MediaQueryList | null = null;

function getMql(): MediaQueryList | null {
  if (typeof window === "undefined" || !window.matchMedia) return null;
  if (!mql) mql = window.matchMedia(QUERY);
  return mql;
}

function subscribe(onStoreChange: () => void): () => void {
  const m = getMql();
  if (!m) return () => {};
  m.addEventListener("change", onStoreChange);
  return () => m.removeEventListener("change", onStoreChange);
}

const getSnapshot = () => getMql()?.matches ?? false;
// The server can't know the preference. `false` matches what the CSS does
// before hydration, and the first client snapshot corrects it.
const getServerSnapshot = () => false;

export default function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
