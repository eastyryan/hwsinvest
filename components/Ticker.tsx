"use client";

import { useEffect, useState } from "react";
import { arrow } from "@/lib/format";

type Q = { symbol: string; c: number; dp: number };

const SYMBOLS = [
  "SPY",
  "QQQ",
  "DIA",
  "IWM",
  "AAPL",
  "MSFT",
  "NVDA",
  "GOOGL",
  "META",
  "JPM",
  "XLE",
  "XLF",
];

export default function Ticker({ topBorder = true }: { topBorder?: boolean }) {
  const [quotes, setQuotes] = useState<Q[]>([]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const res = await fetch(`/api/quote?symbols=${SYMBOLS.join(",")}`);
        const json = await res.json();
        if (active && json.quotes) setQuotes(json.quotes);
      } catch {
        /* ignore */
      }
    };
    load();
    const id = setInterval(load, 60000); // refresh each minute
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  const wrap: React.CSSProperties = {
    position: "relative",
    overflow: "hidden",
    borderBottom: "1px solid var(--line)",
    borderTop: topBorder ? "1px solid var(--line)" : undefined,
    background: "var(--bgDeep)",
  };

  if (quotes.length === 0) {
    return (
      <div style={{ ...wrap, padding: "11px 0", textAlign: "center" }}>
        <span className="mono" style={{ fontSize: "13.5px", color: "var(--faint)" }}>
          Loading market data…
        </span>
      </div>
    );
  }

  const row = [...quotes, ...quotes]; // duplicate for a seamless loop

  return (
    <div style={wrap}>
      <div
        style={{
          display: "flex",
          width: "max-content",
          animation: "hws-marquee 48s linear infinite",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.animationPlayState = "paused")}
        onMouseLeave={(e) => (e.currentTarget.style.animationPlayState = "running")}
      >
        {row.map((q, i) => {
          const up = q.dp >= 0;
          return (
            <span
              key={i}
              className="mono"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 9,
                padding: "11px 22px",
                borderRight: "1px solid var(--lineSoft)",
                whiteSpace: "nowrap",
                fontSize: "13.5px",
              }}
            >
              <span style={{ fontWeight: 600, color: "var(--text)" }}>{q.symbol}</span>
              <span style={{ color: "var(--muted)" }}>{q.c?.toFixed(2)}</span>
              <span style={{ color: up ? "var(--up)" : "var(--down)", fontWeight: 500 }}>
                {arrow(q.dp)} {q.dp >= 0 ? "+" : ""}
                {q.dp?.toFixed(2)}%
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
