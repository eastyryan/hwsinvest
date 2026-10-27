#!/usr/bin/env node
// Render one newsletter issue (content/newsletter/<slug>.json) to a minimal,
// email-safe HTML brief with inline CSS. The `sources` field is never rendered;
// it stays in the JSON so every figure can be checked.
//
// Usage:
//   node scripts/render-newsletter-email.mjs content/newsletter/2026-10-27-issue-05.json out.html
import fs from "node:fs";
import path from "node:path";

const [input, output] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
if (!input || !output) {
  console.error("usage: render-newsletter-email.mjs <issue.json> <out.html>");
  process.exit(1);
}
const d = JSON.parse(fs.readFileSync(input, "utf8"));

const INK = "#111111";
const BODY = "#333333";
const GREY = "#6b6b6b";
const RULE = "#e4e4e4";
const ACCENT = "#4b2e83"; // club purple
const ORANGE = "#e87722";
const GREEN = "#00693e";
const SERIF = "Newsreader, 'Iowan Old Style', Charter, 'Palatino Linotype', Palatino, serif";
const MONO = "'IBM Plex Mono', 'SFMono-Regular', Menlo, Consolas, 'Courier New', monospace";
const SHIELDS = "https://raw.githubusercontent.com/eastyryan/hwsinvest/main/public/hws-shield.png";
const SANS = "Inter, -apple-system, 'Segoe UI', 'Helvetica Neue', Helvetica, Arial, sans-serif";

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const pad = (n) => String(n).padStart(2, "0");

const label = (t) =>
  `<div style="font-family:${MONO};font-size:11px;font-weight:500;letter-spacing:.14em;text-transform:uppercase;color:${GREY};margin:0 0 14px 0;">${esc(t)}</div>`;
const rule = `<tr><td style="padding:0 28px;"><div style="border-top:1px solid ${RULE};font-size:0;line-height:0;">&nbsp;</div></td></tr>`;
const row = (inner, pad = "30px 28px") => `<tr><td style="padding:${pad};">${inner}</td></tr>`;
const line = (lead, text, last) =>
  `<p style="margin:0 0 ${last ? 0 : 10}px 0;font-family:${SANS};font-size:15px;line-height:1.55;color:${BODY};"><strong style="color:${INK};">${esc(lead)}</strong>&nbsp; ${esc(text)}</p>`;

const numbers = d.keyNumbers
  .map(
    (k) =>
      `<span style="display:inline-block;margin:0 18px 6px 0;white-space:nowrap;"><span style="color:${GREY};">${esc(k.label)}</span> <strong style="color:${INK};font-weight:600;">${esc(k.value)}</strong> <span style="color:${INK};">${esc(k.change)}</span></span>`
  )
  .join("");

const briefs = d.briefs
  .map(
    (b, i) => `
  <h2 style="margin:0 0 6px 0;font-family:${SERIF};font-weight:600;font-size:21px;line-height:1.25;color:${INK};">${esc(b.headline)}</h2>
  <p style="margin:0 0 ${i === d.briefs.length - 1 ? 0 : 24}px 0;font-family:${SANS};font-size:15px;line-height:1.6;color:${BODY};">${esc(b.body)}</p>`
  )
  .join("");

const club = d.club ?? [];
const meetings = d.meetings ?? [];

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>HWS Investment Club, Issue ${pad(d.no)}: ${esc(d.title)}</title>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&family=Inter:wght@400;600;700&family=Newsreader:opsz,wght@6..72,500;6..72,600&display=swap" rel="stylesheet">
<style>@media only screen and (max-width:620px){ .wrap{width:100% !important;} }</style>
</head>
<body style="margin:0;padding:0;background:#ffffff;">
<div style="display:none;max-height:0;overflow:hidden;">${esc(d.dek)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;">
<tr><td align="center" style="padding:28px 8px 40px 8px;">
<table role="presentation" class="wrap" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background:#ffffff;">

<tr><td style="padding:0;font-size:0;line-height:0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
    <td width="50%" style="background:${ACCENT};height:4px;line-height:4px;font-size:0;">&nbsp;</td>
    <td width="20%" style="background:${ORANGE};height:4px;line-height:4px;font-size:0;">&nbsp;</td>
    <td width="30%" style="background:${GREEN};height:4px;line-height:4px;font-size:0;">&nbsp;</td>
  </tr></table>
</td></tr>
<tr><td style="padding:28px 28px 0 28px;">
  <img src="${SHIELDS}" width="104" alt="HWS Investment Club" style="display:block;width:104px;max-width:104px;height:auto;border:0;margin:0 0 18px 0;">
  <div style="font-family:${SERIF};font-size:36px;line-height:1.05;font-weight:500;letter-spacing:-.02em;color:${INK};">Investment Club Newsletter</div>
</td></tr>
<tr><td style="padding:20px 28px 0 28px;">
  <div style="border-top:1px solid ${RULE};border-bottom:1px solid ${RULE};padding:10px 0;font-family:${MONO};font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:${GREY};">Covering <strong style="color:${INK};font-weight:600;">${esc(d.coverage)}</strong> &nbsp;&middot;&nbsp; Issue ${pad(d.no)}</div>
</td></tr>

${row(`
  <h1 style="margin:0 0 14px 0;font-family:${SERIF};font-weight:600;font-size:30px;line-height:1.16;letter-spacing:-.012em;color:${INK};">${esc(d.title)}</h1>
  <p style="margin:0;font-family:${SANS};font-size:17px;line-height:1.55;color:${BODY};">${esc(d.dek)}</p>`, "30px 28px 22px 28px")}

${row(`
  <div style="font-family:${SANS};font-size:13px;line-height:1.5;">${numbers}</div>
  <div style="font-family:${SANS};font-size:11px;color:${GREY};margin-top:2px;">${esc(d.keyNumbersNote)}</div>`, "0 28px 26px 28px")}
${rule}
${row(briefs)}
${rule}
${row(`${label("Earnings")}
  <p style="margin:0 0 14px 0;font-family:${SANS};font-size:15px;line-height:1.55;color:${INK};">${esc(d.earningsLead)}</p>
  ${d.earnings.map((e, i) => line(e.company, e.line, i === d.earnings.length - 1)).join("\n  ")}`)}
${rule}
${club.length || meetings.length ? `${row(`${label("Club")}
  ${club.map((c) => line(c.title + ".", c.body, false)).join("\n  ")}
  ${club.length && meetings.length ? `<div style="height:8px;font-size:0;line-height:0;">&nbsp;</div>` : ""}
  ${meetings.map((m, i) => line(m.when, m.what, i === meetings.length - 1)).join("\n  ")}`)}
${rule}` : ""}
${row(`${label("The week ahead")}
  ${d.weekAhead.map((w, i) => line(w.day, w.items.join(" "), i === d.weekAhead.length - 1)).join("\n  ")}
  <p style="margin:10px 0 0 0;font-family:${SANS};font-size:12px;color:${GREY};">Times Eastern.</p>`)}
${rule}
${row(`
  ${d.signoff ? `<p style="margin:0;font-family:${SANS};font-size:15px;color:${INK};">${esc(d.signoff)}</p>
  <p style="margin:2px 0 18px 0;font-family:${SANS};font-size:14px;color:${GREY};">HWS Investment Club</p>` : ""}
  <p style="margin:0;font-family:${SANS};font-size:12px;line-height:1.5;color:${GREY};">${esc(d.disclaimer)}</p>`, "24px 28px 0 28px")}

</table>
</td></tr>
</table>
</body>
</html>
`;

fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true });
fs.writeFileSync(output, html);
console.log(`wrote ${output}`);
