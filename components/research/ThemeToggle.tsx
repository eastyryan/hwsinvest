"use client";

import { useSyncExternalStore } from "react";
import { Sun, Moon } from "@phosphor-icons/react";
import useIsDark from "./useIsDark";

// Whether we're past hydration. Reading the DOM is only safe on the client, and
// useSyncExternalStore gives us that without a setState-in-effect round trip:
// the server snapshot is false, the client snapshot is true.
const subscribeNoop = () => () => {};
const useMounted = () =>
  useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false
  );

export default function ThemeToggle() {
  // Shares the app-wide MutationObserver, so the button icon stays in sync if
  // the theme is changed anywhere else.
  const dark = useIsDark();
  const mounted = useMounted();

  function toggle() {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      // Private mode / storage disabled: the toggle still works for this page.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={
        !mounted
          ? "Toggle color theme"
          : dark
            ? "Switch to light mode"
            : "Switch to dark mode"
      }
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border-[0.5px] border-zinc-300 bg-white text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900"
    >
      {!mounted ? (
        // Stable placeholder so the control isn't an empty 36x36 box.
        <Moon size={16} weight="bold" aria-hidden className="opacity-40" />
      ) : dark ? (
        <Sun size={16} weight="bold" aria-hidden />
      ) : (
        <Moon size={16} weight="bold" aria-hidden />
      )}
    </button>
  );
}
