"use client";

import { useState } from "react";
import MiniChart from "./MiniChart";
import { usd, pct, isUp, arrow, sparkline } from "@/lib/format";
import type { Quote } from "@/lib/finnhub";

// Index tile with a small live sparkline. The sparkline is synthesized from the
// quote's previous-close / open / low / high / current so it reflects today's
// movement without needing an intraday series (free-tier friendly). Expands to
// show today's full detail.
export default function IndexCard({
  quote,
  label,
  etf,
  yoy = null,
  history = [],
}: {
  quote: Quote;
  label?: string;
  etf?: string;
  yoy?: { text: string; up: boolean } | null;
  history?: { date: string; value: number }[];
}) {
  const [open, setOpen] = useState(false);
  const up = isUp(quote.dp);
  const color = up ? "var(--up)" : "var(--down)";
  const points = sparkline([quote.pc, quote.o, quote.l, quote.h, quote.c]);
  const hasHistory = history.length > 1;

  const rows: [string, string][] = [
    ["Open", usd(quote.o)],
    ["Prev close", usd(quote.pc)],
    ["Day high", usd(quote.h)],
    ["Day low", usd(quote.l)],
  ];

  return (
    <div className="card card-hover-orange" style={{ padding: 22 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <span style={{ color: "var(--muted)", fontSize: 14, fontWeight: 500 }}>
          {label ?? quote.symbol}
        </span>
        <span className="mono" style={{ fontSize: 11, color: "var(--faint)", letterSpacing: "0.05em" }}>
          {etf ?? quote.symbol}
        </span>
      </div>
      <p className="mono nums" style={{ fontSize: 30, fontWeight: 600, color: "var(--text)", margin: "16px 0 0" }}>
        {usd(quote.c)}
      </p>
      <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "8px 0 14px", flexWrap: "wrap" }}>
        <span className="mono nums" style={{ fontSize: 14, color, fontWeight: 500 }}>
          {arrow(quote.dp)} {usd(Math.abs(quote.d))} ({pct(quote.dp)})
        </span>
        {yoy && (
          <span style={{ fontSize: 12, fontWeight: 700, color: yoy.up ? "var(--up)" : "var(--down)" }}>
            {yoy.up ? "▲" : "▼"} {yoy.text} YoY
          </span>
        )}
      </div>
      {points && (
        <svg viewBox="0 0 100 32" preserveAspectRatio="none" style={{ width: "100%", height: 34, display: "block" }}>
          <polyline
            points={points}
            fill="none"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{
          marginTop: 14,
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "transparent",
          border: "none",
          borderTop: "1px solid var(--lineSoft)",
          paddingTop: 12,
          cursor: "pointer",
          color: "var(--muted)",
          fontSize: 12.5,
          fontWeight: 600,
        }}
      >
        {hasHistory ? "History & detail" : "Today’s detail"}
        <span
          aria-hidden
          style={{
            color: "var(--brand)",
            fontSize: 18,
            lineHeight: 1,
            transform: open ? "rotate(45deg)" : "none",
            transition: "transform 0.18s ease",
          }}
        >
          +
        </span>
      </button>

      {open && (
        <div style={{ marginTop: 12 }}>
          {hasHistory && (
            <div style={{ marginBottom: 4 }}>
              <MiniChart data={history} fmt="index" />
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 16px" }}>
            {rows.map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <span style={{ color: "var(--faint)", fontSize: 12.5 }}>{k}</span>
                <span className="mono nums" style={{ color: "var(--text)", fontSize: 12.5 }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
