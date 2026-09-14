"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarDays, ChevronLeft, ChevronRight, Download, Plus, Trash2 } from "lucide-react";
import {
  KIND_LABEL,
  WEEKLY,
  dayLabel,
  parseDay,
  sortEvents,
  timeLabel,
  toDay,
  type ClubEvent,
  type EventKind,
} from "@/data/calendar";
import { FIXED_EVENTS, baseSchedule } from "@/data/calendar-board";
import { buildIcs } from "@/lib/ics";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const KIND_COLOR: Record<EventKind, string> = {
  weekly: "var(--brand)",
  required: "var(--orangeText)",
  club: "var(--green)",
  custom: "var(--muted)",
};

export default function ClubCalendar({
  custom,
  onChange,
  readOnly = false,
}: {
  custom: ClubEvent[];
  onChange: (events: ClubEvent[]) => void;
  readOnly?: boolean;
}) {
  // `new Date()` differs between the server render and the browser, so the
  // grid waits for the client before it picks a month or marks today.
  const [today, setToday] = useState<string | null>(null);
  const [cursor, setCursor] = useState<{ y: number; m: number } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    const now = new Date();
    setToday(toDay(now));
    setCursor({ y: now.getFullYear(), m: now.getMonth() });
  }, []);

  const events = useMemo(() => sortEvents([...baseSchedule(), ...custom]), [custom]);

  const byDay = useMemo(() => {
    const map = new Map<string, ClubEvent[]>();
    for (const e of events) {
      const list = map.get(e.date);
      if (list) list.push(e);
      else map.set(e.date, [e]);
    }
    return map;
  }, [events]);

  const upcoming = useMemo(
    () => (today ? events.filter((e) => e.date >= today).slice(0, 6) : []),
    [events, today]
  );

  function downloadIcs() {
    const blob = new Blob([buildIcs(events)], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "hws-investment-club.ics";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <RequiredBanner today={today} />

      <div className="cal-split">
        {/* ── Month grid ── */}
        <section className="card" style={{ padding: 18, alignSelf: "start" }}>
          <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
            <h3 className="h-sub" style={{ fontSize: 19 }}>
              {cursor
                ? new Date(cursor.y, cursor.m, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" })
                : "Loading"}
            </h3>
            <div style={{ display: "flex", gap: 6 }}>
              <button
                className="ctl"
                aria-label="Previous month"
                onClick={() => setCursor((c) => (c ? shift(c, -1) : c))}
                style={{ padding: "7px 9px" }}
              >
                <ChevronLeft size={15} />
              </button>
              <button
                className="ctl"
                onClick={() => {
                  const n = new Date();
                  setCursor({ y: n.getFullYear(), m: n.getMonth() });
                  setSelected(toDay(n));
                }}
                style={{ padding: "7px 12px" }}
              >
                Today
              </button>
              <button
                className="ctl"
                aria-label="Next month"
                onClick={() => setCursor((c) => (c ? shift(c, 1) : c))}
                style={{ padding: "7px 9px" }}
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </header>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
            {WEEKDAYS.map((d) => (
              <div
                key={d}
                className="mono"
                style={{
                  fontSize: 10.5,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "var(--faint)",
                  textAlign: "center",
                  paddingBottom: 6,
                }}
              >
                {d}
              </div>
            ))}

            {cursor
              ? gridDays(cursor).map((day) => {
                  const inMonth = parseDay(day).getMonth() === cursor.m;
                  const list = byDay.get(day) ?? [];
                  const isToday = day === today;
                  const isSelected = day === selected;
                  return (
                    <button
                      key={day}
                      onClick={() => setSelected(day)}
                      aria-pressed={isSelected}
                      style={{
                        minHeight: 66,
                        textAlign: "left",
                        padding: "6px 7px",
                        border: `1px solid ${isSelected ? "var(--brand)" : isToday ? "var(--orange)" : "var(--line)"}`,
                        borderRadius: 9,
                        background: isSelected ? "var(--card2)" : "var(--card)",
                        opacity: inMonth ? 1 : 0.38,
                        cursor: "pointer",
                        display: "flex",
                        flexDirection: "column",
                        gap: 4,
                        font: "inherit",
                        color: "inherit",
                      }}
                    >
                      <span
                        className="mono"
                        style={{
                          fontSize: 11.5,
                          fontWeight: isToday ? 700 : 500,
                          color: isToday ? "var(--orangeText)" : "var(--muted)",
                        }}
                      >
                        {parseDay(day).getDate()}
                      </span>
                      {list.slice(0, 2).map((e) => (
                        <span
                          key={e.id}
                          title={e.title}
                          style={{
                            fontSize: 10.5,
                            lineHeight: 1.25,
                            color: KIND_COLOR[e.kind],
                            fontWeight: 600,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            borderLeft: `2px solid ${KIND_COLOR[e.kind]}`,
                            paddingLeft: 4,
                          }}
                        >
                          {e.title}
                        </span>
                      ))}
                      {list.length > 2 && (
                        <span style={{ fontSize: 10, color: "var(--faint)" }}>+{list.length - 2} more</span>
                      )}
                    </button>
                  );
                })
              : null}
          </div>

          <footer style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--lineSoft)" }}>
            {(Object.keys(KIND_LABEL) as EventKind[]).map((k) => (
              <span key={k} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--muted)" }}>
                <i style={{ width: 12, height: 3, borderRadius: 2, background: KIND_COLOR[k] }} />
                {KIND_LABEL[k]}
              </span>
            ))}
            <span style={{ flex: 1 }} />
            <button className="ctl" onClick={downloadIcs} style={{ padding: "6px 11px" }}>
              <Download size={14} />
              Export .ics
            </button>
          </footer>
        </section>

        {/* ── Agenda ── */}
        <section style={{ display: "grid", gap: 16, alignContent: "start" }}>
          <div className="card" style={{ padding: 18 }}>
            <h3 className="h-sub" style={{ fontSize: 17, marginBottom: 4 }}>
              {selected ? dayLabel(selected) : "Next up"}
            </h3>
            <p style={{ fontSize: 12.5, color: "var(--faint)", margin: "0 0 12px" }}>
              {selected ? "Selected day" : "The next six things on the calendar"}
            </p>

            <EventList
              events={selected ? byDay.get(selected) ?? [] : upcoming}
              showDate={!selected}
              readOnly={readOnly}
              onDelete={(id) => onChange(custom.filter((e) => e.id !== id))}
              emptyText={selected ? "Nothing scheduled this day." : "Nothing scheduled."}
            />

            {selected && (
              <button className="ctl" onClick={() => setSelected(null)} style={{ marginTop: 12, padding: "6px 11px" }}>
                Back to next up
              </button>
            )}
          </div>

          {!readOnly && (
            <AddEvent
              defaultDate={selected ?? today ?? ""}
              onAdd={(e) => onChange([...custom, e])}
            />
          )}
        </section>
      </div>
    </div>
  );
}

