import type { CSSProperties, ReactNode } from "react";
import type { Dir, PublicIssue } from "@/lib/newsletter-public";
import { issueNo } from "@/lib/newsletter-public";

const SERIF = "Georgia, 'Times New Roman', serif";
const dirColor = (d: Dir) => (d === "up" ? "var(--up)" : d === "down" ? "var(--down)" : "var(--text)");

const cell: CSSProperties = { padding: "10px 12px", borderBottom: "1px solid var(--line)", verticalAlign: "top", fontSize: 14.5, lineHeight: 1.5 };
const head: CSSProperties = {
  padding: "8px 12px",
  textAlign: "left",
  fontSize: 11.5,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--faint)",
  borderBottom: "2px solid var(--brand)",
  fontWeight: 600,
};

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section style={{ marginTop: 40 }}>
      <div style={{ width: 36, height: 3, background: "var(--orange)", borderRadius: 2 }} />
      <h2 style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 24, margin: "10px 0 14px", color: "var(--brand)" }}>{title}</h2>
      {children}
    </section>
  );
}

export default function IssueBody({ issue }: { issue: PublicIssue }) {
  return (
    <article style={{ marginTop: 22 }}>
      {/* Masthead: white band with the shields, purple band with orange text, orange stripe. */}
      <header className="card" style={{ overflow: "hidden", padding: 0 }}>
        <div style={{ background: "var(--card)", padding: "22px 28px 16px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/hws-shield.png" alt="Hobart and William Smith shields" width={110} height={56} style={{ display: "block" }} />
          <div style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 24, color: "var(--brand)" }}>HWS Investment Club Weekly</div>
        </div>
        <div style={{ background: "#4b2e83", padding: "22px 28px 24px" }}>
          <div className="mono" style={{ fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: "#f36f21", fontWeight: 700 }}>
            Issue {issueNo(issue.no)} · {issue.dateLabel}
          </div>
          <h1 style={{ fontFamily: SERIF, fontWeight: 700, fontSize: "clamp(26px,3.6vw,38px)", lineHeight: 1.18, margin: "10px 0 6px", color: "#fff" }}>
            {issue.title}
          </h1>
          <div style={{ fontSize: 14, color: "#e6e0f2" }}>Covering {issue.window}</div>
        </div>
        <div style={{ height: 5, background: "#f36f21" }} />
      </header>

      <div style={{ marginTop: 28, borderLeft: "4px solid var(--orange)", background: "var(--bgDeep)", padding: "16px 20px" }} className="card">
        <div className="kicker" style={{ fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase" }}>In short</div>
        <ul style={{ margin: "10px 0 0", padding: "0 0 0 18px", fontSize: 16, lineHeight: 1.6, color: "var(--text)" }}>
          {issue.inShort.map((t) => (
            <li key={t} style={{ marginBottom: 8 }}>{t}</li>
          ))}
        </ul>
      </div>

      <Section title="The tape">
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={head}>Market</th>
                <th style={{ ...head, textAlign: "right" }}>Close</th>
                <th style={{ ...head, textAlign: "right" }}>2 weeks</th>
              </tr>
            </thead>
            <tbody className="nums">
              {issue.tape.map((r) => (
                <tr key={r.label}>
                  <td style={cell}>{r.label}</td>
                  <td style={{ ...cell, textAlign: "right" }}>{r.value}</td>
                  <td style={{ ...cell, textAlign: "right", fontWeight: 700, color: dirColor(r.dir), whiteSpace: "nowrap" }}>{r.change}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ color: "var(--faint)", fontSize: 13, marginTop: 8 }}>{issue.tapeNote}</p>
      </Section>

      <Section title="What moved and why">
        {issue.stories.map((s) => (
          <p key={s.title} style={{ fontSize: 16, lineHeight: 1.65, margin: "0 0 16px", color: "var(--text)" }}>
            <strong style={{ fontFamily: SERIF, color: "var(--brand)" }}>{s.title}.</strong> {s.body}
          </p>
        ))}
      </Section>

      <Section title="Earnings that mattered">
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={head}>Company</th>
                <th style={head}>Result</th>
                <th style={{ ...head, textAlign: "right" }}>Stock</th>
              </tr>
            </thead>
            <tbody>
              {issue.earnings.map((e) => (
                <tr key={e.company}>
                  <td style={{ ...cell, whiteSpace: "nowrap" }}>
                    <strong>{e.company}</strong>
                    <div style={{ color: "var(--faint)", fontSize: 12.5 }}>{e.when}</div>
                  </td>
                  <td style={cell}>{e.result}</td>
                  <td style={{ ...cell, textAlign: "right", fontWeight: 700, color: dirColor(e.dir) }}>{e.stock}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: 15, lineHeight: 1.6, fontStyle: "italic", marginTop: 12, color: "var(--text)" }}>{issue.earningsNote}</p>
      </Section>

      {/* Club corner: green with white text. */}
      <section style={{ marginTop: 40, background: "var(--wsGreen)", color: "#fff", borderRadius: 14, padding: "24px 28px" }}>
        <h2 style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 24, margin: "0 0 14px", color: "#fff" }}>Club corner</h2>
        {issue.club.map((c) => (
          <p key={c.title} style={{ fontSize: 15.5, lineHeight: 1.6, margin: "0 0 14px" }}>
            <strong>{c.title}.</strong> {c.body}
          </p>
        ))}
        <div className="mono" style={{ fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", marginTop: 18, fontWeight: 700 }}>
          On the calendar
        </div>
        <div style={{ marginTop: 8 }}>
          {issue.meetings.map((m) => (
            <div key={m.when} style={{ display: "flex", flexWrap: "wrap", gap: "4px 16px", padding: "9px 0", borderTop: "1px solid rgba(255,255,255,.3)", fontSize: 15 }}>
              <strong style={{ minWidth: 230 }}>{m.when}</strong>
              <span>{m.what}</span>
            </div>
          ))}
        </div>
      </section>

      <Section title="The week ahead">
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <tbody>
            {issue.weekAhead.map((w) => (
              <tr key={w.day}>
                <td style={{ ...cell, whiteSpace: "nowrap", fontWeight: 700, color: "var(--brand)", width: "22%" }}>{w.day}</td>
                <td style={cell}>
                  {w.items.map((t) => (
                    <div key={t}>{t}</div>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ color: "var(--faint)", fontSize: 13, marginTop: 8 }}>All times Eastern.</p>
      </Section>

      <Section title="Sources">
        <ol style={{ margin: 0, padding: "0 0 0 20px", fontSize: 13.5, lineHeight: 1.6, color: "var(--muted)" }}>
          {issue.sources.map((s) => (
            <li key={s.url}>
              <a href={s.url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--brand)" }}>
                {s.label}
              </a>
            </li>
          ))}
        </ol>
      </Section>

      <footer style={{ marginTop: 36, paddingTop: 18, borderTop: "1px solid var(--line)" }}>
        <div style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 15, color: "var(--text)" }}>{issue.signoff}</div>
        <div style={{ color: "var(--faint)", fontSize: 13, marginTop: 6 }}>{issue.disclaimer}</div>
      </footer>
    </article>
  );
}
