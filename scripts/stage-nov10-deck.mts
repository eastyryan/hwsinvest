// Upload the Nov 10 Market Recap deck into Dropbox /meeting slideshows.
// DRY RUN by default. Run: npx tsx scripts/stage-nov10-deck.mts [--apply]
// Do not print Dropbox credentials. Uploads are visible to members immediately when applied.
import { readFileSync } from "fs";
for (const line of readFileSync(".env.local", "utf8").split(/\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const { listEntries, uploadFile, BASE_FOLDER } = await import("../lib/dropbox");
const DIR = `${BASE_FOLDER}/meeting slideshows`;
const SRC = "/workspace/investment-club/decks/deck-2026-11-10-market-recap.pptx";
const NAME = "IC Nov 10 2026 Market Recap.pptx";
const apply = process.argv.includes("--apply");
const existing = await listEntries(DIR);
for (const e of existing) console.log("have  ", e.name);
if (existing.some((e) => e.name === NAME)) {
  console.log("exists", NAME);
} else {
  console.log("upload", SRC, "->", NAME);
  if (apply) {
    const b = readFileSync(SRC);
    await uploadFile(DIR, NAME, b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer, "add");
    console.log("uploaded");
  }
}
const after = apply ? await listEntries(DIR) : existing;
const names = after.map((e) => e.name);
const nov = names.filter((n) => /^IC\s+/i.test(n));
console.log("count", after.length, "hasNov10", names.includes(NAME));
console.log(apply ? "applied" : "dry run (nothing changed)");
