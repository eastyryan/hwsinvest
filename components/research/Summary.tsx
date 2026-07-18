"use client";

import type { Insights, Insight } from "@/lib/research/insights";

function Group({
  title,
  items,
  accent,
}: {
  title: string;
  items: Insight[];
  accent: string;
}) {
  return (
    <div
      style={{
        background: "var(--card2)",
        border: "1px solid var(--line)",
        borderRadius: 14,
        padding: 20,
      }}
    >
      <h3
        style={{
          margin: 0,
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: accent,
        }}
      >
        {title}
      </h3>
      {items.length === 0 ? (
        <p style={{ marginTop: 12, fontSize: 14, color: "var(--faint)" }}>
          Nothing notable in recent quarters.
        </p>
      ) : (
        <ul style={{ listStyle: "none", margin: "14px 0 0", padding: 0 }}>
          {items.map((ins, i) => (
            <li key={i} style={{ marginTop: i === 0 ? 0 : 13 }}>
              <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.5 }}>{ins.text}</p>
              {ins.detail && (
                <p
                  className="mono"
                  style={{
                    margin: "3px 0 0",
                    fontSize: 12,
                    lineHeight: 1.45,
                    color: "var(--faint)",
                  }}
                >
                  {ins.detail}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function Summary({
  insights,
  aiSummary,
}: {
  insights: Insights;
  aiSummary?: string | null;
}) {
  return (
    <section>
      {aiSummary && (
        <div style={{ marginBottom: 40 }}>
          <h2 className="h-sub" style={{ fontSize: 22 }}>
            Analyst read
          </h2>
          <p className="rsch-note" style={{ marginTop: 5 }}>
            Written by Claude from the filed numbers below. Not investment advice.
          </p>
          <div
            className="card"
            style={{
              marginTop: 14,
              maxWidth: "76ch",
              padding: 22,
              background: "var(--card2)",
            }}
          >
            {aiSummary.split(/\n\n+/).map((para, i) => (
              <p
                key={i}
                style={{
                  margin: i === 0 ? 0 : "14px 0 0",
                  fontSize: 15.5,
                  lineHeight: 1.65,
                }}
              >
                {para}
              </p>
            ))}
          </div>
        </div>
      )}
      <div>
        <h2 className="h-sub" style={{ fontSize: 22 }}>
          What the numbers say
        </h2>
        <p className="rsch-note" style={{ marginTop: 5 }}>
          Computed from the last few quarters of filings. Not investment advice.
        </p>
        <div
          style={{
            marginTop: 18,
            display: "grid",
            gap: 16,
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          }}
        >
          <Group title="Growing" items={insights.growing} accent="var(--up)" />
          <Group title="Slowing" items={insights.slowing} accent="var(--down)" />
          <Group
            title="Catalysts to watch"
            items={insights.catalysts}
            accent="var(--brand)"
          />
        </div>
      </div>
    </section>
  );
}
