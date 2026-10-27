import Link from "next/link";
import { publicIssues, issueNo } from "@/lib/newsletter-public";
import { SANS } from "@/components/newsletter/IssueBody";

export const metadata = {
  title: "Newsletter · HWS Investment Club",
  description: "A short weekly brief on what moved in markets, written by HWS Investment Club students.",
};

const GREY = "#6b6b6b";

export default function NewsletterArchivePage() {
  const issues = publicIssues();

  return (
    <main className="container-x" style={{ padding: "clamp(36px,6vh,64px) 0 40px", maxWidth: 760, margin: "0 auto" }}>
      <div style={{ borderBottom: "2px solid var(--brand)", paddingBottom: 14 }}>
        <h1 style={{ fontWeight: 600, fontSize: "clamp(30px,4vw,40px)", letterSpacing: "-0.015em", margin: 0, color: "var(--text)" }}>
          Newsletter
        </h1>
        <p style={{ fontFamily: SANS, fontSize: 15.5, lineHeight: 1.6, color: "#333", margin: "8px 0 0" }}>
          A short weekly brief on what moved in markets and what the club is doing.
        </p>
      </div>

      {issues.length === 0 ? (
        <p style={{ fontFamily: SANS, color: GREY, marginTop: 28 }}>The first public issue is on its way.</p>
      ) : (
        <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {issues.map((i) => (
            <li key={i.slug} style={{ borderBottom: "1px solid #e4e4e4", padding: "26px 0" }}>
              <div style={{ fontFamily: SANS, fontSize: 12.5, letterSpacing: "0.06em", textTransform: "uppercase", color: GREY }}>
                Issue {issueNo(i.no)} &nbsp;|&nbsp; {i.dateLabel}
              </div>
              <h2 style={{ fontWeight: 600, fontSize: 26, lineHeight: 1.2, margin: "8px 0 0" }}>
                <Link href={`/newsletter/${i.slug}`} style={{ color: "var(--text)", textDecoration: "none" }}>
                  {i.title}
                </Link>
              </h2>
              <p style={{ fontFamily: SANS, fontSize: 15.5, lineHeight: 1.6, color: "#333", margin: "8px 0 0", maxWidth: "64ch" }}>{i.dek}</p>
              <Link href={`/newsletter/${i.slug}`} style={{ fontFamily: SANS, display: "inline-block", marginTop: 10, fontSize: 14, fontWeight: 600, color: "var(--brand)" }}>
                Read issue {issueNo(i.no)}
              </Link>
            </li>
          ))}
        </ol>
      )}

      <p style={{ fontFamily: SANS, color: GREY, fontSize: 12.5, marginTop: 28 }}>Educational commentary, not investment advice.</p>
    </main>
  );
}
