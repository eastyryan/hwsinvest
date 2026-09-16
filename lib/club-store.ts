// The admin console's own data: the email roster, calendar events an officer
// adds on top of the built-in schedule, and weekly attendance meetings.
//
// There's no database in this project, so the store rides on the Dropbox app
// folder that already backs the members file area. One JSON document,
// overwritten on every save. When Dropbox isn't configured the API says so and
// the console falls back to the browser's own storage, which keeps the page
// usable for a local dev run without any credentials.

import { isDropboxConfigured, readJson, writeJson } from "@/lib/dropbox";
import type { ClubEvent, EventKind } from "@/data/calendar";

const FILE = "club.json";

export type RosterEntry = {
  id: string;
  name: string;
  email: string;
  /** Class year, e.g. "'28". Free text, shown as a column. */
  year?: string;
  /** Board position or committee. Free text. */
  role?: string;
};

/** One club meeting with who signed in (matched to roster emails). */
export type AttendanceMeeting = {
  id: string;
  /** YYYY-MM-DD of the meeting. */
  date: string;
  /** e.g. "Week 2". */
  label: string;
  /** Roster emails marked present (stable if roster row ids change). */
  presentEmails: string[];
  /** Sign-in names that did not match anyone on the roster. */
  unmatchedNames: string[];
  /** ISO timestamp when this meeting was saved. */
  recordedAt: string;
};

export type ClubData = {
  roster: RosterEntry[];
  /** Events added from the console. The built-in schedule lives in code. */
  events: ClubEvent[];
  /** Weekly meetings with attendance. Admin-only. */
  attendance: AttendanceMeeting[];
  /** ISO timestamp of the last successful save. */
  updated: string;
};

export const EMPTY: ClubData = { roster: [], events: [], attendance: [], updated: "" };

export type Storage = "dropbox" | "none";

export function storageKind(): Storage {
  return isDropboxConfigured() ? "dropbox" : "none";
}

// ── Sanitizing ──────────────────────────────────────────────
// Everything below is written by an admin through a form, but it round-trips
// through JSON on disk, so it gets shape-checked on the way back in rather
// than trusted.

const str = (v: unknown, max: number): string =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^\d{2}:\d{2}$/;
const KINDS: EventKind[] = ["weekly", "required", "club", "custom"];

function cleanEntry(raw: unknown, i: number): RosterEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const name = str(r.name, 120);
  const email = str(r.email, 160).toLowerCase();
  if (!name && !email) return null;
  return {
    id: str(r.id, 64) || `r${i}-${email || name}`,
    name,
    email,
    year: str(r.year, 24) || undefined,
    role: str(r.role, 80) || undefined,
  };
}

function cleanEvent(raw: unknown, i: number): ClubEvent | null {
  if (!raw || typeof raw !== "object") return null;
  const e = raw as Record<string, unknown>;
  const date = str(e.date, 10);
  const title = str(e.title, 160);
  if (!DAY.test(date) || !title) return null;

  const start = str(e.start, 5);
  const end = str(e.end, 5);
  const kind = KINDS.includes(e.kind as EventKind) ? (e.kind as EventKind) : "custom";

  return {
    id: str(e.id, 64) || `c${i}-${date}`,
    title,
    date,
    start: TIME.test(start) ? start : undefined,
    end: TIME.test(end) ? end : undefined,
    location: str(e.location, 160) || undefined,
    kind,
    note: str(e.note, 500) || undefined,
  };
}

function cleanMeeting(raw: unknown, i: number): AttendanceMeeting | null {
  if (!raw || typeof raw !== "object") return null;
  const m = raw as Record<string, unknown>;
  const date = str(m.date, 10);
  const label = str(m.label, 80);
  if (!DAY.test(date) || !label) return null;

  const presentRaw = Array.isArray(m.presentEmails) ? m.presentEmails : [];
  const presentEmails = [
    ...new Set(
      presentRaw
        .map((e) => str(e, 160).toLowerCase())
        .filter((e) => e.includes("@"))
    ),
  ].slice(0, 1000);

  const unmatchedRaw = Array.isArray(m.unmatchedNames) ? m.unmatchedNames : [];
  const unmatchedNames = [
    ...new Set(unmatchedRaw.map((n) => str(n, 120)).filter(Boolean)),
  ].slice(0, 500);

  return {
    id: str(m.id, 64) || `a${i}-${date}`,
    date,
    label,
    presentEmails,
    unmatchedNames,
    recordedAt: str(m.recordedAt, 40) || new Date().toISOString(),
  };
}

export function sanitize(raw: unknown): ClubData {
  const d = (raw ?? {}) as Record<string, unknown>;
  const roster = Array.isArray(d.roster)
    ? d.roster.map(cleanEntry).filter((x): x is RosterEntry => x !== null).slice(0, 1000)
    : [];
  const events = Array.isArray(d.events)
    ? d.events.map(cleanEvent).filter((x): x is ClubEvent => x !== null).slice(0, 500)
    : [];
  const attendance = Array.isArray(d.attendance)
    ? d.attendance
        .map(cleanMeeting)
        .filter((x): x is AttendanceMeeting => x !== null)
        .slice(0, 200)
        .sort((a, b) => a.date.localeCompare(b.date) || a.label.localeCompare(b.label))
    : [];
  return { roster, events, attendance, updated: str(d.updated, 40) };
}

// ── Read / write ────────────────────────────────────────────

export async function loadClubData(): Promise<ClubData> {
  if (!isDropboxConfigured()) return EMPTY;
  const raw = await readJson<unknown>(FILE);
  return raw === null ? EMPTY : sanitize(raw);
}

export async function saveClubData(raw: unknown): Promise<ClubData> {
  const clean = { ...sanitize(raw), updated: new Date().toISOString() };
  await writeJson(FILE, clean);
  return clean;
}
