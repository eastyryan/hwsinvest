"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Sitewide reveal-on-scroll.
 *
 * Mounted once in the root layout: it finds the page's major blocks and fades
 * them up as they come into view, so scrolling has some life to it without
 * every page having to opt in by hand.
 *
 * Three things this deliberately does NOT do:
 *
 * 1. Hide anything in CSS. The "hidden" state is applied from JavaScript, so if
 *    the script never runs (no JS, a bundle error, a crawler), the page is
 *    fully visible rather than a column of blank space. Content visibility must
 *    not depend on an enhancement.
 * 2. Hide anything already on screen. An element painted above the fold is
 *    marked revealed in the same frame it is marked hidden, which the browser
 *    coalesces into no visible change. Hiding it and fading it back in would be
 *    a flash on every page load.
 * 3. Run at all when the reader asked for less motion.
 */

// Top-level page blocks. The research tool's tables and sticky toolbar live
// under `main > div`, so they are intentionally not matched, a data tool
// should feel immediate, not animated. Anything else opts in with `data-reveal`.
const SELECTOR = "[data-reveal], main > section, main > div[data-reveal-scope] > section";

const STAGGER_MS = 70;
const MAX_STAGGER_STEPS = 4;

export default function ScrollReveal() {
  const pathname = usePathname();

  useEffect(() => {
    if (
      typeof IntersectionObserver === "undefined" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    const els = Array.from(document.querySelectorAll<HTMLElement>(SELECTOR)).filter(
      (el) => !el.dataset.revealBound && !el.closest("[data-reveal-off]")
    );
    if (els.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("is-revealed");
          observer.unobserve(entry.target);
        }
      },
      // Held back slightly from the very bottom edge so a block starts moving
      // just after it enters, not the instant a single pixel appears.
      { rootMargin: "0px 0px -8% 0px", threshold: 0.04 }
    );

    // Siblings marked data-reveal come in one after another rather than as a
    // single slab: card grids read much better that way.
    const seenPerParent = new Map<Element, number>();
    const fold = window.innerHeight * 0.92;

    for (const el of els) {
      el.dataset.revealBound = "1";
      el.classList.add("reveal");

      if (el.dataset.reveal !== undefined && el.parentElement) {
        const n = seenPerParent.get(el.parentElement) ?? 0;
        seenPerParent.set(el.parentElement, n + 1);
        if (n > 0) {
          el.style.setProperty(
            "--reveal-delay",
            `${Math.min(n, MAX_STAGGER_STEPS) * STAGGER_MS}ms`
          );
        }
      }

      // Already on screen: reveal in the same frame, so nothing ever flashes.
      if (el.getBoundingClientRect().top < fold) {
        el.classList.add("is-revealed");
        continue;
      }
      observer.observe(el);
    }

    return () => {
      observer.disconnect();
      // Anything still waiting to be revealed loses its observer here, so drop
      // it back to plain visible rather than leaving it at opacity 0. Matters
      // if React ever reuses a section element across a route change: the
      // element would keep the hidden class with nothing left to clear it.
      for (const el of els) {
        if (!el.classList.contains("is-revealed")) {
          el.classList.remove("reveal");
          delete el.dataset.revealBound;
        }
      }
    };
  }, [pathname]);

  return null;
}
