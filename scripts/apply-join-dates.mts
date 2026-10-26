// One-off: write joinedAt (date added to the email list) onto roster rows in club.json.
// Dates come from /workspace/joindates/joindates.json (email -> {date, source}).
// Run: npx tsx@4.19.2 scripts/apply-join-dates.mts [--write]   (needs .env.local with DROPBOX_*)
// Only adds a joinedAt key; never touches names, emails, ids, or meetings.
import { readFileSync, writeFileSync } from "fs";
for (const line of readFileSync(".env.local", "utf8").split(/\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (!m) continue;
  process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const { readJson, writeJson } = await import("../lib/dropbox");
const J = JSON.parse(readFileSync("/workspace/joindates/joindates.json", "utf8")) as Record<string, { date: string }>;
const raw: any = await readJson("club.json");
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
writeFileSync(`/workspace/investment-club/club-backup-before-joindates-${stamp}.json`, JSON.stringify(raw, null, 2));
const before = raw.roster.map((r: any) => `${r.id}|${r.name}|${r.email}`);
let set = 0;
for (const r of raw.roster) {
  const j = J[String(r.email).toLowerCase()];
  if (j && r.joinedAt !== j.date) { r.joinedAt = j.date; set++; }
}
const after = raw.roster.map((r: any) => `${r.id}|${r.name}|${r.email}`);
if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error("roster identity changed; aborting");
const missing = Object.keys(J).filter((e) => !raw.roster.some((r: any) => r.email.toLowerCase() === e));
if (missing.length) throw new Error("emails not on roster: " + missing.join(", "));
console.log("roster", raw.roster.length, "joinedAt to set", set);
if (process.argv.includes("--write") && set > 0) {
  await writeJson("club.json", raw); // raw doc, `updated` left as-is so nothing else changes
  const back: any = await readJson("club.json");
  console.log("written; rows with joinedAt now:", back.roster.filter((r: any) => r.joinedAt).length, "roster", back.roster.length, "meetings", back.attendance.length);
} else console.log("dry run; pass --write to save");
