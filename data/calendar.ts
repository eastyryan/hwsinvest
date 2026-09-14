// Club calendar.
//
// Everything here is a plain local date in America/New_York. Dates are stored
// as "YYYY-MM-DD" strings and times as 24-hour "HH:MM" strings, never as Date
// objects, because `new Date("2026-09-15")` parses as UTC and would slide the
// weekly meeting onto the wrong day for anyone west of Geneva. Use the
// parseDay() helper below whenever a real Date is needed.
//
// This module is what the MEMBERS dashboard reads, so it holds the standing
// meeting and nothing else. Board-only dates (the college's required
// trainings) live in data/calendar-board.ts, which only /admin imports, so
// they never reach a member's JavaScript bundle.

export const CLUB_TZ = "America/New_York";

export type EventKind =
  | "weekly" // the standing Tuesday night meeting
  | "required" // college-mandated, attendance keeps us an active org
  | "club" // one-off club events: pitch night, speaker, socials
  | "custom"; // added from the admin console

export type ClubEvent = {
  id: string;
  title: string;
  /** YYYY-MM-DD, local to Geneva NY. */
  date: string;
  /** HH:MM, 24-hour, local. Omit for an all-day entry. */
  start?: string;
  /** HH:MM, 24-hour, local. Defaults to one hour after start. */
  end?: string;
  location?: string;
  kind: EventKind;
  note?: string;
  /**
   * Required trainings come in choose-one pairs. Sessions sharing a group are
   * two offerings of the same requirement, so attending either one clears it.
   */
  group?: string;
};

// ── The standing meeting ────────────────────────────────────
// Tuesday nights, 7:30 PM, Stern 301. Edit the term window when the semester
// changes; a spring term is added by appending another row to TERMS.

export const WEEKLY = {
  weekday: 2, // 0 = Sunday, so 2 = Tuesday
  start: "19:30",
  end: "20:30",
  location: "Stern 301",
  title: "Weekly club meeting",
};

export type Term = { label: string; start: string; end: string };

export const TERMS: Term[] = [
  { label: "Fall 2026", start: "2026-09-01", end: "2026-12-08" },
  // { label: "Spring 2027", start: "2027-01-19", end: "2027-04-27" },
];

// Tuesdays we skip: breaks, reading days, finals. Add "YYYY-MM-DD" rows.
export const WEEKLY_SKIP: string[] = [
  // "2026-11-24", // Thanksgiving break
];

// ── Helpers ─────────────────────────────────────────────────

/** Parse "YYYY-MM-DD" into a Date at local midnight (never UTC). */
export function parseDay(day: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/** Format a Date back to "YYYY-MM-DD" using its local fields. */
export function toDay(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${m}-${d}`;
}

/** Every weekly meeting across the configured terms, minus the skip list. */
export function weeklyMeetings(): ClubEvent[] {
  const skip = new Set(WEEKLY_SKIP);
  const out: ClubEvent[] = [];

  for (const term of TERMS) {
    const cursor = parseDay(term.start);
    const last = parseDay(term.end);
    // Walk forward to the term's first Tuesday.
    while (cursor.getDay() !== WEEKLY.weekday) cursor.setDate(cursor.getDate() + 1);

    while (cursor <= last) {
      const day = toDay(cursor);
      if (!skip.has(day)) {
        out.push({
          id: `weekly-${day}`,
          title: WEEKLY.title,
          date: day,
          start: WEEKLY.start,
          end: WEEKLY.end,
          location: WEEKLY.location,
          kind: "weekly",
          note: `${term.label} planning session.`,
        });
      }
      cursor.setDate(cursor.getDate() + 7);
    }
  }
  return out;
}

export function sortEvents(events: ClubEvent[]): ClubEvent[] {
  return [...events].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    return (a.start ?? "").localeCompare(b.start ?? "");
  });
}

/** "7:30 PM" from "19:30". */
export function timeLabel(hhmm?: string): string {
  if (!hhmm) return "All day";
  const [h, m] = hhmm.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m ?? 0).padStart(2, "0")} ${suffix}`;
}

/** "Tuesday, September 15" from "2026-09-15". */
export function dayLabel(day: string, opts: { weekday?: boolean; year?: boolean } = {}): string {
  return parseDay(day).toLocaleDateString("en-US", {
    weekday: opts.weekday === false ? undefined : "long",
    month: "long",
    day: "numeric",
    year: opts.year ? "numeric" : undefined,
  });
}

export const KIND_LABEL: Record<EventKind, string> = {
  weekly: "Weekly meeting",
  required: "Required",
  club: "Club event",
  custom: "Added",
};
