"use client";

import { useMemo, useState } from "react";
import {
  Check,
  ClipboardCheck,
  Loader2,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import type { AttendanceMeeting, RosterEntry } from "@/lib/club-store";
import type { AttendanceMatch } from "@/lib/attendance-match";
import { inputStyle } from "./ClubCalendar";

type SortKey = "pct" | "name" | "present";

type Draft = {
  label: string;
  date: string;
  text: string;
  matches: AttendanceMatch[];
  presentEmails: Set<string>;
  unmatchedNames: string[];
  usedAi: boolean;
  aiNote?: string;
  parsing: boolean;
  error?: string;
};

const emptyDraft = (): Draft => ({
  label: "",
  date: "",
  text: "",
  matches: [],
  presentEmails: new Set(),
  unmatchedNames: [],
  usedAi: false,
  parsing: false,
});

export default function Attendance({
  roster,
  meetings,
  onChange,
}: {
  roster: RosterEntry[];
  meetings: AttendanceMeeting[];
  onChange: (meetings: AttendanceMeeting[]) => void;
}) {
  const [mode, setMode] = useState<"summary" | "add">("summary");
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("pct");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const total = meetings.length;

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = roster.map((r) => {
      const email = r.email.toLowerCase();
      const attended = meetings.filter((m) =>
        m.presentEmails.some((e) => e.toLowerCase() === email)
      );
      const present = attended.length;
      const pct = total === 0 ? 0 : Math.round((present / total) * 100);
      const last = attended.length
        ? [...attended].sort((a, b) => b.date.localeCompare(a.date))[0]?.date
        : "";
      return { ...r, email, present, pct, last };
    });

    const filtered = q
      ? list.filter(
          (r) =>
            r.name.toLowerCase().includes(q) ||
            r.email.includes(q) ||
            (r.role ?? "").toLowerCase().includes(q)
        )
      : list;

    filtered.sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "present") return b.present - a.present || a.name.localeCompare(b.name);
      // pct ascending = absences first
      return a.pct - b.pct || a.name.localeCompare(b.name);
    });
    return filtered;
  }, [roster, meetings, query, sort, total]);

  const selected = meetings.find((m) => m.id === selectedId) ?? null;

  async function runMatch() {
    if (!draft.text.trim()) {
      setDraft((d) => ({ ...d, error: "Paste a sign-in CSV or name list first." }));
      return;
    }
    if (roster.length === 0) {
      setDraft((d) => ({
        ...d,
        error: "The email list is empty — add members there before tracking attendance.",
      }));
      return;
    }
    setDraft((d) => ({ ...d, parsing: true, error: undefined }));
    try {
      const res = await fetch("/api/club/attendance/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: draft.text,
          roster: roster.map((r) => ({ name: r.name, email: r.email })),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? `Match failed (${res.status})`);

      const presentEmails = new Set<string>(
        (json.presentEmails as string[] | undefined)?.map((e) => e.toLowerCase()) ?? []
      );
      setDraft((d) => ({
        ...d,
        parsing: false,
        matches: (json.matches as AttendanceMatch[]) ?? [],
        presentEmails,
        unmatchedNames: (json.unmatchedNames as string[]) ?? [],
        usedAi: Boolean(json.usedAi),
        aiNote: typeof json.aiNote === "string" ? json.aiNote : undefined,
        date: d.date || (typeof json.meetingDate === "string" ? json.meetingDate : ""),
        label:
          d.label ||
          (typeof json.meetingDate === "string"
            ? weekLabel(json.meetingDate, meetings.length + 1)
            : `Week ${meetings.length + 1}`),
      }));
    } catch (e) {
      setDraft((d) => ({
        ...d,
        parsing: false,
        error: e instanceof Error ? e.message : "Match failed",
      }));
    }
  }

  function saveMeeting() {
    const label = draft.label.trim() || `Week ${meetings.length + 1}`;
    const date = draft.date.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setDraft((d) => ({ ...d, error: "Set a meeting date (YYYY-MM-DD)." }));
      return;
    }
    const meeting: AttendanceMeeting = {
      id: `a-${date}-${Date.now().toString(36)}`,
      date,
      label,
      presentEmails: [...draft.presentEmails],
      unmatchedNames: draft.unmatchedNames,
      recordedAt: new Date().toISOString(),
    };
    // Replace same-date meeting if re-uploading the same week
    const next = [
      ...meetings.filter((m) => m.date !== date),
      meeting,
    ].sort((a, b) => a.date.localeCompare(b.date));
    onChange(next);
    setDraft(emptyDraft());
    setMode("summary");
    setSelectedId(meeting.id);
  }

  function removeMeeting(id: string) {
    onChange(meetings.filter((m) => m.id !== id));
    if (selectedId === id) setSelectedId(null);
  }

  if (mode === "add") {
    return (
      <AddMeeting
        draft={draft}
        setDraft={setDraft}
        roster={roster}
        onCancel={() => {
          setDraft(emptyDraft());
          setMode("summary");
        }}
        onMatch={runMatch}
        onSave={saveMeeting}
      />
    );
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <section className="card" style={{ padding: 18 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 11 }}>
          <ClipboardCheck size={19} color="var(--brand)" style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 className="h-sub" style={{ fontSize: 17 }}>Weekly attendance</h3>
            <p style={{ fontSize: 13.5, color: "var(--muted)", margin: "5px 0 0", lineHeight: 1.55, maxWidth: "68ch" }}>
              Paste each week&apos;s Google Form CSV. Names are matched to the email list (including
              common nicknames). Percentage is meetings attended ÷ meetings tracked.
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14, alignItems: "center" }}>
              <button
                className="ctl"
                style={{ color: "var(--brand)", borderColor: "var(--brand)" }}
                onClick={() => {
                  setDraft({
                    ...emptyDraft(),
                    label: `Week ${meetings.length + 1}`,
                  });
                  setMode("add");
                }}
              >
                <Plus size={15} />
                Add meeting
              </button>
              <span className="mono" style={{ fontSize: 12, color: "var(--faint)" }}>
                {total} meeting{total === 1 ? "" : "s"} tracked · {roster.length} on the roster
              </span>
            </div>
          </div>
        </div>
      </section>

      {meetings.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {meetings.map((m) => (
            <button
              key={m.id}
              className="ctl"
              onClick={() => setSelectedId(selectedId === m.id ? null : m.id)}
              style={
                selectedId === m.id
                  ? { color: "var(--brand)", borderColor: "var(--brand)" }
                  : undefined
              }
            >
              {m.label}
              <span className="mono" style={{ fontSize: 11, color: "var(--faint)", marginLeft: 6 }}>
                {m.date} · {m.presentEmails.length} present
              </span>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <MeetingDetail
          meeting={selected}
          roster={roster}
          onClose={() => setSelectedId(null)}
          onDelete={() => removeMeeting(selected.id)}
        />
      )}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <label style={{ position: "relative", flex: "1 1 220px", maxWidth: 320 }}>
          <Search
            size={14}
            color="var(--faint)"
            style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)" }}
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a member"
            aria-label="Find a member"
            style={{ ...inputStyle, paddingLeft: 32 }}
          />
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--muted)" }}>
          Sort
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            style={{ ...inputStyle, width: "auto", padding: "7px 10px" }}
          >
            <option value="pct">Lowest % first</option>
            <option value="present">Most present</option>
            <option value="name">Name</option>
          </select>
        </label>
      </div>

      {roster.length === 0 ? (
        <p style={{ fontSize: 14, color: "var(--muted)", margin: 0 }}>
          Add people on the Email list tab before tracking attendance.
        </p>
      ) : total === 0 ? (
        <p style={{ fontSize: 14, color: "var(--muted)", margin: 0 }}>
          No meetings yet. Click Add meeting and paste a week&apos;s sign-in CSV.
        </p>
      ) : (
        <div className="roster-scroll">
          <table className="roster-table">
            <caption className="sr-only">
              Attendance percentage for each roster member across tracked meetings.
            </caption>
            <thead>
              <tr>
                <th style={{ width: "28%" }}>Name</th>
                <th style={{ width: "32%" }}>Email</th>
                <th style={{ width: "12%" }}>Role</th>
                <th style={{ width: "12%" }}>Present</th>
                <th style={{ width: "10%" }}>%</th>
                <th style={{ width: "16%" }}>Last in</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id || r.email}>
                  <td>{r.name}</td>
                  <td className="mono" style={{ fontSize: 12.5 }}>{r.email}</td>
                  <td style={{ color: "var(--muted)", fontSize: 13 }}>{r.role ?? "—"}</td>
                  <td className="mono" style={{ fontSize: 13 }}>
                    {r.present}/{total}
                  </td>
                  <td>
                    <PctBadge pct={r.pct} />
                  </td>
                  <td className="mono" style={{ fontSize: 12, color: "var(--faint)" }}>
                    {r.last || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function PctBadge({ pct }: { pct: number }) {
  const color =
    pct >= 80 ? "var(--green)" : pct >= 50 ? "var(--orangeText)" : "var(--down)";
  return (
    <span className="mono" style={{ fontSize: 13, fontWeight: 600, color }}>
      {pct}%
    </span>
  );
}

function MeetingDetail({
  meeting,
  roster,
  onClose,
  onDelete,
}: {
  meeting: AttendanceMeeting;
  roster: RosterEntry[];
  onClose: () => void;
  onDelete: () => void;
}) {
  const present = new Set(meeting.presentEmails.map((e) => e.toLowerCase()));
  const presentRows = roster.filter((r) => present.has(r.email.toLowerCase()));
  const absentRows = roster.filter((r) => !present.has(r.email.toLowerCase()));

  return (
    <section className="card" style={{ padding: 18, display: "grid", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h3 className="h-sub" style={{ fontSize: 16 }}>
            {meeting.label}{" "}
            <span className="mono" style={{ fontSize: 12, color: "var(--faint)", fontWeight: 500 }}>
              {meeting.date}
            </span>
          </h3>
          <p style={{ fontSize: 13, color: "var(--muted)", margin: "4px 0 0" }}>
            {presentRows.length} present · {absentRows.length} absent
            {meeting.unmatchedNames.length > 0 &&
              ` · ${meeting.unmatchedNames.length} not on the email list`}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="ctl" onClick={onClose}>
            <X size={14} />
            Close
          </button>
          <button
            className="ctl"
            style={{ color: "var(--down)" }}
            onClick={() => {
              if (confirm(`Delete ${meeting.label}? This updates everyone’s percentage.`)) onDelete();
            }}
          >
            <Trash2 size={14} />
            Delete
          </button>
        </div>
      </div>

      {meeting.unmatchedNames.length > 0 && (
        <p style={{ fontSize: 13, color: "var(--orangeText)", margin: 0, lineHeight: 1.5 }}>
          Signed in but not on the email list: {meeting.unmatchedNames.join(", ")}
        </p>
      )}

      <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        <div>
          <p className="mono" style={{ fontSize: 11, color: "var(--faint)", letterSpacing: "0.04em", margin: "0 0 6px" }}>
            PRESENT
          </p>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, lineHeight: 1.55 }}>
            {presentRows.map((r) => (
              <li key={r.email}>{r.name}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="mono" style={{ fontSize: 11, color: "var(--faint)", letterSpacing: "0.04em", margin: "0 0 6px" }}>
            ABSENT
          </p>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, lineHeight: 1.55, color: "var(--muted)" }}>
            {absentRows.slice(0, 40).map((r) => (
              <li key={r.email}>{r.name}</li>
            ))}
            {absentRows.length > 40 && <li>…and {absentRows.length - 40} more</li>}
          </ul>
        </div>
      </div>
    </section>
  );
}

function AddMeeting({
  draft,
  setDraft,
  roster,
  onCancel,
  onMatch,
  onSave,
}: {
  draft: Draft;
  setDraft: React.Dispatch<React.SetStateAction<Draft>>;
  roster: RosterEntry[];
  onCancel: () => void;
  onMatch: () => void;
  onSave: () => void;
}) {
  const reviewed = draft.matches.length > 0;

  function toggleEmail(email: string) {
    setDraft((d) => {
      const next = new Set(d.presentEmails);
      const key = email.toLowerCase();
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return { ...d, presentEmails: next };
    });
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <h3 className="h-sub" style={{ fontSize: 18, margin: 0 }}>Add a meeting</h3>
        <button className="ctl" onClick={onCancel}>
          Cancel
        </button>
      </div>

      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
        <label style={{ display: "grid", gap: 5, fontSize: 13, color: "var(--muted)" }}>
          Label
          <input
            value={draft.label}
            onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
            placeholder="Week 2"
            style={inputStyle}
          />
        </label>
        <label style={{ display: "grid", gap: 5, fontSize: 13, color: "var(--muted)" }}>
          Date
          <input
            type="date"
            value={draft.date}
            onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))}
            style={inputStyle}
          />
        </label>
      </div>

      <label style={{ display: "grid", gap: 5, fontSize: 13, color: "var(--muted)" }}>
        Sign-in sheet (CSV or names)
        <textarea
          value={draft.text}
          onChange={(e) => setDraft((d) => ({ ...d, text: e.target.value, matches: [] }))}
          rows={8}
          placeholder={'Paste the Google Form CSV here — columns like Timestamp, Full Name, Class Year.\nOr just one name per line.'}
          style={{ ...inputStyle, fontFamily: "var(--font-mono), ui-monospace, monospace", fontSize: 12.5, resize: "vertical" }}
        />
      </label>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <label className="ctl" style={{ cursor: "pointer" }}>
          <Upload size={15} />
          Upload CSV
          <input
            type="file"
            accept=".csv,text/csv,text/plain"
            style={{ display: "none" }}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const text = await file.text();
              setDraft((d) => ({ ...d, text, matches: [] }));
              e.target.value = "";
            }}
          />
        </label>
        <button
          className="ctl"
          style={{ color: "var(--brand)", borderColor: "var(--brand)" }}
          disabled={draft.parsing || !draft.text.trim()}
          onClick={onMatch}
        >
          {draft.parsing ? <Loader2 size={15} className="animate-spin" /> : <ClipboardCheck size={15} />}
          {draft.parsing ? "Matching…" : "Match to roster"}
        </button>
      </div>

      {draft.error && (
        <p style={{ fontSize: 13, color: "var(--down)", margin: 0 }}>{draft.error}</p>
      )}
      {draft.aiNote && (
        <p style={{ fontSize: 13, color: "var(--orangeText)", margin: 0, lineHeight: 1.5 }}>
          {draft.aiNote} Exact and nickname matches still ran.
        </p>
      )}
      {reviewed && draft.usedAi && !draft.aiNote && (
        <p style={{ fontSize: 12.5, color: "var(--faint)", margin: 0 }}>
          Fuzzy names were checked with AI.
        </p>
      )}

      {reviewed && (
        <>
          <section className="card" style={{ padding: 16, display: "grid", gap: 10 }}>
            <h4 className="h-sub" style={{ fontSize: 15, margin: 0 }}>
              Review — {draft.presentEmails.size} marked present
            </h4>
            <p style={{ fontSize: 13, color: "var(--muted)", margin: 0, lineHeight: 1.5 }}>
              Uncheck anyone matched by mistake. Absentees are everyone else on the email list.
            </p>
            <div style={{ display: "grid", gap: 6 }}>
              {draft.matches
                .filter((m) => m.email)
                .map((m) => {
                  const person = roster.find((r) => r.email.toLowerCase() === m.email);
                  const on = draft.presentEmails.has(m.email!.toLowerCase());
                  return (
                    <label
                      key={`${m.rawName}-${m.email}`}
                      style={{
                        display: "flex",
                        gap: 10,
                        alignItems: "center",
                        fontSize: 13.5,
                        padding: "6px 8px",
                        borderRadius: 8,
                        background: on ? "transparent" : "var(--card)",
                        opacity: on ? 1 : 0.55,
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => toggleEmail(m.email!)}
                      />
                      <span style={{ flex: 1 }}>
                        <strong>{person?.name ?? m.email}</strong>
                        <span style={{ color: "var(--muted)" }}> ← {m.rawName}</span>
                      </span>
                      <span className="mono" style={{ fontSize: 11, color: "var(--faint)" }}>
                        {m.via} · {m.confidence}
                      </span>
                    </label>
                  );
                })}
            </div>

            {draft.unmatchedNames.length > 0 && (
              <p style={{ fontSize: 13, color: "var(--orangeText)", margin: 0, lineHeight: 1.5 }}>
                Not on the email list (won&apos;t count toward %): {draft.unmatchedNames.join(", ")}
              </p>
            )}
          </section>

          <button
            className="ctl"
            style={{ color: "var(--brand)", borderColor: "var(--brand)", alignSelf: "start" }}
            onClick={onSave}
          >
            <Check size={15} />
            Save meeting
          </button>
        </>
      )}
    </div>
  );
}

function weekLabel(date: string, fallbackN: number): string {
  // Prefer "Week N" for the club; date is still stored separately.
  return `Week ${fallbackN}`;
}
