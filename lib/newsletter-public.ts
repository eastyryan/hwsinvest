import fs from "node:fs";
import path from "node:path";

/**
 * Public newsletter issues. One JSON file per issue lives in
 * content/newsletter/<YYYY-MM-DD>-issue-<NN>.json. Drop a new file in that
 * folder and the archive and the issue page pick it up at build time.
 *
 * The older members-only issues (data/newsletters.ts and the raw HTML in
 * public/newsletters) stay behind the members login and are not read here.
 */

export type PublicIssue = {
  no: number;
  slug: string;
  date: string; // YYYY-MM-DD, used for sorting
  dateLabel: string;
  window: string;
  public: boolean; // false keeps a draft off the site
  title: string;
  dek: string;
  summary: string;
  topics: string[];
  keyNumbersNote: string;
  keyNumbers: { label: string; value: string; change: string }[];
  briefs: { headline: string; body: string }[];
  earningsLead: string;
  earnings: { company: string; line: string }[];
  club: { title: string; body: string }[];
  meetings: { when: string; what: string }[];
  weekAhead: { day: string; items: string[] }[];
  signoff: string;
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
