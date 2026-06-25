"use client";

import { useState } from "react";
import { sectors } from "@/data/sectors";

const CLASS_YEARS = ["Freshman", "Sophomore", "Junior", "Senior", "Graduate"];

// Opens the visitor's email client with a prepared message to the club.
// No backend required — just a mailto with the form contents.
export default function ContactForm({ email }: { email: string }) {
  const [name, setName] = useState("");
  const [from, setFrom] = useState("");
  const [year, setYear] = useState("");
  const [sector, setSector] = useState("");
  const [message, setMessage] = useState("");

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const subject = `HWS Investment Club — interest from ${name || "a student"}`;
    const body =
      `Name: ${name}\n` +
      `Email: ${from}\n` +
      `Class: ${year || "—"}\n` +
      `Sector of interest: ${sector || "—"}\n\n` +
      `${message}`;
    window.location.href = `mailto:${email}?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(body)}`;
  };

  const field: React.CSSProperties = {
    width: "100%",
    background: "rgba(255,255,255,0.95)",
    border: "1px solid rgba(255,255,255,0.4)",
    borderRadius: 10,
    padding: "12px 14px",
    fontSize: 15,
    color: "#141414",
    fontFamily: "inherit",
  };

  return (
    <form
      onSubmit={onSubmit}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        maxWidth: 480,
        margin: "clamp(22px,4vh,32px) auto 0",
        textAlign: "left",
      }}
    >
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <input
          style={{ ...field, flex: "1 1 160px" }}
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <input
          style={{ ...field, flex: "1 1 160px" }}
          type="email"
          placeholder="Your email"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          required
        />
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <select
          style={{ ...field, flex: "1 1 160px", color: year ? "#141414" : "#6a6a72" }}
          value={year}
          onChange={(e) => setYear(e.target.value)}
          required
        >
          <option value="" disabled>
            Class year
          </option>
          {CLASS_YEARS.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <select
          style={{ ...field, flex: "1 1 160px", color: sector ? "#141414" : "#6a6a72" }}
          value={sector}
          onChange={(e) => setSector(e.target.value)}
          required
        >
          <option value="" disabled>
            Sector of interest
          </option>
          {sectors.map((s) => (
            <option key={s.slug} value={s.name}>
              {s.name}
            </option>
          ))}
          <option value="Not sure yet">Not sure yet</option>
        </select>
      </div>

      <textarea
        style={{ ...field, minHeight: 110, resize: "vertical" }}
        placeholder="Anything you'd like to add? (optional)"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />
      <button
        type="submit"
        style={{
          alignSelf: "center",
          marginTop: 4,
          background: "#fff",
          color: "var(--wsGreen)",
          fontWeight: 700,
          fontSize: 15,
          padding: "13px 28px",
          borderRadius: 11,
          border: "none",
          cursor: "pointer",
        }}
      >
        Send message
      </button>
    </form>
  );
}
