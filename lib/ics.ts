// Build an .ics calendar file from club events so anyone can subscribe the
// schedule into Google Calendar, Apple Calendar, or Outlook.
//
// Times are written with TZID=America/New_York and the file carries the
// matching VTIMEZONE block, so a phone in a different time zone still shows
// the meeting at 7:30 PM Geneva time.

import { CLUB_TZ, type ClubEvent } from "@/data/calendar";

// US Eastern rules since 2007: DST starts the 2nd Sunday in March, ends the
// 1st Sunday in November.
const VTIMEZONE = [
  "BEGIN:VTIMEZONE",
  `TZID:${CLUB_TZ}`,
  "BEGIN:DAYLIGHT",
  "TZOFFSETFROM:-0500",
  "TZOFFSETTO:-0400",
  "TZNAME:EDT",
  "DTSTART:19700308T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU",
  "END:DAYLIGHT",
  "BEGIN:STANDARD",
  "TZOFFSETFROM:-0400",
  "TZOFFSETTO:-0500",
  "TZNAME:EST",
  "DTSTART:19701101T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU",
  "END:STANDARD",
  "END:VTIMEZONE",
];

function escape(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

/** "2026-09-15" + "19:30" → "20260915T193000" */
function stamp(day: string, time: string): string {
  return `${day.replace(/-/g, "")}T${time.replace(":", "")}00`;
}

/** Add an hour to "19:30", wrapping at midnight. */
function plusHour(time: string): string {
  const [h, m] = time.split(":").map(Number);
  return `${String((h + 1) % 24).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Fold long lines at 75 octets, as RFC 5545 requires. */
function fold(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [line.slice(0, 75)];
  let rest = line.slice(75);
  while (rest.length > 74) {
    parts.push(" " + rest.slice(0, 74));
    rest = rest.slice(74);
  }
  if (rest) parts.push(" " + rest);
  return parts.join("\r\n");
}

export function buildIcs(events: ClubEvent[], calendarName = "HWS Investment Club"): string {
  const now = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//HWS Investment Club//Club Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escape(calendarName)}`,
    `X-WR-TIMEZONE:${CLUB_TZ}`,
    ...VTIMEZONE,
  ];

  for (const e of events) {
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${e.id}@hwsinvestmentclub`);
    lines.push(`DTSTAMP:${now}`);

    if (e.start) {
      const end = e.end ?? plusHour(e.start);
      lines.push(`DTSTART;TZID=${CLUB_TZ}:${stamp(e.date, e.start)}`);
      lines.push(`DTEND;TZID=${CLUB_TZ}:${stamp(e.date, end)}`);
    } else {
      // All-day event: DTEND is exclusive, so it points at the next morning.
      const next = new Date(
        Number(e.date.slice(0, 4)),
        Number(e.date.slice(5, 7)) - 1,
        Number(e.date.slice(8, 10)) + 1
      );
      const nextDay = `${next.getFullYear()}${String(next.getMonth() + 1).padStart(2, "0")}${String(
        next.getDate()
      ).padStart(2, "0")}`;
      lines.push(`DTSTART;VALUE=DATE:${e.date.replace(/-/g, "")}`);
      lines.push(`DTEND;VALUE=DATE:${nextDay}`);
    }

    lines.push(`SUMMARY:${escape(e.title)}`);
    if (e.location) lines.push(`LOCATION:${escape(e.location)}`);
    if (e.note) lines.push(`DESCRIPTION:${escape(e.note)}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
