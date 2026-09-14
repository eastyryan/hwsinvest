import Link from "next/link";
import { ArrowRight, Newspaper } from "lucide-react";
import type { Newsletter } from "@/data/newsletters";

// Shared issue list. The members newsletter page renders it full width; the
// admin console renders the same cards inside its Newsletter section.
export default function IssueList({
  issues,
  compact = false,
}: {
  issues: Newsletter[];
  compact?: boolean;
}) {
  if (issues.length === 0) {
    return (
      <p style={{ fontSize: 15, color: "var(--muted)", margin: "24px 0 0" }}>
        No issues published yet.
      </p>
    );
  }

  return (
    <div style={{ display: "grid", gap: 14, marginTop: compact ? 0 : "clamp(28px,4vh,40px)" }}>
      {issues.map((issue, i) => (
        <article key={issue.slug} className="card lift card-hover-brand" style={{ padding: compact ? 18 : 22 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
            <span
              className="mono"
              style={{
                fontSize: 11.5,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                fontWeight: 700,
                color: "var(--brand)",
              }}
            >
              Issue {String(issue.no).padStart(2, "0")}
            </span>
            <time
              dateTime={issue.published}
              className="mono"
              style={{ fontSize: 11.5, letterSpacing: "0.06em", color: "var(--faint)" }}
            >
              {issue.publishedLabel}
            </time>
            {i === 0 && (
              <span
                className="mono"
                style={{
                  fontSize: 10.5,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  fontWeight: 700,
                  color: "var(--orangeText)",
                  border: "1px solid var(--orange)",
                  borderRadius: 7,
                  padding: "2px 8px",
                }}
              >
                Latest
              </span>
            )}
          </div>

          <h2 className="h-sub" style={{ fontSize: compact ? 20 : 24, lineHeight: 1.2 }}>
            {issue.title}
          </h2>
          <p style={{ fontSize: 12.5, color: "var(--faint)", margin: "6px 0 0" }}>{issue.week}</p>
          <p style={{ fontSize: 14.5, color: "var(--muted)", lineHeight: 1.6, margin: "10px 0 0", maxWidth: "64ch" }}>
            {issue.summary}
          </p>

          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
            <Link
              href={`/members/newsletter/${issue.slug}`}
              className="ctl"
              style={{ color: "var(--brand)", borderColor: "var(--brand)" }}
            >
              <Newspaper size={15} strokeWidth={2} />
              Read issue
              <ArrowRight size={15} strokeWidth={2} />
            </Link>
            <a href={issue.file} target="_blank" rel="noreferrer" className="ctl">
              Open in new tab
            </a>
            <span style={{ flex: 1 }} />
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {issue.topics.map((t) => (
                <span
                  key={t}
                  className="mono"
                  style={{
                    fontSize: 10.5,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: "var(--muted)",
                    background: "var(--card2)",
                    border: "1px solid var(--line)",
                    borderRadius: 999,
                    padding: "3px 9px",
                  }}
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
