"use client";

import { useState } from "react";
import MiniChart from "./MiniChart";
import { formatEcon, type EconFmt } from "@/lib/format";

export type EconSeries = {
  id: string;
  label: string;
  fmt: EconFmt;
  note: string;
  desc: string;
  value: number | null;
  date: string | null;
  yoy: { text: string; up: boolean } | null;
  history: { date: string; value: number }[];
};

export default function EconCard({ s }: { s: EconSeries }) {
  const [open, setOpen] = useState(false);
  const hasHistory = s.history.length > 1;
  const canExpand = hasHistory || !!s.desc;

  return (
    <div className="card" style={{ borderRadius: 13, overflow: "hidden" }}>
      <button
        onClick={() => canExpand && setOpen((v) => !v)}
        aria-expanded={open}
        disabled={!canExpand}
        style={{
          width: "100%",
          textAlign: "left",
          background: "transparent",
          border: "none",
          padding: 20,
          cursor: canExpand ? "pointer" : "default",
          display: "block",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
          <p style={{ color: "var(--muted)", fontSize: 14, margin: 0, lineHeight: 1.3 }}>{s.label}</p>
          {canExpand && (
            <span
              aria-hidden
              style={{
                flexShrink: 0,
                color: "var(--brand)",
                fontSize: 18,
                lineHeight: 1,
                transform: open ? "rotate(45deg)" : "none",
                transition: "transform 0.18s ease",
              }}
            >
              +
            </span>
          )}
        </div>

        <p className="mono nums" style={{ fontSize: 28, fontWeight: 600, color: "var(--text)", margin: "12px 0 0" }}>
          {formatEcon(s.value ?? undefined, s.fmt)}
        </p>

        <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "8px 0 0", flexWrap: "wrap" }}>
          {s.yoy && (
            <span
              style={{
                fontSize: 12.5,
                fontWeight: 700,
                color: s.yoy.up ? "var(--up)" : "var(--down)",
              }}
            >
              {s.yoy.up ? "▲" : "▼"} {s.yoy.text} YoY
            </span>
          )}
          <span className="mono" style={{ fontSize: 11, color: "var(--faint)", letterSpacing: "0.05em" }}>
            {s.date ? `as of ${s.date}` : s.note} · {s.id}
          </span>
        </div>
      </button>

      {open && (
        <div style={{ padding: "0 16px 18px" }}>
          {s.desc && (
            <p
              style={{
                color: "var(--muted)",
                fontSize: 13.5,
                lineHeight: 1.6,
                margin: "0 0 14px",
                paddingTop: 14,
                borderTop: "1px solid var(--lineSoft)",
              }}
            >
              {s.desc}
            </p>
          )}
          {hasHistory && <MiniChart data={s.history} fmt={s.fmt} />}
        </div>
      )}
    </div>
  );
}
