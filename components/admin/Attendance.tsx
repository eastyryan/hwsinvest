"use client";

import { useMemo, useState } from "react";
import {
  Check,
  ClipboardCheck,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import type { AttendanceMeeting, RosterEntry } from "@/lib/club-store";
import { applyYearsToRoster, type AttendanceMatch } from "@/lib/attendance-match";
import { inputStyle } from "./ClubCalendar";
import { sheetFileToText } from "@/lib/attendance-sheet";

type SortKey = "pct" | "name" | "present";
type Mode = "summary" | "add" | "edit";

type Draft = {
  /** Set when editing an existing meeting; null when adding. */
  editingId: string | null;
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
  editingId: null,
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
  onCommitMeeting,
}: {
  roster: RosterEntry[];
  meetings: AttendanceMeeting[];
  onChange: (meetings: AttendanceMeeting[]) => void;
  /** Save a meeting and write Class Year onto matched roster rows in one write. */
  onCommitMeeting: (meetings: AttendanceMeeting[], roster: RosterEntry[]) => void;
}) {
  const [mode, setMode] = useState<Mode>("summary");
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
            (r.role ?? "").toLowerCase().includes(q) ||
            (r.year ?? "").toLowerCase().includes(q)
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

  function startEdit(meeting: AttendanceMeeting) {
    setDraft({
      ...emptyDraft(),
      editingId: meeting.id,
      label: meeting.label,
      date: meeting.date,
      presentEmails: new Set(meeting.presentEmails.map((e) => e.toLowerCase())),
      unmatchedNames: meeting.unmatchedNames,
      // Synthetic matches so the review list can show every roster member.
      matches: roster
        .filter((r) => r.email.trim())
        .map((r) => ({
          rawName: r.name || r.email,
          email: r.email.toLowerCase(),
          via: "exact" as const,
          confidence: "high" as const,
        })),
    });
    setSelectedId(meeting.id);
    setMode("edit");
  }

  function saveMeeting() {
    const label = draft.label.trim() || `Week ${meetings.length + 1}`;
    const date = draft.date.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setDraft((d) => ({ ...d, error: "Set a meeting date (YYYY-MM-DD)." }));
      return;
    }

    const editingId = draft.editingId;
    const dateTaken = meetings.some(
      (m) => m.date === date && m.id !== editingId
    );
    if (dateTaken) {
      setDraft((d) => ({
        ...d,
        error: "Another meeting is already saved on that date. Change the date or edit that meeting instead.",
      }));
      return;
    }

    const prior = editingId ? meetings.find((m) => m.id === editingId) : undefined;
    const meeting: AttendanceMeeting = {
      id: editingId || `a-${date}-${Date.now().toString(36)}`,
      date,
      label,
      presentEmails: [...draft.presentEmails],
      unmatchedNames: draft.unmatchedNames,
      recordedAt: prior?.recordedAt || new Date().toISOString(),
    };

    const next = [
      ...meetings.filter((m) => m.id !== meeting.id && m.date !== date),
      meeting,
    ].sort((a, b) => a.date.localeCompare(b.date) || a.label.localeCompare(b.label));

    // Class Year from a freshly matched sheet → Members Year column.
    // Edits that only toggle checkboxes have empty matches.year and leave the roster alone.
    const { roster: nextRoster } = applyYearsToRoster(roster, draft.matches);
    onCommitMeeting(next, nextRoster);
    setDraft(emptyDraft());
    setMode("summary");
    setSelectedId(meeting.id);
  }

  function removeMeeting(id: string) {
    onChange(meetings.filter((m) => m.id !== id));
    if (selectedId === id) setSelectedId(null);
    if (draft.editingId === id) {
      setDraft(emptyDraft());
      setMode("summary");
    }
  }

  if (mode === "add" || mode === "edit") {
    return (
      <AddMeeting
        mode={mode}
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
              Paste or upload each week&apos;s Google Form CSV/xlsx. Names are matched to the email
              list (including nicknames), Class Year fills the Email list Year column, and percentage
              is meetings attended ÷ meetings tracked.
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
          onEdit={() => startEdit(selected)}
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
                <th style={{ width: "24%" }}>Name</th>
                <th style={{ width: "28%" }}>Email</th>
                <th style={{ width: "12%" }}>Year</th>
                <th style={{ width: "12%" }}>Role</th>
                <th style={{ width: "10%" }}>Present</th>
                <th style={{ width: "8%" }}>%</th>
                <th style={{ width: "12%" }}>Last in</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id || r.email}>
                  <td>{r.name}</td>
                  <td className="mono" style={{ fontSize: 12.5 }}>{r.email}</td>
                  <td style={{ color: "var(--muted)", fontSize: 13 }}>{r.year || "—"}</td>
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
  onEdit,
  onDelete,
}: {
  meeting: AttendanceMeeting;
  roster: RosterEntry[];
  onClose: () => void;
  onEdit: () => void;
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
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="ctl" onClick={onClose}>
            <X size={14} />
            Close
          </button>
          <button className="ctl" onClick={onEdit} style={{ color: "var(--brand)", borderColor: "var(--brand)" }}>
            <Pencil size={14} />
            Edit
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
              <li key={r.email}>
                {r.name}
                {r.year ? (
                  <span className="mono" style={{ color: "var(--faint)", marginLeft: 6, fontSize: 12 }}>
                    {r.year}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="mono" style={{ fontSize: 11, color: "var(--faint)", letterSpacing: "0.04em", margin: "0 0 6px" }}>
            ABSENT
          </p>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, lineHeight: 1.55, color: "var(--muted)" }}>
            {absentRows.slice(0, 40).map((r) => (
              <li key={r.email}>
                {r.name}
                {r.year ? (
                  <span className="mono" style={{ color: "var(--faint)", marginLeft: 6, fontSize: 12 }}>
                    {r.year}
                  </span>
                ) : null}
              </li>
            ))}
            {absentRows.length > 40 && <li>…and {absentRows.length - 40} more</li>}
          </ul>
        </div>
      </div>
    </section>
  );
}

