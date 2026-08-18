/**
 * Keyboard helpers for global shortcuts (watchlist J/K, etc.).
 * Keep shortcuts from firing while the user is typing or a modal is open.
 */

/** True when the event target is an editable field. */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const el = target;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
    // Allow shortcuts from non-text inputs (checkbox, button, range).
    if (tag === "INPUT") {
      const type = (el as HTMLInputElement).type?.toLowerCase() ?? "text";
      if (
        type === "button" ||
        type === "submit" ||
        type === "reset" ||
        type === "checkbox" ||
        type === "radio" ||
        type === "file" ||
        type === "range" ||
        type === "color"
      ) {
        return false;
      }
    }
    return true;
  }
  if (el.isContentEditable || el.getAttribute("contenteditable") === "true") {
    return true;
  }
  if (el.closest("[contenteditable='true']")) return true;
  // role=textbox (contenteditable-like widgets)
  if (el.closest('[role="textbox"]')) return true;
  return false;
}

/** True when the command palette dialog is open. */
export function isCommandPaletteOpen(): boolean {
  if (typeof document === "undefined") return false;
  return !!document.querySelector(
    '[role="dialog"][aria-label="Command palette"]'
  );
}

/**
 * True when a global navigation shortcut should be ignored.
 * Covers typing, command palette, and modifier chords (except Shift for letters).
 */
export function shouldIgnoreShortcut(e: KeyboardEvent): boolean {
  if (e.metaKey || e.ctrlKey || e.altKey) return true;
  if (isEditableTarget(e.target)) return true;
  if (isCommandPaletteOpen()) return true;
  return false;
}

/** J / ] → next; K / [ → prev. Returns null if not a nav key. */
export function watchlistNavDelta(e: KeyboardEvent): 1 | -1 | null {
  const k = e.key;
  if (k === "j" || k === "J" || k === "]") return 1;
  if (k === "k" || k === "K" || k === "[") return -1;
  return null;
}
