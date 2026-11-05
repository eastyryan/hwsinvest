// One-off: import the 2026-11-03 meeting rows (15 sign-ins from "Investment Club Weekly Attendance (Responses)").
// DRY RUN by default. Run: npx tsx scripts/import-attendance-2026-11-03.mts [--write]   (needs .env.local with DROPBOX_*)
// Do NOT pass --write until Easton approves. Never changes existing roster emails; adds no new members.
import { readFileSync, writeFileSync } from "fs";
import { parseAttendanceSheet, applyYearsToRoster } from "../lib/attendance-match";
import { loadClubData, saveClubData, presentEmailsForMeeting, ALWAYS_PRESENT_EMAILS } from "../lib/club-store";
for (const line of readFileSync(".env.local", "utf8").split(/\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (!m) continue;
  process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const DATE = "2026-11-03";
const csv = readFileSync("/workspace/att-1103.csv", "utf8");
const data = await loadClubData();
const orig = JSON.parse(JSON.stringify(data));
const roster = data.roster.map((r) => ({ name: r.name, email: r.email }));
const res = await parseAttendanceSheet(csv, roster);
const prior = data.attendance.find((m) => m.date === DATE);
const nums = data.attendance.map((m) => Number(m.label?.match(/Meeting (\d+)/)?.[1] ?? 0));
const label = prior?.label || `Meeting ${Math.max(0, ...nums) + 1}`;
console.log("existing meetings:", data.attendance.map((m) => `${m.date} ${m.label} (${m.presentEmails.length})`).join("; "));
console.log("label", label, "| matched", res.presentEmails.length, "| unmatched", res.unmatchedNames);
for (const m of res.matches) console.log("  ", m.rawName, "->", m.email, m.via, m.confidence ?? "");
const present = presentEmailsForMeeting([...new Set([...(prior?.presentEmails ?? []), ...res.presentEmails])], data.roster);
console.log("presentEmails incl. always-present", ALWAYS_PRESENT_EMAILS, ":", present.length);
const nextRoster = applyYearsToRoster(data.roster as any, res.matches).roster as any;
for (const r of nextRoster) { const o = data.roster.find((x) => x.id === r.id); if (o && o.email !== r.email) throw new Error("email change blocked " + o.email); if (o && o.year !== r.year) console.log("  year", o.name, o.year, "->", r.year); }
if (process.argv.includes("--write")) {
  const bk = `/workspace/investment-club/attendance-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  writeFileSync(bk, JSON.stringify(orig, null, 2)); console.log("backup", bk);
  const meetings = data.attendance.filter((m) => m.date !== DATE);
  meetings.push({ ...(prior ?? {}), id: prior?.id || `a-${DATE}-${Date.now().toString(36)}`, date: DATE, label, presentEmails: present,
    unmatchedNames: [...new Set([...(prior?.unmatchedNames ?? []), ...res.unmatchedNames])],
    recordedAt: prior?.recordedAt || new Date().toISOString() } as any);
  const s = await saveClubData({ ...data, roster: nextRoster, attendance: meetings }); console.log("saved", s.attendance.length, "meetings");
} else console.log("dry run (nothing written)");
