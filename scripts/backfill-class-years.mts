import { readFileSync } from "fs";
import { extractSignIns, normalizeName } from "../lib/attendance-match";
import { workbookToCsvText } from "../lib/attendance-sheet";
import { loadClubData, saveClubData } from "../lib/club-store";

// Load .env.local into process.env (no dotenv dependency).
for (const line of readFileSync(".env.local", "utf8").split(/\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (!m) continue;
  let v = m[2];
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1);
  }
  v = v.replace(/\\\$/g, "$");
  process.env[m[1]] = v;
}

const xlsxPath =
  process.argv[2] ||
  "/Users/eastonryan/Downloads/Investment Club Weekly Attendance (Responses).xlsx";

const xlsx = readFileSync(xlsxPath);
const csv = await workbookToCsvText(
  xlsx.buffer.slice(xlsx.byteOffset, xlsx.byteOffset + xlsx.byteLength)
);
const { yearsByName } = extractSignIns(csv);
console.log("sheet years", Object.keys(yearsByName).length, yearsByName);

const data = await loadClubData();
console.log("roster size", data.roster.length);

function yearForRosterName(rosterName: string): string | undefined {
  const key = normalizeName(rosterName);
  if (yearsByName[key]) return yearsByName[key];

  // "Anthony Navarrete Aguirr" ← sheet "Anthony Navarrete"
  for (const [sheetKey, year] of Object.entries(yearsByName)) {
    if (key.startsWith(sheetKey + " ") || sheetKey.startsWith(key + " ")) {
      return year;
    }
  }

  const last = key.split(/\s+/).slice(-1)[0];
  const first = key.split(/\s+/)[0];
  const hits = Object.entries(yearsByName).filter(([k]) => {
    const parts = k.split(/\s+/);
    return parts[parts.length - 1] === last && parts[0] === first;
  });
  if (hits.length === 1) return hits[0][1];

  // Nickname-ish: Tom/Tommy, Josh/Joshua, Jack/John when last name unique in sheet
  const nickPairs: Record<string, string[]> = {
    tom: ["thomas", "tommy"],
    tommy: ["thomas", "tom"],
    thomas: ["tom", "tommy"],
    josh: ["joshua"],
    joshua: ["josh"],
    jack: ["john"],
    john: ["jack"],
  };
  const alts = nickPairs[first] ?? [];
  if (alts.length && last) {
    const nickHits = Object.entries(yearsByName).filter(([k]) => {
      const parts = k.split(/\s+/);
      return parts[parts.length - 1] === last && alts.includes(parts[0]);
    });
    if (nickHits.length === 1) return nickHits[0][1];
  }
  return undefined;
}

let updated = 0;
const nextRoster = data.roster.map((r) => {
  const year = yearForRosterName(r.name);
  if (!year || r.year === year) return r;
  updated += 1;
  return { ...r, year };
});

console.log("updated", updated);
for (const r of nextRoster) {
  if (r.year) console.log(`  ${r.name} -> ${r.year}`);
}
const missing = nextRoster.filter((r) => !r.year).map((r) => r.name);
console.log("still missing", missing.length, missing);

if (updated === 0) {
  console.log("nothing to save");
  process.exit(0);
}

const saved = await saveClubData({ ...data, roster: nextRoster });
console.log("saved at", saved.updated);
