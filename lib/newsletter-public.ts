import fs from "node:fs";
import path from "node:path";

/**
 * Newsletter issues written as JSON, one file per issue in
 * content/newsletter/<YYYY-MM-DD>-issue-<NN>.json. They are members-only:
 * they render at /members/newsletter/<slug> behind the members login, next to
 * the older HTML issues in data/newsletters.ts. lib/newsletter-all.ts merges
 * both lists. Drop a new file in the folder and it shows up on the next build.
 */

export type PublicIssue = {
  no: number;
  slug: string;
  date: string; // YYYY-MM-DD, used for sorting
  dateLabel: string;
  /** Masthead band, e.g. "October 12 to 26, 2026". */
  coverage: string;
  window: string;
  public: boolean; // published to members; false keeps a draft hidden
  title: string;
  dek: string;
  summary: string;
  topics: string[];
  keyNumbersNote: string;
  keyNumbers: { label: string; value: string; change: string }[];
  briefs: { headline: string; body: string }[];
  earningsLead: string;
  earnings: { company: string; line: string }[];
  /** Optional. Omit both (or leave empty) to drop the Club section. */
  club?: { title: string; body: string }[];
  meetings?: { when: string; what: string }[];
  weekAhead: { day: string; items: string[] }[];
  /** Optional. Omit for no sign-off (the default); the disclaimer still shows. */
  signoff?: string;
  disclaimer: string;
  /** Fact-check trail. Kept in the file, never rendered. */
  sources: { label: string; url: string }[];
};

const DIR = path.join(process.cwd(), "content", "newsletter");

function readAll(): PublicIssue[] {
  if (!fs.existsSync(DIR)) return [];
  return fs
    .readdirSync(DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      const issue = JSON.parse(fs.readFileSync(path.join(DIR, f), "utf8")) as PublicIssue;
      const expected = f.replace(/\.json$/, "");
      if (issue.slug !== expected) {
        throw new Error(`content/newsletter/${f}: slug "${issue.slug}" should be "${expected}"`);
      }
      return issue;
    });
}

/** Published issues, newest first. */
export function publicIssues(): PublicIssue[] {
  return readAll()
    .filter((i) => i.public)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.no - a.no));
}

export function publicIssueBySlug(slug: string): PublicIssue | undefined {
  return publicIssues().find((i) => i.slug === slug);
}

export const issueNo = (n: number) => String(n).padStart(2, "0");
