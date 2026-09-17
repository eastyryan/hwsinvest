"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertCircle, CalendarDays, ClipboardCheck, Cloud, Folder, HardDrive, Loader2, Lock, Newspaper, Users } from "lucide-react";
import MemberFiles from "@/components/MemberFiles";
import IssueList from "@/components/club/IssueList";
import type { Newsletter } from "@/data/newsletters";
import Attendance from "./Attendance";
import ClubCalendar from "./ClubCalendar";
import Roster from "./Roster";
import { useClubData } from "./useClubData";

const TABS = [
  { id: "calendar", label: "Calendar", icon: CalendarDays },
  { id: "roster", label: "Email list", icon: Users },
  { id: "attendance", label: "Attendance", icon: ClipboardCheck },
  { id: "newsletter", label: "Newsletter", icon: Newspaper },
  { id: "files", label: "Files", icon: Folder },
  { id: "board", label: "Board files", icon: Lock },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function AdminConsole({ issues }: { issues: Newsletter[] }) {
  const [tab, setTab] = useState<TabId>("calendar");
  const { data, state, setRoster, setEvents, setAttendance, setAttendanceAndRoster } = useClubData();

  return (
    <main className="container-x" style={{ padding: "clamp(32px,5vh,56px) 0 80px", maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
        <div>
          <p className="kicker">Admin</p>
          <h1 className="h-page" style={{ fontSize: "clamp(30px,4vw,44px)" }}>Club console</h1>
          <p className="lede" style={{ maxWidth: "50ch" }}>
            The schedule, the email list, attendance, the newsletter, member files, and a private board folder.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <SaveBadge state={state} />
          <Link href="/members" className="ctl">
            Member view
          </Link>
        </div>
      </div>

      <div className="admin-tabs" role="tablist" aria-label="Admin sections">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            role="tab"
            id={`tab-${id}`}
            aria-selected={tab === id}
            aria-controls={`panel-${id}`}
            className="admin-tab"
            onClick={() => setTab(id)}
          >
            <Icon size={15} strokeWidth={2} />
            {label}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === "calendar" && (
          <Section
            title="Club calendar"
            blurb={`Weekly meetings run every Tuesday at 7:30 PM Eastern in Stern 301 and are already on the grid. The required college trainings are pinned at the top. Add anything else the board plans, then export the whole thing to your phone.`}
          >
            <ClubCalendar custom={data.events} onChange={setEvents} />
          </Section>
        )}

        {tab === "roster" && (
          <Section
            title="Email list"
            blurb="Names and school emails in one place, ready to copy into an email. Edits save when you click out of a field."
          >
            <Roster roster={data.roster} onChange={setRoster} />
          </Section>
        )}

        {tab === "attendance" && (
          <Section
            title="Attendance"
            blurb="Paste or upload each week's sign-in CSV/xlsx. Names are matched to the email list (nicknames included), Class Year fills the Members Year column, and everyone gets a running attendance percentage. Board-only — members never see this."
          >
            <Attendance
              roster={data.roster}
              meetings={data.attendance ?? []}
              onChange={setAttendance}
              onCommitMeeting={setAttendanceAndRoster}
            />
          </Section>
        )}

        {tab === "newsletter" && (
          <Section
            title="Newsletter"
            blurb="Every issue members can read, newest first. Publishing a new one means dropping its HTML into /public/newsletters and adding a row to data/newsletters.ts."
          >
            <IssueList issues={issues} compact />
          </Section>
        )}

        {tab === "files" && (
          <Section
            title="Member files"
            blurb="Upload or remove files. Everything here shows up in the members file browser."
          >
            <MemberFiles admin showLogout={false} />
          </Section>
        )}

        {tab === "board" && (
          <Section
            title="Board files"
            blurb="Private to anyone with the admin password. Members never see this folder — use it for budgets, officer notes, and anything that should stay with the board."
          >
            <MemberFiles admin scope="board" showLogout={false} />
          </Section>
        )}
      </div>
    </main>
  );
}

function Section({ title, blurb, children }: { title: string; blurb: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="h-sub" style={{ fontSize: 22 }}>{title}</h2>
      <p style={{ fontSize: 14.5, color: "var(--muted)", lineHeight: 1.6, margin: "8px 0 22px", maxWidth: "78ch" }}>
        {blurb}
      </p>
      {children}
    </section>
  );
}

/** Says where the roster and calendar are being kept, and whether it saved. */
function SaveBadge({ state }: { state: ReturnType<typeof useClubData>["state"] }) {
  const base: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 7,
    fontSize: 12.5,
    fontWeight: 600,
    borderRadius: 9,
    padding: "8px 12px",
    border: "1px solid var(--line)",
  };

  if (state.kind === "loading") {
    return (
      <span style={{ ...base, color: "var(--faint)" }}>
        <Loader2 size={14} className="animate-spin" />
        Loading
      </span>
    );
  }
  if (state.kind === "saving") {
    return (
      <span style={{ ...base, color: "var(--brand)", borderColor: "var(--brand)" }}>
        <Loader2 size={14} className="animate-spin" />
        Saving
      </span>
    );
  }
  if (state.kind === "error") {
    return (
      <span
        style={{ ...base, color: "var(--orangeText)", borderColor: "var(--orange)" }}
        title={state.message}
      >
        <AlertCircle size={14} />
        Saved in this browser only
      </span>
    );
  }
  if (state.local) {
    return (
      <span
        style={{ ...base, color: "var(--orangeText)", borderColor: "var(--orange)" }}
        title="Dropbox isn't configured, so the roster and calendar live in this browser and won't follow you to another device."
      >
        <HardDrive size={14} />
        This browser only
      </span>
    );
  }
  return (
    <span style={{ ...base, color: "var(--green)" }} title={state.updated ? `Last saved ${new Date(state.updated).toLocaleString()}` : undefined}>
      <Cloud size={14} />
      Saved
    </span>
  );
}
