"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export interface RecentEntry {
  ticker: string;
  name: string;
}

const KEY = "hwsRecentCompanies";

export function recordRecent(entry: RecentEntry) {
  try {
    const list: RecentEntry[] = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    const next = [entry, ...list.filter((e) => e.ticker !== entry.ticker)].slice(0, 6);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {}
}

export default function RecentCompanies() {
  const [recent, setRecent] = useState<RecentEntry[]>([]);

  useEffect(() => {
    try {
      setRecent(JSON.parse(localStorage.getItem(KEY) ?? "[]"));
    } catch {}
  }, []);

  if (recent.length === 0) return null;

  return (
    <div style={{ marginTop: 30 }}>
      <p className="rsch-panel-label">Recently viewed</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 9, marginTop: 11 }}>
        {recent.map((e) => (
          <Link
            key={e.ticker}
            href={`/members/research/${e.ticker.toLowerCase()}`}
            className="card card-hover-brand"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 9,
              padding: "7px 12px 7px 8px",
              borderRadius: 10,
              textDecoration: "none",
              color: "var(--text)",
            }}
          >
            <span className="rsch-tag rsch-tag-ghost">{e.ticker}</span>
            <span
              style={{
                fontSize: 13.5,
                color: "var(--muted)",
                maxWidth: 180,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {e.name}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
