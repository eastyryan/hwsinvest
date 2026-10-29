import { ISSUES, type Newsletter } from "@/data/newsletters";
import { publicIssues } from "@/lib/newsletter-public";

// Every issue (all members-only) for the members, dashboard and admin lists: the public JSON
// issues in content/newsletter/ (read from disk at build time, so a new weekly
// file shows up automatically) plus the older members-only issues in
// data/newsletters.ts. Newest first. Server only, because it reads the
// filesystem; pass the result to client components as props.
export function allIssues(): Newsletter[] {
  const fromJson: Newsletter[] = publicIssues().map((i) => ({
    no: i.no,
    slug: i.slug,
    title: i.title,
    week: i.coverage,
    published: i.date,
    publishedLabel: i.dateLabel.replace(/^[A-Za-z]+, /, ""),
    summary: i.summary,
    topics: i.topics,
  }));
  const seen = new Set(fromJson.map((i) => i.no));
  return [...fromJson, ...ISSUES.filter((i) => !seen.has(i.no))].sort((a, b) =>
    a.published < b.published ? 1 : a.published > b.published ? -1 : b.no - a.no
  );
}
