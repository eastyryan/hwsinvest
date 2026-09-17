// Match weekly sign-in sheets (Google Form CSV, pasted names, etc.) to the
// club email roster. Exact / nickname matching runs first; leftover names go
// through SpaceXAI (xAI) when XAI_API_KEY is set.

export type RosterPerson = { name: string; email: string };

export type AttendanceMatch = {
  rawName: string;
  email: string | null;
  /** How the match was made. */
  via: "exact" | "nickname" | "fuzzy" | "ai" | "none";
  confidence: "high" | "medium" | "low";
  /**
   * Class year from the sheet (e.g. "'28"), when the CSV/xlsx had a Class Year
   * column. Written onto the Members roster on save.
   */
  year?: string;
};

export type ParseAttendanceResult = {
  matches: AttendanceMatch[];
  /** Unique roster emails marked present. */
  presentEmails: string[];
  unmatchedNames: string[];
  /** Best-guess meeting date from the sheet, if found. */
  meetingDate: string | null;
  /** True when the AI pass ran. */
  usedAi: boolean;
  /** Set when AI was wanted but unavailable / failed. */
  aiNote?: string;
};

export type SignInRow = { name: string; year?: string };

const NICKNAMES: Record<string, string[]> = {
  tom: ["thomas", "tommy"],
  tommy: ["thomas", "tom"],
  thomas: ["tom", "tommy"],
  josh: ["joshua"],
  joshua: ["josh"],
  jack: ["john", "jackson"],
  john: ["jack", "johnny"],
  johnny: ["john", "jack"],
  mike: ["michael"],
  michael: ["mike", "mick"],
  matt: ["matthew"],
  matthew: ["matt"],
  chris: ["christopher"],
  christopher: ["chris"],
  alex: ["alexander", "alexandra"],
  alexander: ["alex"],
  will: ["william", "bill"],
  william: ["will", "bill", "liam"],
  bill: ["william", "will"],
  sam: ["samuel", "samantha"],
  samuel: ["sam"],
  nick: ["nicholas"],
  nicholas: ["nick", "nico"],
  ben: ["benjamin"],
  benjamin: ["ben"],
  dan: ["daniel"],
  daniel: ["dan", "danny"],
  danny: ["daniel", "dan"],
  joe: ["joseph"],
  joseph: ["joe"],
  tony: ["anthony"],
  anthony: ["tony"],
  liz: ["elizabeth"],
  elizabeth: ["liz", "beth"],
  beth: ["elizabeth", "bethany"],
  katie: ["katherine", "kate"],
  kate: ["katherine", "katie"],
  olivia: ["liv"],
};

