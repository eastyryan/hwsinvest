"use client";

import { useSyncExternalStore } from "react";

/**
 * Shared subscription to the `dark` class on <html>.
 *
 * One MutationObserver is created for the whole app (not one per chart), and
 * `getSnapshot` reads the DOM synchronously so charts render with the correct
 * palette on their first client render instead of flashing light colors.
 */
const listeners = new Set<() => void>();
let observer: MutationObserver | null = null;

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  if (!observer) {
    observer = new MutationObserver(() => {
      for (const l of listeners) l();
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
  }
  return () => {
    listeners.delete(onStoreChange);
    if (listeners.size === 0 && observer) {
      observer.disconnect();
      observer = null;
    }
  };
}

const getSnapshot = () => document.documentElement.classList.contains("dark");
// The server always renders the light palette; the pre-paint theme script runs
// before hydration, so the first post-hydration snapshot corrects it.
const getServerSnapshot = () => false;

export default function useIsDark(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
