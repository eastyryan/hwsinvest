#!/usr/bin/env node
// Render one newsletter issue (content/newsletter/<slug>.json) to a
// self-contained, email-style HTML file with inline CSS.
//
// Usage:
//   node scripts/render-newsletter-email.mjs content/newsletter/2026-10-27-issue-05.json out.html
//   add --remote-images to link the shield image by URL instead of embedding it
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const remote = args.includes("--remote-images");
const [input, output] = args.filter((a) => !a.startsWith("--"));
if (!input || !output) {
  console.error("usage: render-newsletter-email.mjs <issue.json> <out.html> [--remote-images]");
  process.exit(1);
}

const d = JSON.parse(fs.readFileSync(input, "utf8"));
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const shieldSrc = remote
  ? "https://raw.githubusercontent.com/eastyryan/hwsinvest/main/public/hws-shield.png"
  : "data:image/png;base64," + fs.readFileSync(path.join(root, "public/hws-shield.png")).toString("base64");

const C = {
  purple: "#4B2E83",
  orange: "#F36F21",
  orangeText: "#B9530F",
  green: "#0F6B37",
  ink: "#100D18",
  muted: "#5B5566",
  paper: "#F7F4EE",
  rule: "#DAD3C6",
  up: "#00693E",
  down: "#B3261E",
};
const SERIF = "Georgia, 'Times New Roman', serif";
const SANS = "Arial, Helvetica, sans-serif";

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const pad = (n) => String(n).padStart(2, "0");
const dirColor = (dir) => (dir === "up" ? C.up : dir === "down" ? C.down : C.ink);

const h2 = (t) => `
<tr><td style="padding:26px 32px 8px 32px;">
  <div style="width:36px;height:3px;background:${C.orange};margin:0 0 8px 0;font-size:0;line-height:0;">&nbsp;</div>
  <h2 style="margin:0;font-family:${SERIF};font-weight:bold;font-size:21px;line-height:1.25;color:${C.purple};">${esc(t)}</h2>
</td></tr>`;

const p = (t, extra = "") =>
  `<p style="margin:0 0 12px 0;font-family:${SANS};font-size:15px;line-height:1.55;color:${C.ink};${extra}">${esc(t)}</p>`;

const th = (t, align = "left") =>
  `<th align="${align}" style="padding:8px 10px;font-family:${SANS};font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:${C.muted};border-bottom:2px solid ${C.purple};">${esc(t)}</th>`;
const td = (t, align = "left", extra = "") =>
  `<td align="${align}" valign="top" style="padding:8px 10px;font-family:${SANS};font-size:14px;line-height:1.45;color:${C.ink};border-bottom:1px solid ${C.rule};${extra}">${t}</td>`;

const inShort = `
<tr><td style="padding:22px 32px 4px 32px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.paper};border-left:4px solid ${C.orange};">
    <tr><td style="padding:16px 18px 6px 18px;">
      <div style="font-family:${SANS};font-size:12px;font-weight:bold;letter-spacing:.08em;text-transform:uppercase;color:${C.orangeText};margin:0 0 10px 0;">In short</div>
      ${d.inShort.map((t) => p(t, "margin:0 0 10px 0;")).join("\n      ")}
    </td></tr>
  </table>
</td></tr>`;

const tape = `${h2("The tape")}
<tr><td style="padding:4px 32px 0 32px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
    <tr>${th("Market")}${th("Oct 26", "right")}${th("2 weeks", "right")}</tr>
    ${d.tape
      .map(
        (r) =>
          `<tr>${td(esc(r.label))}${td(esc(r.value), "right")}${td(esc(r.change), "right", `color:${dirColor(r.dir)};font-weight:bold;white-space:nowrap;`)}</tr>`
      )
      .join("\n    ")}
  </table>
  <p style="margin:8px 0 0 0;font-family:${SANS};font-size:12px;line-height:1.45;color:${C.muted};">${esc(d.tapeNote)}</p>
</td></tr>`;

const stories = `${h2("What moved and why")}
<tr><td style="padding:4px 32px 0 32px;">
  ${d.stories
    .map(
      (s) =>
        `<p style="margin:0 0 14px 0;font-family:${SANS};font-size:15px;line-height:1.55;color:${C.ink};"><strong style="font-family:${SERIF};color:${C.purple};">${esc(s.title)}.</strong> ${esc(s.body)}</p>`
    )
    .join("\n  ")}
</td></tr>`;

const earnings = `${h2("Earnings that mattered")}
<tr><td style="padding:4px 32px 0 32px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
    <tr>${th("Company")}${th("Result")}${th("Stock", "right")}</tr>
    ${d.earnings
      .map(
        (e) =>
          `<tr>${td(`<strong>${esc(e.company)}</strong><br><span style="color:${C.muted};font-size:12px;">${esc(e.when)}</span>`, "left", "white-space:nowrap;")}${td(esc(e.result))}${td(esc(e.stock), "right", `color:${dirColor(e.dir)};font-weight:bold;`)}</tr>`
      )
      .join("\n    ")}
  </table>
  <p style="margin:10px 0 0 0;font-family:${SANS};font-size:14px;line-height:1.5;color:${C.ink};font-style:italic;">${esc(d.earningsNote)}</p>
</td></tr>`;

