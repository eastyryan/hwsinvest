"use client";

import { useEffect, useState } from "react";

type Theme = "dark" | "light";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const current =
      (document.documentElement.getAttribute("data-theme") as Theme) || "dark";
    setTheme(current);
  }, []);

  const apply = (t: Theme) => {
    setTheme(t);
    document.documentElement.setAttribute("data-theme", t);
    try {
      localStorage.setItem("hws-theme", t);
    } catch {
      /* ignore */
    }
  };

  const seg = (active: boolean): React.CSSProperties => ({
    appearance: "none",
    border: "none",
    cursor: "pointer",
    fontFamily: "var(--font-mono), monospace",
    fontSize: "12.5px",
    fontWeight: 500,
    letterSpacing: "0.03em",
    padding: "6px 13px",
    borderRadius: "7px",
    transition: "all 0.16s",
    background: active ? "var(--brandSolid)" : "transparent",
    color: active ? "#fff" : "var(--muted)",
  });

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        background: "var(--card2)",
        border: "1px solid var(--line)",
        borderRadius: "9px",
        padding: "3px",
        gap: "2px",
      }}
    >
      <button onClick={() => apply("dark")} style={seg(theme === "dark")}>
        Dark
      </button>
      <button onClick={() => apply("light")} style={seg(theme === "light")}>
        Light
      </button>
    </div>
  );
}
