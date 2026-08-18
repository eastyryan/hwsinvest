// Sources & provenance sheet: where every figure in the workbook comes from.
//
// The external audit noted the workbook stated no provenance — a reader could
// not tell which SEC concept any given line was built from. This sheet is the
// answer. For every line on the three statements it names the exact US-GAAP
// concept tag(s) it maps to, the rule used to resolve them when a filer reports
// more than one, and whether this particular filer reported it at all. Together
// with the source API and the retrieval date at the top, that is the full chain
// from a cell in this workbook back to the filing it derives from.
//
// It is driven entirely by the concept map (lib/line-defs.ts) and the resolved
// statements, so it needs no extra data and cannot drift from what the rest of
// the workbook actually computed.

import type ExcelJS from "exceljs";
import type { CompanyFinancials } from "./edgar";
import { STATEMENT_DEFS } from "./line-defs";
import {
  sheetHeader,
  sizeColumns,
  sectionRow,
  NAVY,
  GREY,
  GREEN,
  MUTED,
  INPUT_BLUE,
} from "./excel-format";

/** CIK padded to the 10 digits the companyfacts endpoint expects. */
function padCik(cik: string): string {
  const digits = cik.replace(/\D/g, "");
  return digits.padStart(10, "0");
}

// Human-readable label for a line key, for describing derived lines by the rows
// they draw on rather than by their internal keys.
function keyLabels(): Map<string, string> {
  const m = new Map<string, string>();
  for (const { lines } of STATEMENT_DEFS) for (const l of lines) m.set(l.key, l.label);
  return m;
}

export function fillSourcesSheet(ws: ExcelJS.Worksheet, fin: CompanyFinancials, retrieved: string) {
  sheetHeader(
    ws,
    "Sources & Provenance",
    "Every line on the statements, traced to the SEC concept it is built from.",
    "Figures are US-GAAP facts from SEC EDGAR. A line maps to one or more concept tags; where a filer reports several, the resolution rule says which wins.",
    ["Concept tag(s)", "Resolution", "Reported"],
    NAVY,
    "Statement / line"
  );

  const labels = keyLabels();
  // Which line keys this filer actually reported, from the resolved annual
  // statements: any line carrying a non-null value in any period.
  const reported = new Set<string>();
  for (const st of fin.annual.statements) {
    for (const l of st.lines) {
      if (Object.values(l.values).some((v) => v != null)) reported.add(l.key);
    }
  }

  // Source header block.
  let row = 6;
  const meta: [string, string][] = [
    ["Entity", fin.name],
    ["CIK", padCik(fin.cik)],
    ["Ticker", fin.ticker || "—"],
    ["Reporting currency", fin.currency],
    ["Source", "SEC EDGAR — XBRL company facts API"],
    ["Endpoint", `https://data.sec.gov/api/xbrl/companyfacts/CIK${padCik(fin.cik)}.json`],
    ["Retrieved", retrieved],
  ];
  for (const [k, v] of meta) {
    ws.getCell(row, 1).value = k;
    ws.getCell(row, 1).font = { size: 10, bold: true, color: { argb: GREY } };
    const c = ws.getCell(row, 2);
    c.value = v;
    c.font = { size: 10, color: { argb: /Endpoint/.test(k) ? INPUT_BLUE : "FF3F3F46" } };
    row++;
  }

  row += 1;
  const describe = (def: (typeof STATEMENT_DEFS)[number]["lines"][number]) => {
    // A derived line names the rows it is computed from; a tagged line names its
    // concepts; a ranked line flags that order is a preference, not a synonym.
    if (def.derive) {
      const plus = def.derive.plus.map((k) => labels.get(k) ?? k);
      const minus = def.derive.minus.map((k) => labels.get(k) ?? k);
      const expr = plus.join(" + ") + (minus.length ? " − " + minus.join(" − ") : "");
      const concept = def.tags.length ? def.tags.join(", ") : "(derived)";
      return { concept, rule: `Derived: ${expr}` + (def.tags.length ? " (tags first)" : "") };
    }
    if (def.tags.length === 0) return { concept: "(subtotal)", rule: "Reported subtotal" };
    let rule =
      def.tags.length === 1
        ? "Direct"
        : def.preferOrder
          ? "Ranked — first present wins"
          : "Merged by recency";
    if (def.flipSign) rule += " · sign normalized (outflow)";
    else if (def.expectPositive) rule += " · sign normalized (positive)";
    return { concept: def.tags.join(", "), rule };
  };

  for (const { title, lines } of STATEMENT_DEFS) {
    sectionRow(ws, row, title, 4, NAVY);
    row++;
    for (const def of lines) {
      const { concept, rule } = describe(def);
      const r = ws.getRow(row);
      r.getCell(1).value = "    " + def.label;
      r.getCell(1).font = { size: 10 };
      const cc = r.getCell(2);
      cc.value = concept;
      cc.font = { size: 9, color: { argb: MUTED } };
      cc.alignment = { wrapText: true, vertical: "top" };
      r.getCell(3).value = rule;
      r.getCell(3).font = { size: 9, color: { argb: GREY } };
      const rep = r.getCell(4);
      const has = reported.has(def.key);
      rep.value = has ? "Yes" : "—";
      rep.font = { size: 10, color: { argb: has ? GREEN : MUTED } };
      rep.alignment = { horizontal: "center" };
      row++;
    }
    row++;
  }

  const notes = [
    "How to read this. Each statement line maps to the US-GAAP concept(s) above. A filer often reports the",
    "same idea under different tags across years, or under an industry-specific tag, so most lines list several.",
    "",
    "Merged by recency: the tags are equivalents; the freshest reported value wins where they overlap, and an",
    "older tag supplies the earlier history it alone covers. Ranked: the tags are NOT equivalents — the first",
    "one present is preferred, because a later tag would measure a different thing (a component, or a total that",
    "double-counts). Sign normalized: the magnitude is trusted and the sign is imposed, because filers disagree",
    "on the sign of some outflow and expense tags (a documented XBRL data-quality error).",
    "",
    "Reported = Yes means this filer carried a value for the line in at least one period. A dash means the",
    "concept was not found in this filer's facts, so the line is blank throughout — not an error, just not filed.",
    "",
    "This sheet documents the mapping and the source. For the authoritative figure and its exact filing, consult",
    "the company's 10-K or 10-Q on EDGAR; the endpoint above is the machine-readable feed those filings populate.",
  ];
  row += 1;
  notes.forEach((t, i) => {
    const c = ws.getCell(row + i, 1);
    c.value = t;
    c.font = { size: 9, italic: true, color: { argb: i === notes.length - 1 ? INPUT_BLUE : GREY } };
  });

  sizeColumns(ws, 3, 40, 22);
  ws.getColumn(2).width = 60;
  ws.getColumn(3).width = 34;
}