// ── Pieces ───────────────────────────────────────────────────

function EventList({
  events,
  showDate,
  readOnly,
  onDelete,
  emptyText,
}: {
  events: ClubEvent[];
  showDate: boolean;
  readOnly: boolean;
  onDelete: (id: string) => void;
  emptyText: string;
}) {
  if (events.length === 0) {
    return <p style={{ fontSize: 13.5, color: "var(--faint)", margin: 0 }}>{emptyText}</p>;
  }
  return (
    <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 12 }}>
      {events.map((e) => (
        <li key={e.id} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <i
            aria-hidden
            style={{ width: 3, alignSelf: "stretch", borderRadius: 2, background: KIND_COLOR[e.kind], flexShrink: 0 }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14.5, fontWeight: 600, lineHeight: 1.3 }}>{e.title}</div>
            <div className="mono" style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 3, letterSpacing: "0.03em" }}>
              {showDate ? `${dayLabel(e.date)} · ` : ""}
              {timeLabel(e.start)}
              {e.location ? ` · ${e.location}` : ""}
            </div>
            {e.note && (
              <p style={{ fontSize: 12.5, color: "var(--faint)", margin: "5px 0 0", lineHeight: 1.5 }}>{e.note}</p>
            )}
          </div>
          {!readOnly && e.kind === "custom" && (
            <button
              onClick={() => onDelete(e.id)}
              aria-label={`Remove ${e.title}`}
              className="ctl"
              style={{ padding: "5px 7px", flexShrink: 0 }}
            >
              <Trash2 size={13} />
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

function RequiredBanner({ today }: { today: string | null }) {
  const groups = useMemo(() => {
    const map = new Map<string, ClubEvent[]>();
    for (const e of FIXED_EVENTS) {
      if (!e.group) continue;
      const list = map.get(e.group);
      if (list) list.push(e);
      else map.set(e.group, [e]);
    }
    return [...map.entries()];
  }, []);

  if (groups.length === 0) return null;

  return (
    <section
      className="card"
      style={{ padding: 18, borderColor: "var(--orange)", background: "#fdf6ef" }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 11 }}>
        <AlertTriangle size={19} color="var(--orangeText)" style={{ flexShrink: 0, marginTop: 2 }} />
        <div style={{ flex: 1 }}>
          <h3 className="h-sub" style={{ fontSize: 17 }}>Required club trainings</h3>
          <p style={{ fontSize: 13.5, color: "var(--muted)", margin: "5px 0 0", lineHeight: 1.55, maxWidth: "72ch" }}>
            At least one executive board member has to attend one session from each group below, and any member is
            welcome to come along. Attendance is what keeps the club an active organization.
          </p>

          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", marginTop: 14 }}>
            {groups.map(([group, sessions]) => {
              const allPast = today ? sessions.every((s) => s.date < today) : false;
              return (
                <div
                  key={group}
                  style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 11, padding: "12px 14px" }}
                >
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 700 }}>{group}</span>
                    <span
                      className="mono"
                      style={{
                        fontSize: 10,
                        letterSpacing: "0.1em",
                        textTransform: "uppercase",
                        fontWeight: 700,
                        color: allPast ? "var(--faint)" : "var(--orangeText)",
                      }}
                    >
                      {allPast ? "Dates passed" : "Choose one"}
                    </span>
                  </div>
                  <ul style={{ listStyle: "none", margin: "9px 0 0", padding: 0, display: "grid", gap: 7 }}>
                    {sessions.map((s) => (
                      <li key={s.id} style={{ fontSize: 13, lineHeight: 1.45, color: today && s.date < today ? "var(--faint)" : "var(--text)" }}>
                        <span style={{ fontWeight: 600 }}>{dayLabel(s.date)}</span>
                        <br />
                        <span className="mono" style={{ fontSize: 11.5, color: "var(--muted)" }}>
                          {timeLabel(s.start)} · {s.location}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function AddEvent({ defaultDate, onAdd }: { defaultDate: string; onAdd: (e: ClubEvent) => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(defaultDate);
  const [start, setStart] = useState("19:30");
  const [location, setLocation] = useState(WEEKLY.location);
  const [note, setNote] = useState("");

  useEffect(() => setDate(defaultDate), [defaultDate]);

  if (!open) {
    return (
      <button className="ctl" onClick={() => setOpen(true)} style={{ justifySelf: "start" }}>
        <Plus size={15} />
        Add an event
      </button>
    );
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !date) return;
    onAdd({
      id: `custom-${date}-${Math.random().toString(36).slice(2, 8)}`,
      title: title.trim(),
      date,
      start: start || undefined,
      location: location.trim() || undefined,
      kind: "custom",
      note: note.trim() || undefined,
    });
    setTitle("");
    setNote("");
    setOpen(false);
  }

  return (
    <form onSubmit={submit} className="card" style={{ padding: 18, display: "grid", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <CalendarDays size={16} color="var(--brand)" />
        <h3 className="h-sub" style={{ fontSize: 16 }}>Add an event</h3>
      </div>
      <Field label="What">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Stock pitch night" style={inputStyle} required />
      </Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Field label="Date">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={inputStyle} required />
        </Field>
        <Field label="Start">
          <input type="time" value={start} onChange={(e) => setStart(e.target.value)} style={inputStyle} />
        </Field>
      </div>
      <Field label="Where">
        <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Stern 301" style={inputStyle} />
      </Field>
      <Field label="Note (optional)">
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Bring a one-pager" style={inputStyle} />
      </Field>
      <div style={{ display: "flex", gap: 8, marginTop: 2 }}>
        <button type="submit" className="ctl" style={{ color: "var(--brand)", borderColor: "var(--brand)" }}>
          Add to calendar
        </button>
        <button type="button" className="ctl" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "grid", gap: 5 }}>
      <span
        className="mono"
        style={{ fontSize: 10.5, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--faint)" }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

export const inputStyle: React.CSSProperties = {
  width: "100%",
  font: "inherit",
  fontSize: 14,
  color: "var(--text)",
  background: "var(--card)",
  border: "1px solid var(--line)",
  borderRadius: 9,
  padding: "8px 11px",
};

// ── Date math ────────────────────────────────────────────────

function shift({ y, m }: { y: number; m: number }, by: number) {
  const d = new Date(y, m + by, 1);
  return { y: d.getFullYear(), m: d.getMonth() };
}

/** Six weeks of days covering the month, padded out to whole weeks. */
function gridDays({ y, m }: { y: number; m: number }): string[] {
  const first = new Date(y, m, 1);
  const start = new Date(y, m, 1 - first.getDay());
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    return toDay(d);
  });
}
