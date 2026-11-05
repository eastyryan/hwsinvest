// Rename existing "Meeting Slideshows" decks to "IC <Mon> <day> <year> <topic>.pptx" and upload the 3 missing decks.
// DRY RUN by default. Run: npx tsx scripts/stage-meeting-slideshows.mts [--apply]   (needs .env.local with DROPBOX_*)
// Do NOT pass --apply until Easton approves: uploads/renames are visible to members immediately.
import { readFileSync } from "fs";
for (const line of readFileSync(".env.local", "utf8").split(/\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const { listEntries, movePath, uploadFile, BASE_FOLDER } = await import("../lib/dropbox");
const DIR = `${BASE_FOLDER}/meeting slideshows`;
const RENAMES: Record<string, string> = {
  "Investment_Club_Meeting_Sept_15.pptx": "IC Sep 15 2026 Rates, the Fed and Market Recap.pptx",
  "Inv club Sept 24.pptx": "IC Sep 24 2026 Stock Basics, PE Multiples and Rates.pptx",
  "Inv club oct 8.pptx": "IC Oct 8 2026 Pitching and Valuation Basics.pptx",
  "Inv club oct 13.pptx": "IC Oct 13 2026 Earnings Basics.pptx",
  // Undated club overview deck (board, meeting formats, website). Date to be confirmed by Easton.
  "HWS_Investment_Club_Deck.pptx": "IC Club Overview and Meet the Board.pptx",
};
const IN = "/workspace/investment-club/incoming-decks";
const UPLOADS = [
  { src: `${IN}/01M6MSD6Z216NXQEM03JTPJS97.pptx`, name: "IC Oct 22 2026 Market Recap and Bloomberg Terminal Intro.pptx" },
  { src: `${IN}/01M6MSAH8WN3JS9C92Y9N4CT3F.pptx`, name: "IC Oct 29 2026 Financial Modelling.pptx" },
  { src: `${IN}/01M6MSC125T27EAZ3JAXC5K7NF.pptx`, name: "IC Nov 3 2026 Financial Modelling.pptx" },
];
const apply = process.argv.includes("--apply");
const existing = await listEntries(DIR);
const names = new Set(existing.map((e) => e.name));
for (const e of existing) {
  const to = RENAMES[e.name]; if (!to) { console.log("keep  ", e.name); continue; }
  console.log("rename", e.name, "->", to);
  if (apply) await movePath(e.path, `${DIR}/${to}`);
}
for (const u of UPLOADS) {
  if (names.has(u.name)) { console.log("exists", u.name); continue; }
  console.log("upload", u.src, "->", u.name);
  if (apply) { const b = readFileSync(u.src); await uploadFile(DIR, u.name, b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer, "add"); }
}
console.log(apply ? "applied" : "dry run (nothing changed)");
