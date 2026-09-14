// Board-only calendar dates.
//
// Kept out of data/calendar.ts on purpose: that module ships inside the
// members dashboard bundle, and this one must not. Only the admin console
// imports it, so nothing here is readable by a member, in the UI or by digging
// through devtools.

import { sortEvents, weeklyMeetings, type ClubEvent } from "./calendar";

// Required college trainings. At least one executive board member must attend
// one session from each group, and any club member is welcome to go. Missing
// these costs the club its active status.

export const FIXED_EVENTS: ClubEvent[] = [
  {
    id: "club-training-a",
    title: "Club Training (option A)",
    date: "2026-09-15",
    start: "17:30",
    end: "18:30",
    location: "Geneva Room, Library",
    kind: "required",
    group: "Club Training",
    note: "Choose this session or the September 16th one. One exec board member must attend.",
  },
  {
    id: "club-training-b",
    title: "Club Training (option B)",
    date: "2026-09-16",
    start: "15:00",
    end: "16:00",
    location: "AIC Stine Room",
    kind: "required",
    group: "Club Training",
    note: "Choose this session or the September 15th one. One exec board member must attend.",
  },
  {
    id: "title-ix-a",
    title: "Title IX Training (option A)",
    date: "2026-09-29",
    start: "16:00",
    end: "17:00",
    location: "AIC Stine Room",
    kind: "required",
    group: "Title IX Training",
    note: "Choose this session or the October 5th one. One exec board member must attend.",
  },
  {
    id: "title-ix-b",
    title: "Title IX Training (option B)",
    date: "2026-10-05",
    start: "18:00",
    end: "19:00",
    location: "Geneva Room, Library",
    kind: "required",
    group: "Title IX Training",
    note: "Choose this session or the September 29th one. One exec board member must attend.",
  },
];

/** The full board schedule: the standing meetings plus the fixed dates. */
export function baseSchedule(): ClubEvent[] {
  return sortEvents([...weeklyMeetings(), ...FIXED_EVENTS]);
}
