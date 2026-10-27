import Link from "next/link";
import { publicIssues, issueNo } from "@/lib/newsletter-public";

export const metadata = {
  title: "Newsletter · HWS Investment Club",
  description: "The HWS Investment Club Weekly: what moved in markets and why, written by students.",
};

export default function NewsletterArchivePage() {
  const issues = publicIssues();
  const [latest, ...rest] = issues;

  return (
    <main className="container-x" style={{ padding: "clamp(32px,5vh,56px) 0 40px", maxWidth: 960, margin: "0 auto" }}>
      <p className="kicker">Newsletter</p>
      <h1 className="h-page" style={{ fontSize: "clamp(30px,4vw,44px)" }}>HWS Investment Club Weekly</h1>
      <p className="lede" style={{ maxWidth: "58ch" }}>
        A short weekly read on what moved in markets and why, plus what the club is working on. Written by students,
        for students.
      </p>

      {!latest ? (
        <p className="lede" style={{ marginTop: 32 }}>The first public issue is on its way.</p>
      ) : (
        <>
          <Link
            href={`/newsletter/${latest.slug}`}
            className="card card-hover-orange lift"
            style={{ display: "block", marginTop: 32, padding: "26px 28px", textDecoration: "none", color: "inherit" }}
          >
            <div className="mono" style={{ fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--orangeText)" }}>
              Latest · Issue {issueNo(latest.no)} · {latest.dateLabel}
            </div>
            <h2 style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontWeight: 700, fontSize: "clamp(22px,2.6vw,30px)", lineHeight: 1.2, margin: "10px 0 0", color: "var(--brand)" }}>
              {latest.title}
            </h2>
            <p style={{ color: "var(--muted)", fontSize: 15, lineHeight: 1.6, margin: "10px 0 0", maxWidth: "70ch" }}>{latest.summary}</p>
            <ul style={{ margin: "14px 0 0", padding: "0 0 0 18px", color: "var(--text)", fontSize: 14.5, lineHeight: 1.55 }}>
              {latest.inShort.map((t) => (
                <li key={t} style={{ marginBottom: 6 }}>{t}</li>
              ))}
            </ul>
            <div style={{ marginTop: 14, fontSize: 14, fontWeight: 600, color: "var(--brand)" }}>Read the issue →</div>
          </Link>

          {rest.length > 0 && (
            <section style={{ marginTop: 40 }}>
              <h2 style={{ fontWeight: 700, fontSize: 20, margin: 0, color: "var(--text)" }}>Past issues</h2>
              <div style={{ display: "grid", gap: 12, marginTop: 14 }}>
                {rest.map((i) => (
                  <Link
                    key={i.slug}
                    href={`/newsletter/${i.slug}`}
                    className="card card-hover-brand"
                    style={{ display: "block", padding: "16px 20px", textDecoration: "none", color: "inherit" }}
                  >
                    <div className="mono" style={{ fontSize: 12, color: "var(--faint)" }}>
                      Issue {issueNo(i.no)} · {i.dateLabel}
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 16, marginTop: 4, color: "var(--text)" }}>{i.title}</div>
                    <div style={{ color: "var(--muted)", fontSize: 14, marginTop: 4 }}>{i.summary}</div>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      <p style={{ color: "var(--faint)", fontSize: 12.5, marginTop: 36 }}>
        Educational commentary, not investment advice.
      </p>
    </main>
  );
}