// Club corner sits on a green band with white text (green pairs with white).
const club = `
<tr><td style="padding:28px 0 0 0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.green};">
    <tr><td style="padding:22px 32px 10px 32px;">
      <h2 style="margin:0 0 12px 0;font-family:${SERIF};font-weight:bold;font-size:21px;color:#FFFFFF;">Club corner</h2>
      ${d.club
        .map(
          (c) =>
            `<p style="margin:0 0 12px 0;font-family:${SANS};font-size:15px;line-height:1.55;color:#FFFFFF;"><strong>${esc(c.title)}.</strong> ${esc(c.body)}</p>`
        )
        .join("\n      ")}
      <div style="font-family:${SANS};font-size:12px;font-weight:bold;letter-spacing:.08em;text-transform:uppercase;color:#FFFFFF;margin:14px 0 6px 0;">On the calendar</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        ${d.meetings
          .map(
            (m) =>
              `<tr><td valign="top" style="padding:6px 12px 6px 0;font-family:${SANS};font-size:14px;line-height:1.45;color:#FFFFFF;font-weight:bold;border-top:1px solid rgba(255,255,255,.35);width:44%;">${esc(m.when)}</td><td valign="top" style="padding:6px 0;font-family:${SANS};font-size:14px;line-height:1.45;color:#FFFFFF;border-top:1px solid rgba(255,255,255,.35);">${esc(m.what)}</td></tr>`
          )
          .join("\n        ")}
      </table>
    </td></tr>
    <tr><td style="padding:0 0 14px 0;font-size:0;line-height:0;">&nbsp;</td></tr>
  </table>
</td></tr>`;

const week = `${h2("The week ahead")}
<tr><td style="padding:4px 32px 0 32px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
    ${d.weekAhead
      .map(
        (w) =>
          `<tr>${td(`<strong style="color:${C.purple};">${esc(w.day)}</strong>`, "left", "white-space:nowrap;width:26%;")}${td(w.items.map(esc).join("<br>"))}</tr>`
      )
      .join("\n    ")}
  </table>
  <p style="margin:8px 0 0 0;font-family:${SANS};font-size:12px;color:${C.muted};">All times Eastern.</p>
</td></tr>`;

const sources = `${h2("Sources")}
<tr><td style="padding:4px 32px 8px 32px;">
  <ol style="margin:0;padding:0 0 0 18px;font-family:${SANS};font-size:12px;line-height:1.5;color:${C.muted};">
    ${d.sources.map((s) => `<li style="margin:0 0 3px 0;"><a href="${esc(s.url)}" style="color:${C.purple};">${esc(s.label)}</a></li>`).join("\n    ")}
  </ol>
</td></tr>`;

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>HWS Investment Club Weekly, Issue ${pad(d.no)}: ${esc(d.title)}</title>
<style>
  @media only screen and (max-width:620px){ .wrap{width:100% !important;} }
</style>
</head>
<body style="margin:0;padding:0;background:${C.paper};">
<div style="display:none;max-height:0;overflow:hidden;">${esc(d.summary)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.paper};">
<tr><td align="center" style="padding:24px 10px;">
<table role="presentation" class="wrap" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background:#FFFFFF;border:1px solid ${C.rule};">

<tr><td align="center" style="padding:26px 32px 18px 32px;background:#FFFFFF;">
  <img src="${shieldSrc}" width="150" height="77" alt="Hobart and William Smith shields" style="display:block;border:0;margin:0 auto 12px auto;">
  <div style="font-family:${SERIF};font-weight:bold;font-size:26px;line-height:1.2;color:${C.purple};">HWS Investment Club Weekly</div>
</td></tr>

<tr><td style="background:${C.purple};padding:20px 32px 22px 32px;">
  <div style="font-family:${SANS};font-size:12px;font-weight:bold;letter-spacing:.08em;text-transform:uppercase;color:${C.orange};">Issue ${pad(d.no)} | ${esc(d.dateLabel)}</div>
  <h1 style="margin:8px 0 6px 0;font-family:${SERIF};font-weight:bold;font-size:25px;line-height:1.25;color:#FFFFFF;">${esc(d.title)}</h1>
  <div style="font-family:${SANS};font-size:13px;color:#E6E0F2;">Covering ${esc(d.window)}</div>
</td></tr>
<tr><td style="background:${C.orange};height:5px;font-size:0;line-height:0;">&nbsp;</td></tr>
${inShort}
${tape}
${stories}
${earnings}
${club}
${week}
${sources}

<tr><td style="padding:18px 0 0 0;"><div style="height:5px;background:${C.orange};font-size:0;line-height:0;">&nbsp;</div></td></tr>
<tr><td align="center" style="background:${C.purple};padding:20px 32px 22px 32px;">
  <div style="font-family:${SERIF};font-weight:bold;font-size:15px;color:#FFFFFF;">${esc(d.signoff)}</div>
  <div style="font-family:${SANS};font-size:12px;line-height:1.5;color:#E6E0F2;margin-top:6px;">${esc(d.disclaimer)}</div>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>
`;

fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true });
fs.writeFileSync(output, html);
console.log(`wrote ${output}`);
