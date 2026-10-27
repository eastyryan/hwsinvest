import type { CSSProperties, ReactNode } from "react";
import type { PublicIssue } from "@/lib/newsletter-public";
import { issueNo } from "@/lib/newsletter-public";

// Minimal brief: dark text on white, one thin purple rule, no boxes or colour panels.
// `issue.sources` is intentionally not rendered.
export const SANS = "Inter, -apple-system, 'Segoe UI', 'Helvetica Neue', Helvetica, Arial, sans-serif";
const INK = "var(--text)";
const BODY = "#333";
const GREY = "#6b6b6b";
const RULE = "1px solid #e4e4e4";

const body: CSSProperties = { fontFamily: SANS, fontSize: 16, lineHeight: 1.6, color: BODY, margin: 0 };

function Block({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <section style={{ borderTop: RULE, padding: "32px 0" }}>
      {label && (
        <div style={{ fontFamily: SANS, fontSize: 11.5, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: GREY, marginBottom: 16 }}>
          {label}
        </div>
      )}
      {children}
    </section>
  );
}

function Line({ lead, text }: { lead: string; text: string }) {
  return (
    <p style={{ ...body, fontSize: 15.5, marginBottom: 10 }}>
      <strong style={{ color: INK }}>{lead}</strong>&nbsp; {text}
    </p>
  );
}

export default function IssueBody({ issue }: { issue: PublicIssue }) {
  return (
    <article style={{ marginTop: 28 }}>
      <header style={{ paddingBottom: 28 }}>
        <div style={{ fontFamily: SANS, fontSize: 12.5, letterSpacing: "0.06em", textTransform: "uppercase", color: GREY }}>
          Issue {issueNo(issue.no)} &nbsp;|&nbsp; Geneva, N.Y. &nbsp;|&nbsp; {issue.dateLabel}
        </div>
        <h1 style={{ fontWeight: 600, fontSize: "clamp(32px,4.6vw,46px)", lineHeight: 1.1, letterSpacing: "-0.015em", margin: "14px 0 0", color: INK }}>
          {issue.title}
        </h1>
        <p style={{ ...body, fontSize: 18.5, marginTop: 16, maxWidth: "62ch" }}>{issue.dek}</p>
        <div style={{ fontFamily: SANS, fontSize: 14, marginTop: 22, display: "flex", flexWrap: "wrap", gap: "6px 22px" }} className="nums">
          {issue.keyNumbers.map((k) => (
            <span key={k.label} style={{ whiteSpace: "nowrap" }}>
              <span style={{ color: GREY }}>{k.label}</span> <strong style={{ color: INK, fontWeight: 600 }}>{k.value}</strong>{" "}
              <span style={{ color: INK }}>{k.change}</span>
            </span>
          ))}
        </div>
        <div style={{ fontFamily: SANS, fontSize: 12, color: GREY, marginTop: 6 }}>{issue.keyNumbersNote}</div>
      </header>

      <Block>
        {issue.briefs.map((b) => (
          <div key={b.headline} style={{ marginBottom: 28 }}>
            <h2 style={{ fontWeight: 600, fontSize: 24, lineHeight: 1.2, margin: "0 0 6px", color: INK }}>{b.headline}</h2>
            <p style={{ ...body, maxWidth: "66ch" }}>{b.body}</p>
          </div>
        ))}
      </Block>

      <Block label="Earnings">
        <p style={{ ...body, color: INK, marginBottom: 14 }}>{issue.earningsLead}</p>
        {issue.earnings.map((e) => (
          <Line key={e.company} lead={e.company} text={e.line} />
        ))}
      </Block>

      <Block label="Club">
        {issue.club.map((c) => (
          <Line key={c.title} lead={`${c.title}.`} text={c.body} />
        ))}
        <div style={{ height: 8 }} />
        {issue.meetings.map((m) => (
          <Line key={m.when} lead={m.when} text={m.what} />
        ))}
      </Block>

      <Block label="The week ahead">
        {issue.weekAhead.map((w) => (
          <Line key={w.day} lead={w.day} text={w.items.join(" ")} />
        ))}
        <p style={{ ...body, fontSize: 12.5, color: GREY, marginTop: 6 }}>Times Eastern.</p>
      </Block>

      <footer style={{ borderTop: RULE, paddingTop: 24 }}>
        <p style={{ ...body, color: INK, fontSize: 15.5 }}>{issue.signoff}</p>
        <p style={{ ...body, color: GREY, fontSize: 14 }}>HWS Investment Club</p>
        <p style={{ ...body, color: GREY, fontSize: 12.5, marginTop: 16 }}>{issue.disclaimer}</p>
      </footer>
    </article>
  );
}
