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
  end: "21:00",
  location: "Stern 301",
  title: "Weekly club meeting",
};

export type Term = { label: string; start: string; end: string };

export const TERMS: Term[] = [
  // Fall 2026: intro on Sep 8, last meeting Dec 8 (from the term schedule).
  { label: "Fall 2026", start: "2026-09-08", end: "2026-12-08" },
  // { label: "Spring 2027", start: "2027-01-19", end: "2027-04-27" },
];

// Tuesdays we skip: breaks, reading days, finals. Add "YYYY-MM-DD" rows.
export const WEEKLY_SKIP: string[] = [
  "2026-11-24", // Thanksgiving week — no meeting
];

/**
 * Per-date overrides for the standing Tuesday meeting. When a night has a
 * published agenda (title, end time, note), put it here so the admin calendar
 * and the members "next meeting" strip show the real session instead of the
 * generic WEEKLY defaults. Missing dates still fall back to WEEKLY.
 */
export type SessionOverride = {
  title: string;
  end?: string;
  note?: string;
};

export const SESSION_OVERRIDES: Record<string, SessionOverride> = {
  "2026-09-08": {
    title: "Intro Meeting",
    end: "20:30",
    note: "Term kickoff. September 8 introduction is complete.",
  },
  "2026-09-15": {
    title: "Operating night",
    end: "20:45",
    note: "How the club runs. Recap method. Club book opens. Sample pitch.",
  },
  "2026-09-22": {
    title: "Equities, all sectors",
    end: "21:00",
    note: "How to cover the equity universe in one framework. First club-book names.",
  },
  "2026-09-29": {
    title: "Fixed income",
    end: "20:45",
    note: "Rates, credit, and how bonds sit next to the equity book.",
  },
  "2026-10-06": {
    title: "Guest speaker",
    end: "20:45",
    note: "First Tuesday of October. Career path / recruiting alum.",
  },
  "2026-10-13": {
    title: "Pitching and valuation basics",
    end: "20:45",
    note: "What a club pitch must include before the terminal arrives.",
  },
  "2026-10-20": {
    title: "Bloomberg workshop",
    end: "21:00",
    note: "First hands-on session after mid-October access.",
  },
  "2026-10-27": {
    title: "Financial modeling I",
    end: "21:00",
    note: "Three statements and how they link.",
  },
  "2026-11-03": {
    title: "Guest speaker",
    end: "20:45",
    note: "First Tuesday of November. Wealth management / insurance.",
  },
  "2026-11-10": {
    title: "Financial modeling II",
    end: "21:00",
    note: "DCF. Midpoint review of the club book.",
  },
  "2026-11-17": {
    title: "Club book work night",
    end: "20:45",
    note: "Revisit every position. Prepare the Thanksgiving hold.",
  },
  "2026-12-01": {
    title: "Guest speaker",
    end: "20:45",
    note: "First Tuesday of December. IB or long-horizon investor.",
  },
  "2026-12-08": {
    title: "Final meeting",
    end: "21:00",
    note: "Year-end recap. Full review of the club book. Close for winter break.",
  },
};

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
        const session = SESSION_OVERRIDES[day];
        out.push({
          id: `weekly-${day}`,
          title: session?.title ?? WEEKLY.title,
          date: day,
          start: WEEKLY.start,
          end: session?.end ?? WEEKLY.end,
          location: WEEKLY.location,
          kind: "weekly",
          note: session?.note ?? `${term.label} planning session.`,
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
