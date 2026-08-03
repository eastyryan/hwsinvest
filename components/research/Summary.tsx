"use client";

import type { Insights, Insight } from "@/lib/research/insights";
import type { Narrative } from "@/lib/research/narrative";

export interface AiSummary {
  business: string;
  momentum: string;
  catalysts: string;
}

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
  narrative,
  summary,
  loading = false,
}: {
  insights: Insights;
  /** Deterministic read, computed from the filings. Always present. */
  narrative?: Narrative | null;
  /** Optional Claude version; supersedes the deterministic one when present. */
  summary?: AiSummary | null;
  loading?: boolean;
}) {
  // The deterministic narrative renders immediately and needs no API key. The
  // model-written one replaces it only once it actually arrives, so there is no
  // empty state and no waiting on a network call for the default experience.
  const shown = summary ?? narrative ?? null;
  const isAi = summary != null;

  return (
    <section>
      {shown && (
        <div style={{ marginBottom: 40 }}>
          <div
            style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 12 }}
          >
            <h2 className="h-sub" style={{ fontSize: 22 }}>
              Analyst read
            </h2>
            {loading && !isAi && (
              <span
                role="status"
                aria-live="polite"
                style={{ fontSize: 12.5, color: "var(--faint)" }}
              >
                Refining with Claude&hellip;
              </span>
            )}
          </div>
          <p className="rsch-note" style={{ marginTop: 5 }}>
            {isAi
              ? "Written by Claude from the filed numbers below. Not investment advice."
              : "Computed directly from the filed numbers below. Not investment advice."}
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
            {[shown.business, shown.momentum, shown.catalysts].map((para, i) => (
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
