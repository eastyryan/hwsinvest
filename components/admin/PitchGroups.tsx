"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import type { PitchGroup, PitchMember, RosterEntry } from "@/lib/club-store";
import { inputStyle } from "./ClubCalendar";

function newId() {
  return `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function memberKey(m: PitchMember) {
  return (m.email || m.name).trim().toLowerCase();
}

/** Attach a roster email when the typed name is someone already on the list. */
function memberFromName(raw: string, roster: RosterEntry[]): PitchMember | null {
  const name = raw.trim().replace(/\s+/g, " ");
  if (!name) return null;
  const key = name.toLowerCase();
  const hit = roster.find(
    (r) => r.name.trim().toLowerCase().replace(/\s+/g, " ") === key || r.email.trim().toLowerCase() === key
  );
  if (hit) {
    return {
      name: hit.name.trim() || name,
      email: hit.email.trim().toLowerCase() || undefined,
    };
  }
  return { name };
}

export default function PitchGroups({
  groups,
  roster,
  onChange,
}: {
  groups: PitchGroup[];
  roster: RosterEntry[];
  onChange: (groups: PitchGroup[]) => void;
}) {
  const [rows, setRows] = useState<PitchGroup[]>(groups);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const pushed = useRef(JSON.stringify(groups));
  const [draftName, setDraftName] = useState<Record<string, string>>({});

  useEffect(() => {
    const incoming = JSON.stringify(groups);
    if (incoming !== pushed.current) {
      pushed.current = incoming;
      setRows(groups);
    }
  }, [groups]);

  function commit(next: PitchGroup[]) {
    setRows(next);
    pushed.current = JSON.stringify(next);
    onChange(next);
  }

  function patch(id: string, partial: Partial<PitchGroup>, save: boolean) {
    const next = rowsRef.current.map((g) => (g.id === id ? { ...g, ...partial } : g));
    setRows(next);
    if (save) {
      pushed.current = JSON.stringify(next);
      onChange(next);
    }
  }

  const rosterNames = useMemo(
    () => roster.map((r) => r.name.trim()).filter(Boolean).sort((a, b) => a.localeCompare(b)),
    [roster]
  );

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <p style={{ margin: 0, fontSize: 13.5, color: "var(--muted)" }}>
          {rows.length === 0 ? "No groups yet." : `${rows.length} group${rows.length === 1 ? "" : "s"}`}
        </p>
        <button
          type="button"
          className="ctl"
          onClick={() =>
            commit([...rowsRef.current, { id: newId(), name: "", ticker: "", members: [] }])
          }
        >
          <Plus size={15} /> Add group
        </button>
      </div>

      {rows.map((group) => (
        <section key={group.id} className="card" style={{ padding: 16, display: "grid", gap: 12 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "end", flexWrap: "wrap" }}>
            <label style={{ display: "grid", gap: 5, width: 140 }}>
              <span className="mono" style={{ fontSize: 10.5, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--faint)" }}>
                Ticker
              </span>
              <input
                value={group.ticker}
                placeholder="IONQ"
                style={{ ...inputStyle, fontWeight: 700, letterSpacing: "0.04em" }}
                onChange={(e) =>
                  patch(group.id, { ticker: e.target.value.toUpperCase().replace(/[^A-Z0-9.-]/g, "").slice(0, 8) }, false)
                }
                onBlur={() => commit(rowsRef.current)}
              />
            </label>
            <label style={{ display: "grid", gap: 5, flex: "1 1 220px" }}>
              <span className="mono" style={{ fontSize: 10.5, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--faint)" }}>
                Group name
              </span>
              <input
                value={group.name}
                placeholder={group.ticker ? group.ticker : "Optional"}
                style={inputStyle}
                onChange={(e) => patch(group.id, { name: e.target.value }, false)}
                onBlur={() => commit(rowsRef.current)}
              />
            </label>
            <button
              type="button"
              className="ctl"
              onClick={() => {
                if (!window.confirm("Remove this pitch group?")) return;
                commit(rowsRef.current.filter((g) => g.id !== group.id));
              }}
              style={{ color: "var(--orangeText)" }}
            >
              <Trash2 size={14} /> Remove
            </button>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {group.members.length === 0 && (
              <span style={{ fontSize: 13.5, color: "var(--faint)" }}>No one in this group yet.</span>
            )}
            {group.members.map((m) => (
              <span
                key={memberKey(m)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 13.5,
                  fontWeight: 600,
                  border: "1px solid var(--line)",
                  borderRadius: 999,
                  padding: "4px 8px 4px 12px",
                }}
              >
                {m.name}
                <button
                  type="button"
                  aria-label={`Remove ${m.name}`}
                  onClick={() =>
                    patch(
                      group.id,
                      { members: group.members.filter((x) => memberKey(x) !== memberKey(m)) },
                      true
                    )
                  }
                  style={{
                    border: 0,
                    background: "transparent",
                    color: "var(--muted)",
                    cursor: "pointer",
                    display: "inline-flex",
                    padding: 2,
                  }}
                >
                  <X size={13} />
                </button>
              </span>
            ))}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              const typed = draftName[group.id] ?? "";
              const member = memberFromName(typed, roster);
              if (!member) return;
              const key = memberKey(member);
              if (group.members.some((m) => memberKey(m) === key)) {
                setDraftName((d) => ({ ...d, [group.id]: "" }));
                return;
              }
              patch(group.id, { members: [...group.members, member] }, true);
              setDraftName((d) => ({ ...d, [group.id]: "" }));
            }}
            style={{ display: "flex", gap: 8, alignItems: "center" }}
          >
            <input
              list={`roster-${group.id}`}
              value={draftName[group.id] ?? ""}
              placeholder="Add a name"
              style={{ ...inputStyle, maxWidth: 320 }}
              onChange={(e) => setDraftName((d) => ({ ...d, [group.id]: e.target.value }))}
            />
            <datalist id={`roster-${group.id}`}>
              {rosterNames.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
            <button type="submit" className="ctl">
              Add name
            </button>
          </form>
        </section>
      ))}
    </div>
  );
}
