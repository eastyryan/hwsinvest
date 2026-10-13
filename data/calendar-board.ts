// Board-only calendar dates.
//
// Kept out of data/calendar.ts on purpose: that module ships inside the
// members dashboard bundle, and this one must not. Only the admin console
// imports it, so nothing here is readable by a member, in the UI or by digging
// through devtools.

import { sortEvents, weeklyMeetings, type ClubEvent } from "./calendar";

// Board-only dates that are not the standing club meeting.
// Club Training and Title IX are finished, so they are not listed. Events here
// have no `group`: the admin calendar's required-training warning only appears
// for grouped sessions, and that warning should stay off.

export const FIXED_EVENTS: ClubEvent[] = [
  {
    id: "sga-2026-10-26",
    title: "Student government",
    date: "2026-10-26",
    start: "20:00",
    end: "21:00",
    location: "Bartlett Theatre",
    kind: "club",
    note: "Extra board meeting.",
  },
  {
    id: "sga-2026-11-16",
    title: "Student government",
    date: "2026-11-16",
    start: "20:00",
    end: "21:00",
    location: "Bartlett Theatre",
    kind: "club",
    note: "Extra board meeting.",
  },
];

/** The full board schedule: the standing meetings plus the fixed dates. */
export function baseSchedule(): ClubEvent[] {
  return sortEvents([...weeklyMeetings(), ...FIXED_EVENTS]);
}
