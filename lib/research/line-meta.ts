// Human-readable metadata for statement lines: which XBRL tags feed a concept,
// whether it can be derived, and short notes for provenance tooltips.
//
// Does not require changing the normalized payload — it is a static lookup off
// the same STATEMENT_DEFS the normalizer uses.

import { STATEMENT_DEFS, type LineDef } from "./line-defs";

export interface LineMeta {
  key: string;
  label: string;
  tags: string[];
  kind: "flow" | "instant";
  derived: boolean;
  deriveFrom: string | null;
  notes: string[];
}

const BY_KEY = new Map<string, LineDef>();
for (const st of STATEMENT_DEFS) {
  for (const line of st.lines) BY_KEY.set(line.key, line);
}

const LABEL_BY_KEY = new Map<string, string>();
for (const st of STATEMENT_DEFS) {
  for (const line of st.lines) LABEL_BY_KEY.set(line.key, line.label);
}

function deriveDescription(def: LineDef): string | null {
  if (!def.derive) return null;
  const plus = def.derive.plus.map((k) => LABEL_BY_KEY.get(k) ?? k);
  const minus = def.derive.minus.map((k) => LABEL_BY_KEY.get(k) ?? k);
  const parts: string[] = [];
  if (plus.length) parts.push(plus.join(" + "));
  if (minus.length) parts.push(minus.map((m) => `− ${m}`).join(" "));
  return parts.join(" ") || null;
}

export function getLineMeta(key: string): LineMeta | null {
  const def = BY_KEY.get(key);
  if (!def) return null;
  const notes: string[] = [];
  if (def.perShare) notes.push("Per-share figure as reported.");
  if (def.shares) notes.push("Share count (average diluted or basic, as tagged).");
  if (def.flipSign) notes.push("Shown as a cash outflow (sign normalized).");
  if (def.expectPositive) notes.push("Shown as a positive expense/cost (sign normalized).");
  if (def.preferOrder) {
    notes.push("Tags are preferred in order — not merged by recency alone.");
  }
  if (def.kind === "instant") notes.push("Balance-sheet instant (point in time).");
  if (def.kind === "flow") notes.push("Period flow (over the reporting period).");
  if (def.derive) {
    notes.push(
      "When the primary tags are missing, this line can be computed from related lines."
    );
  }

  return {
    key: def.key,
    label: def.label,
    tags: def.tags.slice(0, 8),
    kind: def.kind,
    derived: !!def.derive,
    deriveFrom: deriveDescription(def),
    notes,
  };
}
