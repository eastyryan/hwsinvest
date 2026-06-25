"use client";

import Link from "next/link";
import { useState } from "react";
import { usd, pct, isUp, arrow } from "@/lib/format";
import type { Quote } from "@/lib/finnhub";
import type { Sector } from "@/data/sectors";

export default function SectorCard({ sector, quote }: { sector: Sector; quote?: Quote }) {
  const [open, setOpen] = useState(false);
  const up = isUp(quote?.dp);

  const rows: [string, string][] = quote
    ? [
        ["Open", usd(quote.o)],
        ["Prev close", usd(quote.pc)],
        ["Day high", usd(quote.h)],
        ["Day low", usd(quote.l)],
      ]
    : [];

  return (
    <div className="card card-hover-orange" style={{ padding: 22 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <span style={{ fontSize: 17, fontWeight: 600, color: "var(--text)" }}>{sector.name}</span>
        <span
          className="mono"
          style={{
            fontSize: 11,
            color: "var(--brand)",
            background: "var(--card2)",
            border: "1px solid var(--line)",
            padding: "3px 8px",
            borderRadius: 6,
            letterSpacing: "0.05em",
          }}
        >
          {sector.etf}
        </span>
      </div>

      {quote && (
        <p className="mono" style={{ fontSize: 14, color: up ? "var(--up)" : "var(--down)", margin: "11px 0 0", fontWeight: 500 }}>
          {usd(quote.c)} · {arrow(quote.dp)} {pct(quote.dp)}
        </p>
      )}

      <p style={{ color: "var(--muted)", fontSize: 14, lineHeight: 1.55, margin: "11px 0 0" }}>
        {sector.blurb}
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 14 }}>
        {sector.holdings.map((h) => (
          <span
            key={h}
            className="mono"
            style={{
              fontSize: "11.5px",
              color: "var(--muted)",
              background: "var(--card2)",
              border: "1px solid var(--lineSoft)",
              padding: "3px 8px",
              borderRadius: 6,
            }}
          >
            {h}
          </span>
        ))}
      </div>

      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{
          marginTop: 16,
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
        Today&rsquo;s detail
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
          {rows.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 16px" }}>
              {rows.map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ color: "var(--faint)", fontSize: 12.5 }}>{k}</span>
                  <span className="mono nums" style={{ color: "var(--text)", fontSize: 12.5 }}>{v}</span>
                </div>
              ))}
            </div>
          )}
          <Link
            href={`/markets/${sector.slug}`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              marginTop: rows.length > 0 ? 14 : 0,
              color: "var(--orangeText)",
              fontWeight: 600,
              fontSize: 13.5,
              textDecoration: "none",
            }}
          >
            View sector &amp; holdings <span style={{ fontSize: 15 }}>→</span>
          </Link>
        </div>
      )}
    </div>
  );
}