function AddMeeting({
  mode,
  draft,
  setDraft,
  roster,
  onCancel,
  onMatch,
  onSave,
}: {
  mode: "add" | "edit";
  draft: Draft;
  setDraft: React.Dispatch<React.SetStateAction<Draft>>;
  roster: RosterEntry[];
  onCancel: () => void;
  onMatch: () => void;
  onSave: () => void;
}) {
  const editing = mode === "edit";
  // Add flow needs a sheet match first; edit can save from the current checklist.
  const reviewed = editing || draft.matches.length > 0;
  const showMatchMeta = draft.matches.some((m) => {
    if (!m.email) return false;
    const person = roster.find((r) => r.email.toLowerCase() === m.email);
    return m.via !== "exact" || Boolean(m.year) || (person ? m.rawName !== person.name : true);
  });

  function toggleEmail(email: string) {
    setDraft((d) => {
      const next = new Set(d.presentEmails);
      const key = email.toLowerCase();
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return { ...d, presentEmails: next };
    });
  }

  type ChecklistRow = {
    email: string;
    label: string;
    rawName?: string;
    year?: string;
    via?: string;
    confidence?: string;
  };

  const checklist: ChecklistRow[] = (() => {
    if (draft.matches.some((m) => m.email)) {
      // Prefer sheet matches when present; also list roster people missing from the match set so edit can add walk-ins.
      const byEmail = new Map<string, AttendanceMatch>();
      for (const m of draft.matches) {
        if (m.email) byEmail.set(m.email.toLowerCase(), m);
      }
      const rows: ChecklistRow[] = [];
      for (const r of roster) {
        const email = r.email.trim().toLowerCase();
        if (!email) continue;
        const m = byEmail.get(email);
        rows.push({
          email,
          label: r.name || email,
          rawName: m && m.rawName !== r.name ? m.rawName : undefined,
          year: m?.year,
          via: m?.via,
          confidence: m?.confidence,
        });
      }
      // Matched names not on the roster stay in unmatchedNames, not the checklist.
      return rows;
    }
    return roster
      .filter((r) => r.email.trim())
      .map((r) => ({
        email: r.email.trim().toLowerCase(),
        label: r.name || r.email,
      }));
  })();

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <h3 className="h-sub" style={{ fontSize: 18, margin: 0 }}>
          {editing ? "Edit meeting" : "Add a meeting"}
        </h3>
        <button className="ctl" onClick={onCancel}>
          Cancel
        </button>
      </div>

      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
        <label style={{ display: "grid", gap: 5, fontSize: 13, color: "var(--muted)" }}>
          Label
          <input
            value={draft.label}
            onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value, error: undefined }))}
            placeholder="Week 2"
            style={inputStyle}
          />
        </label>
        <label style={{ display: "grid", gap: 5, fontSize: 13, color: "var(--muted)" }}>
          Date
          <input
            type="date"
            value={draft.date}
            onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value, error: undefined }))}
            style={inputStyle}
          />
        </label>
      </div>

      <label style={{ display: "grid", gap: 5, fontSize: 13, color: "var(--muted)" }}>
        {editing ? "Re-import sign-in sheet (optional)" : "Sign-in sheet (CSV or names)"}
        <textarea
          value={draft.text}
          onChange={(e) =>
            setDraft((d) => ({
              ...d,
              text: e.target.value,
              // Clearing the paste shouldn't wipe an edit checklist until they match again.
              matches: editing ? d.matches : [],
            }))
          }
          rows={editing ? 5 : 8}
          placeholder={
            editing
              ? "Optional: paste a new CSV/xlsx export to rematch names and refresh class years."
              : "Paste the Google Form CSV here — columns like Timestamp, Full Name, Class Year.\nOr just one name per line."
          }
          style={{ ...inputStyle, fontFamily: "var(--font-mono), ui-monospace, monospace", fontSize: 12.5, resize: "vertical" }}
        />
      </label>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <label className="ctl" style={{ cursor: "pointer" }}>
          <Upload size={15} />
          Upload CSV / xlsx
          <input
            type="file"
            accept=".csv,.xlsx,.xls,text/csv,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            style={{ display: "none" }}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              try {
                const text = await sheetFileToText(file);
                setDraft((d) => ({
                  ...d,
                  text,
                  matches: editing ? d.matches : [],
                  error: undefined,
                }));
              } catch (err) {
                setDraft((d) => ({
                  ...d,
                  error: err instanceof Error ? err.message : "Could not read that file.",
                }));
              }
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
          {draft.parsing ? "Matching…" : editing ? "Rematch sheet" : "Match to roster"}
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
      {draft.usedAi && !draft.aiNote && draft.text.trim() && (
        <p style={{ fontSize: 12.5, color: "var(--faint)", margin: 0 }}>
          Fuzzy names were checked with AI.
        </p>
      )}

      {reviewed && (
        <>
          <section className="card" style={{ padding: 16, display: "grid", gap: 10 }}>
            <h4 className="h-sub" style={{ fontSize: 15, margin: 0 }}>
              {editing ? "Who was present" : "Review"} — {draft.presentEmails.size} marked present
            </h4>
            <p style={{ fontSize: 13, color: "var(--muted)", margin: 0, lineHeight: 1.5 }}>
              {editing
                ? "Toggle anyone who should be marked present or absent. You can also rematch a sheet above."
                : "Uncheck anyone matched by mistake. Absentees are everyone else on the email list."}{" "}
              Class years from a sheet write to the Email list Year column when you save.
            </p>
            <div style={{ display: "grid", gap: 6 }}>
              {checklist.map((row) => {
                const on = draft.presentEmails.has(row.email);
                return (
                  <label
                    key={row.email}
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
                      onChange={() => toggleEmail(row.email)}
                    />
                    <span style={{ flex: 1 }}>
                      <strong>{row.label}</strong>
                      {row.rawName && (
                        <span style={{ color: "var(--muted)" }}> ← {row.rawName}</span>
                      )}
                      {row.year && (
                        <span className="mono" style={{ color: "var(--brand)", marginLeft: 8 }}>
                          {row.year}
                        </span>
                      )}
                    </span>
                    {showMatchMeta && row.via && (
                      <span className="mono" style={{ fontSize: 11, color: "var(--faint)" }}>
                        {row.via}
                        {row.confidence ? ` · ${row.confidence}` : ""}
                      </span>
                    )}
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
            {editing ? "Save changes" : "Save meeting"}
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