export function normalizeName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z\s'-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(name: string): string[] {
  return normalizeName(name).split(/[\s'-]+/).filter(Boolean);
}

function lastName(name: string): string {
  const t = tokens(name);
  return t[t.length - 1] ?? "";
}

function firstName(name: string): string {
  return tokens(name)[0] ?? "";
}

/**
 * Turn a Class Year cell into the roster Year column value.
 * Keeps Freshman / Sophomore / Junior / Senior (what the Google Form collects).
 * Aliases like frosh / first-year map to Freshman. Bare graduation years
 * ('28, 2028, Class of 2028) are left as "'YY".
 */
export function normalizeClassYear(
  raw: string | undefined | null,
  _asOf?: string | Date | null
): string | undefined {
  if (!raw) return undefined;
  const cleaned = raw.replace(/^["']+|["']+$/g, "").trim();
  if (!cleaned) return undefined;

  const lower = cleaned.toLowerCase();

  const standings: Record<string, string> = {
    freshman: "Freshman",
    frosh: "Freshman",
    "first year": "Freshman",
    "first-year": "Freshman",
    "1st year": "Freshman",
    sophomore: "Sophomore",
    "2nd year": "Sophomore",
    junior: "Junior",
    "3rd year": "Junior",
    senior: "Senior",
    "4th year": "Senior",
  };
  if (standings[lower]) return standings[lower];

  // Already a graduation year: '28, 28, 2028, Class of 2028, Class of '28
  const yearHit =
    lower.match(/^'?(\d{2})$/) ||
    lower.match(/^(20\d{2})$/) ||
    lower.match(/class\s+of\s+'?(\d{2})$/i) ||
    lower.match(/class\s+of\s+(20\d{2})$/i);
  if (yearHit) {
    const digits = yearHit[1];
    const yy = digits.length === 4 ? digits.slice(-2) : digits;
    return `'${yy}`;
  }

  // Keep free-text we don't recognize, capped.
  return cleaned.slice(0, 24);
}

/** Pull unique sign-in names (+ class year when present) and an optional meeting date. */
export function extractSignIns(text: string): {
  names: string[];
  /** Normalized class year keyed by normalizeName(name). Later rows win. */
  yearsByName: Record<string, string>;
  meetingDate: string | null;
} {
  const names: string[] = [];
  const yearsByName: Record<string, string> = {};
  const seen = new Set<string>();
  let meetingDate: string | null = null;

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim().replace(/^\uFEFF/, "");
    if (!trimmed) continue;
    // Skip header-ish lines (quoted or bare)
    const headerProbe = trimmed.replace(/^"+|"+$/g, "").replace(/","/g, ",").toLowerCase();
    if (
      /^timestamp\b/.test(headerProbe) ||
      /^"?timestamp"?\s*,/.test(trimmed.toLowerCase()) ||
      headerProbe === "full name" ||
      /^full name\b/.test(headerProbe) ||
      /^"?full name"?\s*[,;\t]/.test(trimmed.toLowerCase())
    ) {
      continue;
    }

    // CSV / TSV: "2026/09/15 7:29:30 PM AST","Olivia Wilkins","Junior"
    // Timestamp must stop before the first comma/tab so Class Year isn't
    // mistaken for the name when the engine backtracks.
    const csv = trimmed.match(
      /^"?(\d{4}[/-]\d{1,2}[/-]\d{1,2}[^",;\t]*)"?\s*[,;\t]\s*"?([^",;\t]+)"?(?:\s*[,;\t]\s*"?([^",;\t]*)"?)?/
    );
    if (csv) {
      if (!meetingDate) meetingDate = parseLooseDate(csv[1]);
      const n = csv[2].trim();
      const key = normalizeName(n);
      const year = normalizeClassYear(csv[3], meetingDate);
      if (key && !seen.has(key)) {
        seen.add(key);
        names.push(n);
      }
      if (key && year) yearsByName[key] = year;
      continue;
    }

    // Tab / comma: Name, Class Year (no timestamp)
    const nameYear = trimmed.match(/^"?([A-Za-z][^",;\t]{1,60})"?\s*[,;\t]\s*"?(Freshman|Sophomore|Junior|Senior|Frosh|'?\d{2}|20\d{2}|Class of '?[\d]{2,4})"?\s*$/i);
    if (nameYear) {
      const n = nameYear[1].trim();
      const key = normalizeName(n);
      const year = normalizeClassYear(nameYear[2], meetingDate);
      if (key && !seen.has(key)) {
        seen.add(key);
        names.push(n);
      }
      if (key && year) yearsByName[key] = year;
      continue;
    }

    // Plain name line, or "Name <email>"
    const emailish = trimmed.match(/^[^\s<>,;"']+@[^\s<>,;"']+/);
    if (emailish) continue;
    const cleaned = trimmed.replace(/^[-*•\d.)\s]+/, "").replace(/["']/g, "").trim();
    if (!cleaned || cleaned.length > 80) continue;
    if (!/[a-zA-Z]{2}/.test(cleaned)) continue;
    if (/^(class year|name|email|present|absent)$/i.test(cleaned)) continue;
    const key = normalizeName(cleaned);
    if (key && !seen.has(key)) {
      seen.add(key);
      names.push(cleaned);
    }
  }

  return { names, yearsByName, meetingDate };
}

function parseLooseDate(raw: string): string | null {
  // 2026/09/15 or 2026-09-15
  const m = raw.match(/(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (!m) return null;
  const y = m[1];
  const mo = m[2].padStart(2, "0");
  const d = m[3].padStart(2, "0");
  const iso = `${y}-${mo}-${d}`;
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : null;
}

/**
 * Apply class years from attendance matches onto the roster. Matched emails
 * with a year overwrite the existing Year cell (including blanks).
 */
export function applyYearsToRoster(
  roster: Array<{ id: string; name: string; email: string; year?: string; role?: string }>,
  matches: AttendanceMatch[]
): { roster: typeof roster; updated: number } {
  const yearByEmail = new Map<string, string>();
  for (const m of matches) {
    if (!m.email || !m.year) continue;
    yearByEmail.set(m.email.toLowerCase(), m.year);
  }
  if (yearByEmail.size === 0) return { roster, updated: 0 };

  let updated = 0;
  const next = roster.map((r) => {
    const year = yearByEmail.get(r.email.trim().toLowerCase());
    if (!year || r.year === year) return r;
    updated += 1;
    return { ...r, year };
  });
  return { roster: next, updated };
}

function firstNamesMatch(a: string, b: string): boolean {
  if (a === b) return true;
  const alts = NICKNAMES[a] ?? [];
  return alts.includes(b);
}

type Cand = { email: string; name: string; score: number; via: AttendanceMatch["via"] };

function scoreAgainstRoster(rawName: string, roster: RosterPerson[]): Cand | null {
  const rawNorm = normalizeName(rawName);
  const rawFirst = firstName(rawName);
  const rawLast = lastName(rawName);
  if (!rawNorm) return null;

  let best: Cand | null = null;

  for (const person of roster) {
    if (!person.email) continue;
    const pNorm = normalizeName(person.name);
    const pFirst = firstName(person.name);
    const pLast = lastName(person.name);

    let score = 0;
    let via: AttendanceMatch["via"] = "fuzzy";

    if (rawNorm === pNorm) {
      score = 100;
      via = "exact";
    } else if (rawLast && rawLast === pLast && firstNamesMatch(rawFirst, pFirst)) {
      score = 92;
      via = "nickname";
    } else if (rawLast && rawLast === pLast && rawFirst && pFirst.startsWith(rawFirst[0])) {
      // "Jack Dillon" vs "John Dillon" — same last, first initial
      score = 70;
      via = "fuzzy";
    } else if (rawLast && rawLast === pLast && rawFirst && pFirst) {
      score = 55;
      via = "fuzzy";
    } else if (
      // "Anthony Navarrete" vs "Anthony Navarrete Aguirr"
      pNorm.startsWith(rawNorm) ||
      rawNorm.startsWith(pNorm.split(" ").slice(0, 2).join(" "))
    ) {
      score = 88;
      via = "fuzzy";
    } else if (rawLast && pNorm.includes(rawLast) && firstNamesMatch(rawFirst, pFirst)) {
      score = 80;
      via = "nickname";
    }

    if (score > 0 && (!best || score > best.score)) {
      best = { email: person.email.toLowerCase(), name: person.name, score, via };
    }
  }

  // Ambiguous last-name-only fuzzy: if another roster share same last + similar score, drop
  if (best && best.score < 85 && best.via === "fuzzy") {
    const last = lastName(
      roster.find((r) => r.email.toLowerCase() === best!.email)?.name ?? ""
    );
    const rivals = roster.filter(
      (r) => lastName(r.name) === last && r.email.toLowerCase() !== best!.email
    );
    if (rivals.length > 0 && best.score < 75) return null;
  }

  return best && best.score >= 70 ? best : null;
}

function confidenceFor(score: number, via: AttendanceMatch["via"]): AttendanceMatch["confidence"] {
  if (via === "exact" || score >= 90) return "high";
  if (score >= 80) return "medium";
  return "low";
}

async function matchWithAi(
  unmatched: string[],
  roster: RosterPerson[]
): Promise<{ matches: AttendanceMatch[]; note?: string }> {
  const key = process.env.XAI_API_KEY;
  if (!key) {
    return { matches: [], note: "XAI_API_KEY is not set, so fuzzy AI matching is offline." };
  }
  if (unmatched.length === 0) return { matches: [] };

  const schema = {
    type: "object",
    properties: {
      matches: {
        type: "array",
        items: {
          type: "object",
          properties: {
            rawName: { type: "string" },
            email: { type: ["string", "null"] },
            confidence: { type: "string", enum: ["high", "medium", "low"] },
          },
          required: ["rawName", "email", "confidence"],
          additionalProperties: false,
        },
      },
    },
    required: ["matches"],
    additionalProperties: false,
  };

  const rosterLines = roster
    .map((r) => `- ${r.name} <${r.email.toLowerCase()}>`)
    .join("\n");

  const system = `You match student sign-in names from an investment club attendance sheet to a roster of name+email pairs.

Rules:
- Only return emails that appear EXACTLY in the roster list. Never invent emails.
- If you are not reasonably sure, set email to null.
- Handle nicknames (Tom/Tommy/Thomas, Josh/Joshua, Jack/John when last name uniquely matches), missing middle/last particles, and capitalization.
- Deduplicated input: each rawName appears once.
- Return one result object per input rawName.`;

  const user = `Roster:\n${rosterLines}\n\nSign-in names to match:\n${unmatched.map((n) => `- ${n}`).join("\n")}`;

  try {
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "grok-4.5",
        temperature: 0,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        response_format: {
          type: "json_schema",
          json_schema: { name: "attendance_matches", schema, strict: true },
        },
      }),
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text();
      return { matches: [], note: `AI match failed (${res.status}): ${text.slice(0, 180)}` };
    }

    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = json.choices?.[0]?.message?.content ?? "";
    const parsed = JSON.parse(content) as {
      matches?: Array<{ rawName?: string; email?: string | null; confidence?: string }>;
    };

    const allowed = new Set(roster.map((r) => r.email.toLowerCase()));
    const out: AttendanceMatch[] = [];
    for (const m of parsed.matches ?? []) {
      const rawName = typeof m.rawName === "string" ? m.rawName.trim() : "";
      if (!rawName) continue;
      const email =
        typeof m.email === "string" && allowed.has(m.email.trim().toLowerCase())
          ? m.email.trim().toLowerCase()
          : null;
      const confidence =
        m.confidence === "high" || m.confidence === "medium" || m.confidence === "low"
          ? m.confidence
          : email
            ? "medium"
            : "low";
      out.push({
        rawName,
        email,
        via: email ? "ai" : "none",
        confidence: email ? confidence : "low",
      });
    }
    return { matches: out };
  } catch (e) {
    return {
      matches: [],
      note: e instanceof Error ? e.message : "AI match failed",
    };
  }
}

/**
 * Full pipeline: extract names from pasted sheet → deterministic match →
 * optional AI for leftovers → present email set + unmatched list.
 */
export async function parseAttendanceSheet(
  text: string,
  roster: RosterPerson[]
): Promise<ParseAttendanceResult> {
  const cleanRoster = roster
    .map((r) => ({ name: r.name.trim(), email: r.email.trim().toLowerCase() }))
    .filter((r) => r.name && r.email.includes("@"));

  const { names, yearsByName, meetingDate } = extractSignIns(text);
  const yearFor = (rawName: string) => yearsByName[normalizeName(rawName)];
  const matches: AttendanceMatch[] = [];
  const needAi: string[] = [];

  for (const rawName of names) {
    const hit = scoreAgainstRoster(rawName, cleanRoster);
    if (hit) {
      matches.push({
        rawName,
        email: hit.email,
        via: hit.via,
        confidence: confidenceFor(hit.score, hit.via),
        year: yearFor(rawName),
      });
    } else {
      needAi.push(rawName);
    }
  }

  let usedAi = false;
  let aiNote: string | undefined;
  if (needAi.length > 0) {
    const ai = await matchWithAi(needAi, cleanRoster);
    usedAi = Boolean(process.env.XAI_API_KEY) && !ai.note;
    aiNote = ai.note;
    const byRaw = new Map(ai.matches.map((m) => [normalizeName(m.rawName), m]));
    for (const rawName of needAi) {
      const m = byRaw.get(normalizeName(rawName));
      const year = yearFor(rawName);
      if (m) {
        matches.push({ ...m, rawName, year });
      } else {
        matches.push({ rawName, email: null, via: "none", confidence: "low", year });
      }
    }
  }

  const presentEmails = [...new Set(matches.map((m) => m.email).filter((e): e is string => Boolean(e)))];
  const unmatchedNames = matches.filter((m) => !m.email).map((m) => m.rawName);

  return {
    matches,
    presentEmails,
    unmatchedNames,
    meetingDate,
    usedAi,
    aiNote,
  };
}
