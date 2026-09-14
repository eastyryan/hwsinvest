// The club newsletter. Each issue is a self-contained HTML document in
// /public/newsletters/, and middleware gates that whole folder behind the
// members login (see middleware.ts), so an issue URL is only readable by
// someone who is signed in.
//
// To publish a new issue:
//   1. Drop the HTML file into /public/newsletters/ (keep the date-first
//      filename so the folder sorts chronologically).
//   2. Add a row at the TOP of ISSUES below. Newest first, that ordering is
//      what the members and admin pages render.

export type Newsletter = {
  /** Issue number, as printed on the masthead. */
  no: number;
  /** URL segment used by /members/newsletter/<slug>. */
  slug: string;
  /** Public path to the issue's HTML document. */
  file: string;
  /** Headline of the issue. */
  title: string;
  /** The week the issue covers, as written on the dateline. */
  week: string;
  /** ISO date the issue went out, used for sorting and <time>. */
  published: string;
  /** Same date, written the way the masthead writes it. */
  publishedLabel: string;
  /** One or two sentences for the issue card. */
  summary: string;
  /** Short tags for the issue card. */
  topics: string[];
};

export const ISSUES: Newsletter[] = [
  {
    no: 1,
    slug: "2026-09-13-issue-01",
    file: "/newsletters/2026-09-13-issue-01.html",
    title: "The week the bond market forced the Fed's hand",
    week: "September 7–13, 2026",
    published: "2026-09-13",
    publishedLabel: "September 13, 2026",
    summary:
      "August inflation landed on forecast and was still too hot, the 30-year closed at a 19-year high, and small caps took three times the S&P's loss. Plus the week's tape, the curve, and six terms worth actually understanding.",
    topics: ["Rates", "Inflation", "Equities", "Glossary"],
  },
];

export const latestIssue = (): Newsletter | null => ISSUES[0] ?? null;

export function issueBySlug(slug: string): Newsletter | null {
  return ISSUES.find((i) => i.slug === slug) ?? null;
}
