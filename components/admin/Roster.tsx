"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ClipboardList, Copy, Plus, Search, Trash2, Upload } from "lucide-react";
import type { RosterEntry } from "@/lib/club-store";
import { inputStyle } from "./ClubCalendar";

const EMAIL_IN_LINE = /[^\s<>,;"']+@[^\s<>,;"']+\.[A-Za-z]{2,}/;
const VALID_EMAIL = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/;
const SCHOOL_DOMAIN = "hws.edu";

export default function Roster({
  roster,
  onChange,
}: {
  roster: RosterEntry[];
  onChange: (roster: RosterEntry[]) => void;
}) {
  // Edits live here while someone types; they're pushed up (and saved) on
  // blur, so a name doesn't fire one write per keystroke.
  const [rows, setRows] = useState<RosterEntry[]>(roster);
  const pushed = useRef(JSON.stringify(roster));
  const [query, setQuery] = useState("");
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    const incoming = JSON.stringify(roster);
    if (incoming !== pushed.current) {
      pushed.current = incoming;
      setRows(roster);
    }
  }, [roster]);

  function commit(next: RosterEntry[]) {
    setRows(next);
    pushed.current = JSON.stringify(next);
    onChange(next);
  }

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        (r.role ?? "").toLowerCase().includes(q) ||
        (r.year ?? "").toLowerCase().includes(q)
    );
  }, [rows, query]);

  const emails = useMemo(
    () => rows.map((r) => r.email.trim()).filter((e) => VALID_EMAIL.test(e)),
    [rows]
  );
  const duplicates = useMemo(() => {
    const seen = new Set<string>();
    const dupes = new Set<string>();
    for (const e of emails) {
      const key = e.toLowerCase();
      if (seen.has(key)) dupes.add(key);
      seen.add(key);
    }
    return dupes;
  }, [emails]);

  const problems = rows.filter((r) => r.email.trim() && !VALID_EMAIL.test(r.email.trim())).length;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* ── Copy bar: the whole point of this section ── */}
      <section className="card" style={{ padding: 18 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 11 }}>
          <ClipboardList size={19} color="var(--brand)" style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 className="h-sub" style={{ fontSize: 17 }}>Copy the list</h3>
            <p style={{ fontSize: 13.5, color: "var(--muted)", margin: "5px 0 0", lineHeight: 1.55, maxWidth: "68ch" }}>
              Grab the addresses in the shape your mail client wants, then paste them straight into the To or Bcc
              field. For anything going to the whole club, use Bcc.
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
              <CopyButton label={`Copy ${emails.length} email${emails.length === 1 ? "" : "s"}`} text={emails.join(", ")} primary />
              <CopyButton label="Copy semicolon-separated" text={emails.join("; ")} />
              <CopyButton
                label="Copy Name <email>"
                text={rows
                  .filter((r) => VALID_EMAIL.test(r.email.trim()))
                  .map((r) => (r.name ? `${r.name} <${r.email.trim()}>` : r.email.trim()))
                  .join(", ")}
              />
              <CopyButton
                label="Copy as CSV"
                text={
                  rows.length === 0
                    ? ""
                    : [
                        "Name,Email,Year,Role",
                        ...rows.map((r) =>
                          [r.name, r.email, r.year ?? "", r.role ?? ""].map(csvCell).join(",")
                        ),
                      ].join("\n")
                }
              />
            </div>
            {(duplicates.size > 0 || problems > 0) && (
              <p style={{ fontSize: 12.5, color: "var(--orangeText)", margin: "12px 0 0", lineHeight: 1.5 }}>
                {duplicates.size > 0 && `${duplicates.size} duplicate address${duplicates.size === 1 ? "" : "es"}. `}
                {problems > 0 && `${problems} address${problems === 1 ? " doesn't" : "es don't"} look valid and ${problems === 1 ? "was" : "were"} left out of the copied list.`}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* ── Toolbar ── */}
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
        <button
          className="ctl"
          onClick={() =>
            commit([...rows, { id: `m-${Date.now().toString(36)}`, name: "", email: "" }])
          }
        >
          <Plus size={15} />
          Add member
        </button>
        <button className="ctl" onClick={() => setImporting((v) => !v)} aria-expanded={importing}>
          <Upload size={15} />
          Paste a list
        </button>
        <span style={{ flex: 1 }} />
        <span className="mono" style={{ fontSize: 12, color: "var(--faint)", letterSpacing: "0.04em" }}>
          {rows.length} on the list
          {query && ` · ${visible.length} shown`}
        </span>
      </div>

      {importing && (
        <BulkImport
          onImport={(added) => {
            commit(mergeRoster(rows, added));
            setImporting(false);
          }}
          onCancel={() => setImporting(false)}
        />
      )}

      {/* ── The list ── */}
      {rows.length === 0 ? (
        <p style={{ fontSize: 14, color: "var(--muted)", margin: 0 }}>
          Nobody on the list yet. Add members one at a time, or paste a block of names and addresses.
        </p>
      ) : (
        <div className="roster-scroll">
          <table className="roster-table">
            <caption className="sr-only">
              Club members, with name, school email, class year, and role. Fields save when you click away.
            </caption>
            <thead>
              <tr>
                <th style={{ width: "28%" }}>Name</th>
                <th style={{ width: "36%" }}>School email</th>
                <th style={{ width: "12%" }}>Year</th>
                <th style={{ width: "20%" }}>Role</th>
                <th style={{ width: 44 }}>
                  <span className="sr-only">Remove</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => {
                const email = row.email.trim();
                const invalid = email.length > 0 && !VALID_EMAIL.test(email);
                const dupe = duplicates.has(email.toLowerCase());
                const offDomain = VALID_EMAIL.test(email) && !email.toLowerCase().endsWith(`@${SCHOOL_DOMAIN}`);
                return (
                  <tr key={row.id}>
                    <td>
                      <Cell row={row} field="name" rows={rows} setRows={setRows} commit={commit} placeholder="Full name" />
                    </td>
                    <td>
                      <Cell
                        row={row}
                        field="email"
                        rows={rows}
                        setRows={setRows}
                        commit={commit}
                        placeholder={`name@${SCHOOL_DOMAIN}`}
                        type="email"
                        tone={invalid || dupe ? "bad" : offDomain ? "warn" : undefined}
                        title={
                          invalid
                            ? "That doesn't look like an email address"
                            : dupe
                              ? "This address appears more than once"
                              : offDomain
                                ? `Not an @${SCHOOL_DOMAIN} address`
                                : undefined
                        }
                      />
                    </td>
                    <td>
                      <Cell row={row} field="year" rows={rows} setRows={setRows} commit={commit} placeholder="e.g. '28" />
                    </td>
                    <td>
                      <Cell row={row} field="role" rows={rows} setRows={setRows} commit={commit} placeholder="e.g. Analyst" />
                    </td>
                    <td>
                      <button
                        className="ctl"
                        style={{ padding: "5px 7px" }}
                        aria-label={`Remove ${row.name || row.email || "this row"}`}
                        onClick={() => commit(rows.filter((r) => r.id !== row.id))}
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Pieces ───────────────────────────────────────────────────

function Cell({
  row,
  field,
  rows,
  setRows,
  commit,
  placeholder,
  type = "text",
  tone,
  title,
}: {
  row: RosterEntry;
  field: keyof RosterEntry;
  rows: RosterEntry[];
  setRows: (r: RosterEntry[]) => void;
  commit: (r: RosterEntry[]) => void;
  placeholder?: string;
  type?: string;
  tone?: "bad" | "warn";
  title?: string;
}) {
  return (
    <input
      type={type}
      value={(row[field] as string) ?? ""}
      placeholder={placeholder}
      title={title}
      aria-label={`${String(field)} for ${row.name || "new member"}`}
      onChange={(e) =>
        setRows(rows.map((r) => (r.id === row.id ? { ...r, [field]: e.target.value } : r)))
      }
      onBlur={() => commit(rows)}
      style={
        tone
          ? { color: tone === "bad" ? "var(--down)" : "var(--orangeText)" }
          : undefined
      }
    />
  );
}

function CopyButton({ label, text, primary = false }: { label: string; text: string; primary?: boolean }) {
  const [done, setDone] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard API needs a secure context; fall back to a hidden textarea.
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setDone(true);
    setTimeout(() => setDone(false), 1600);
  }

  return (
    <button
      className="ctl"
      onClick={copy}
      disabled={!text}
      style={
        primary
          ? { color: "var(--brand)", borderColor: "var(--brand)", opacity: text ? 1 : 0.5 }
          : { opacity: text ? 1 : 0.5 }
      }
    >
      {done ? <Check size={14} /> : <Copy size={14} />}
      {done ? "Copied" : label}
    </button>
  );
}

function BulkImport({
  onImport,
  onCancel,
}: {
  onImport: (rows: RosterEntry[]) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState("");
  const parsed = useMemo(() => parseRoster(text), [text]);

  return (
    <section className="card" style={{ padding: 18, display: "grid", gap: 10 }}>
      <div>
        <h3 className="h-sub" style={{ fontSize: 16 }}>Paste a list</h3>
        <p style={{ fontSize: 13, color: "var(--muted)", margin: "5px 0 0", lineHeight: 1.55, maxWidth: "68ch" }}>
          One person per line. Almost any shape works: <span className="mono">Jane Doe, jane.doe@hws.edu</span>,{" "}
          <span className="mono">Jane Doe &lt;jane.doe@hws.edu&gt;</span>, a tab-separated paste out of a spreadsheet,
          or just the addresses. Anyone already on the list is skipped.
        </p>
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={7}
        aria-label="Names and email addresses to import"
        placeholder={"Jane Doe, jane.doe@hws.edu\nJohn Smith <john.smith@hws.edu>"}
        style={{ ...inputStyle, fontFamily: "var(--font-mono), ui-monospace, monospace", fontSize: 13, resize: "vertical" }}
      />
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <button
          className="ctl"
          style={{ color: "var(--brand)", borderColor: "var(--brand)" }}
          disabled={parsed.length === 0}
          onClick={() => onImport(parsed)}
        >
          Add {parsed.length || "no"} {parsed.length === 1 ? "person" : "people"}
        </button>
        <button className="ctl" onClick={onCancel}>
          Cancel
        </button>
        {text.trim() && parsed.length === 0 && (
          <span style={{ fontSize: 12.5, color: "var(--orangeText)" }}>
            No email addresses found in that text.
          </span>
        )}
      </div>
    </section>
  );
}

// ── Parsing helpers ──────────────────────────────────────────

/** Pull "Name" + "email" out of each pasted line, whatever the separator. */
export function parseRoster(text: string): RosterEntry[] {
  const out: RosterEntry[] = [];
  const seen = new Set<string>();

  text.split(/\r?\n/).forEach((line, i) => {
    const match = line.match(EMAIL_IN_LINE);
    if (!match) return;
    const email = match[0].toLowerCase();
    if (seen.has(email)) return;
    seen.add(email);

    const name = line
      .replace(match[0], "")
      .replace(/[<>"']/g, "")
      .replace(/[,;\t]+/g, " ")
      .trim();

    out.push({ id: `i-${Date.now().toString(36)}-${i}`, name, email });
  });

  return out;
}

/** Append imported rows, skipping addresses already on the list. */
export function mergeRoster(existing: RosterEntry[], incoming: RosterEntry[]): RosterEntry[] {
  const have = new Set(existing.map((r) => r.email.trim().toLowerCase()).filter(Boolean));
  return [...existing, ...incoming.filter((r) => !have.has(r.email.toLowerCase()))];
}

function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}
