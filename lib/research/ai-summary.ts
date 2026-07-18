// Optional Claude-written narrative summary. Active only when
// ANTHROPIC_API_KEY is set; the app falls back to the rule-based insights
// otherwise. Cached in memory per company, keyed by the latest filed period.

import Anthropic from "@anthropic-ai/sdk";
import type { CompanyFinancials, StatementSet } from "./edgar";
import type { Insights } from "./insights";

const cache = new Map<string, { key: string; text: string }>();

function digestSet(set: StatementSet, periods: number): string {
  const lines: string[] = [];
  const cols = set.periods.slice(0, periods);
  lines.push("periods: " + cols.map((p) => p.label).join(", "));
  for (const st of set.statements) {
    for (const line of st.lines) {
      const vals = cols
        .map((p) => {
          const v = line.values[p.key];
          if (v == null) return "-";
          if (line.perShare) return v.toFixed(2);
          return Math.round(v / 1e6).toString();
        })
        .join(", ");
      lines.push(`${line.label}: ${vals}`);
    }
  }
  return lines.join("\n");
}

export async function buildAiSummary(
  fin: CompanyFinancials,
  insights: Insights
): Promise<string | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;

  const latest = fin.quarterly.periods[0]?.key ?? fin.annual.periods[0]?.key ?? "";
  const cacheKey = `${fin.cik}:${latest}`;
  const hit = cache.get(fin.cik);
  if (hit && hit.key === cacheKey) return hit.text;

  try {
    const client = new Anthropic();
    const prompt = `You are a sharp, plain-spoken equity analyst. Using ONLY the filed financial data below for ${fin.name} (${fin.ticker}), write a summary for an individual investor.

Values are USD millions unless marked per-share. Newest period first.

=== ANNUAL (last 5 fiscal years) ===
${digestSet(fin.annual, 5)}

=== QUARTERLY (last 8 quarters) ===
${digestSet(fin.quarterly, 8)}

=== COMPUTED SIGNALS ===
Growing: ${insights.growing.map((i) => i.text).join("; ") || "none"}
Slowing: ${insights.slowing.map((i) => i.text).join("; ") || "none"}
Catalysts: ${insights.catalysts.map((i) => i.text).join("; ") || "none"}

Write 3 short paragraphs, no headers:
1. What kind of business the numbers reveal and how it has evolved (mix shift, scale, margins).
2. What is genuinely growing vs slowing right now, with the specific figures that matter.
3. The catalysts and risks the numbers point to for the next few quarters.

Rules: cite specific numbers and percentages from the data; never invent facts not derivable from it; no investment advice or price targets; no em-dashes; keep it under 220 words total.`;

    const response = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 1024,
      thinking: { type: "adaptive" },
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    if (!text) return null;
    cache.set(fin.cik, { key: cacheKey, text });
    return text;
  } catch {
    return null; // never block the page on the AI call
  }
}
