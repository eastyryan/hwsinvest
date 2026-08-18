// Optional Claude-written narrative summary. Active only when ANTHROPIC_API_KEY
// is set; the app falls back to the rule-based insights otherwise.
//
// This runs on its own endpoint, not on the financials request path — the model
// call takes seconds and previously blocked the statements, charts, and ratios
// from rendering at all.

import Anthropic from "@anthropic-ai/sdk";
import type { CompanyFinancials, StatementSet } from "./edgar";
import type { Insights } from "./insights";
import { cached } from "./cache";
import { singleFlight } from "./http";

export interface AiSummary {
  business: string;
  momentum: string;
  catalysts: string;
}

/**
 * Structured output instead of free prose.
 *
 * The UI used to split the response on blank lines and render each chunk as a
 * paragraph, so any deviation — a heading, a bullet list, four paragraphs
 * instead of three — silently degraded the layout. Naming the three fields
 * makes the contract explicit and lets each render into its own slot.
 */
const SUMMARY_SCHEMA = {
  type: "object" as const,
  properties: {
    business: {
      type: "string" as const,
      description:
        "What kind of business the numbers reveal and how it has evolved: mix shift, scale, margin structure. 2-4 sentences.",
    },
    momentum: {
      type: "string" as const,
      description:
        "What is genuinely growing versus slowing right now, citing the specific figures that matter. 2-4 sentences.",
    },
    catalysts: {
      type: "string" as const,
      description:
        "The catalysts and risks the numbers point to for the next few quarters. 2-4 sentences.",
    },
  },
  required: ["business", "momentum", "catalysts"],
  additionalProperties: false,
};

const SYSTEM_PROMPT = `You are a sharp, plain-spoken equity analyst writing for an individual investor.

Ground rules:
- Use ONLY the filed financial data provided in the user message. Never introduce outside facts, news, competitor comparisons, or anything you happen to know about the company.
- Cite specific numbers and percentages from the data.
- If the data is too sparse to support a claim, say what is missing rather than speculating.
- Never give investment advice, recommendations, or price targets. Describe what the numbers show, not what the reader should do.
- Do not use em-dashes.
- Keep the three sections to roughly 70 words each.`;

/**
 * Render a statement set for the model.
 *
 * Values are labeled per line rather than blanket-scaled. The previous version
 * divided everything by 1e6 unless flagged per-share, which silently mangled
 * share counts and any non-currency line into meaningless magnitudes that the
 * model then cited as fact.
 */
function digestSet(set: StatementSet, periods: number, currency: string): string {
  const out: string[] = [];
  const cols = set.periods.slice(0, periods);
  out.push(`periods (newest first): ${cols.map((p) => p.label).join(", ")}`);

  for (const st of set.statements) {
    out.push(`\n## ${st.title}`);
    for (const line of st.lines) {
      const vals = cols.map((p) => {
        const v = line.values[p.key];
        if (v == null) return "-";
        if (line.perShare) return v.toFixed(2);
        if (line.shares) return `${(v / 1e6).toFixed(1)}M shares`;
        return `${Math.round(v / 1e6)}`;
      });
      const unit = line.perShare
        ? `${currency}/share`
        : line.shares
          ? "count"
          : `${currency}M`;
      out.push(`${line.label} (${unit}): ${vals.join(", ")}`);
    }
  }
  return out.join("\n");
}

function buildUserPrompt(fin: CompanyFinancials, insights: Insights): string {
  return `Company: ${fin.name} (${fin.ticker})
Reporting currency: ${fin.currency}

=== ANNUAL (last 5 fiscal years) ===
${digestSet(fin.annual, 5, fin.currency)}

=== QUARTERLY (last 8 quarters) ===
${digestSet(fin.quarterly, 8, fin.currency)}

=== COMPUTED SIGNALS (deterministic, derived from the same filings) ===
Growing: ${insights.growing.map((i) => i.text).join("; ") || "none"}
Slowing: ${insights.slowing.map((i) => i.text).join("; ") || "none"}
Catalysts: ${insights.catalysts.map((i) => i.text).join("; ") || "none"}

These computed signals are already shown to the reader alongside your summary. Do not contradict them. Add the interpretation and connective reasoning they lack.`;
}

async function generate(
  fin: CompanyFinancials,
  insights: Insights
): Promise<AiSummary | null> {
  // The SDK defaults to a 10-minute timeout with 2 retries, which is 30x this
  // route's own maxDuration: the platform would kill the function long before
  // the SDK gave up, so the graceful null-summary path could never run.
  const client = new Anthropic({ timeout: 20_000, maxRetries: 1 });

  const response = await client.messages.create({
    model: "claude-opus-4-8",
    // Thinking tokens count against max_tokens. The old budget of 1024 was
    // shared with adaptive thinking, so a normal generation could exhaust it
    // and return truncated or empty text that was rendered as if complete.
    max_tokens: 8000,
    thinking: { type: "adaptive" },
    // The visible output is ~200 words from pre-digested data; `high` (the
    // default) buys nothing here and costs latency on a user-facing path.
    output_config: {
      effort: "low",
      format: { type: "json_schema", schema: SUMMARY_SCHEMA },
    },
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildUserPrompt(fin, insights) }],
  });

  if (response.stop_reason === "refusal") {
    console.warn(`[ai-summary] refused for ${fin.ticker}`, response.stop_details);
    return null;
  }
  if (response.stop_reason === "max_tokens") {
    // Would otherwise render a half-finished summary as a complete one.
    console.warn(`[ai-summary] hit max_tokens for ${fin.ticker}; discarding`);
    return null;
  }

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
  if (!text) return null;

  const parsed = JSON.parse(text) as AiSummary;
  if (!parsed.business || !parsed.momentum || !parsed.catalysts) return null;
  return parsed;
}

export async function buildAiSummary(
  fin: CompanyFinancials,
  insights: Insights
): Promise<AiSummary | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;

  // Key on the latest filed period so a new filing invalidates naturally.
  const latest =
    fin.quarterly.periods[0]?.key ?? fin.annual.periods[0]?.key ?? "none";
  const key = `aisummary:v2:${fin.cik}:${latest}`;

  try {
    // singleFlight matters more here than anywhere else: without it, N
    // concurrent cold requests for one company each fire their own Opus call.
    return await singleFlight(key, () =>
      cached(key, { ttl: 604_800, tags: ["ai-summary", `cik:${fin.cik}`] }, () =>
        generate(fin, insights)
      )
    );
  } catch (e) {
    // Previously a bare `catch { return null }`: a bad key, a 429, or an
    // overload made the feature silently vanish with no way to detect it.
    console.error(`[ai-summary] generation failed for ${fin.ticker}:`, e);
    return null;
  }
}
