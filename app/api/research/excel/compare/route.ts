import {
  getCompanyFinancials,
  InvalidCikError,
  NoFactsError,
  type CompanyFinancials,
} from "@/lib/research/edgar";
import { publicErrorMessage } from "@/lib/research/http";
import { isValidCik, isValidTicker, safeFilename } from "@/lib/research/validate";
import { createGate } from "@/lib/research/concurrency";
import {
  buildCompareWorkbook,
  COMPARE_MAX_COMPANIES,
  type CompareCompanyRef,
} from "@/lib/research/excel-compare";

export const maxDuration = 60;

/**
 * Compare workbooks fetch up to 5 filers and build a wide sheet. Gate more
 * tightly than the single-company route (limit 6) so concurrent multi-ticker
 * builds cannot stack to OOM on a shared Fluid Compute heap.
 */
const buildGate = createGate(3);
const GATE_WAIT_MS = 4_000;

/** Bounded parallel fetch so SEC rate limits aren't burst by 5 at once. */
async function fetchCompanies(
  refs: CompareCompanyRef[]
): Promise<{ ok: CompanyFinancials[]; errors: { ticker: string; error: string }[] }> {
  const results: (CompanyFinancials | null)[] = refs.map(() => null);
  const errors: { ticker: string; error: string }[] = [];
  let next = 0;
  const workers = 2;

  async function worker() {
    for (;;) {
      const i = next++;
      if (i >= refs.length) return;
      const ref = refs[i]!;
      const ticker = ref.ticker.toUpperCase();
      try {
        results[i] = await getCompanyFinancials(ref.cik, ticker);
      } catch (e) {
        if (e instanceof InvalidCikError) {
          errors.push({ ticker, error: "Invalid company id." });
        } else if (e instanceof NoFactsError) {
          errors.push({
            ticker,
            error:
              "No structured XBRL financials (US-GAAP or IFRS companyfacts) for this company.",
          });
        } else {
          console.error(`[excel/compare] fetch failed ticker=${ticker}:`, e);
          errors.push({
            ticker,
            error: publicErrorMessage(e, "Failed to load financials."),
          });
        }
      }
    }
  }

  await Promise.all(Array.from({ length: workers }, () => worker()));
  return {
    ok: results.filter((f): f is CompanyFinancials => f != null),
    errors,
  };
}

function parseBody(raw: unknown): CompareCompanyRef[] | { error: string } {
  if (!raw || typeof raw !== "object") {
    return { error: "Expected JSON body with a companies array." };
  }
  const companies = (raw as { companies?: unknown }).companies;
  if (!Array.isArray(companies) || companies.length === 0) {
    return { error: "Provide companies: [{ cik, ticker }, ...] (1–5)." };
  }
  if (companies.length > COMPARE_MAX_COMPANIES) {
    return {
      error: `At most ${COMPARE_MAX_COMPANIES} companies per export.`,
    };
  }

  const seen = new Set<string>();
  const refs: CompareCompanyRef[] = [];
  for (const item of companies) {
    if (!item || typeof item !== "object") {
      return { error: "Each company must be an object with cik and ticker." };
    }
    const cik = String((item as { cik?: unknown }).cik ?? "").trim();
    const ticker = String((item as { ticker?: unknown }).ticker ?? "")
      .trim()
      .toUpperCase();
    if (!isValidCik(cik)) {
      return { error: `Invalid company id: ${cik || "(empty)"}` };
    }
    if (!isValidTicker(ticker)) {
      return { error: `Invalid ticker: ${ticker || "(empty)"}` };
    }
    const key = cik.replace(/^0+/, "") || "0";
    if (seen.has(key)) continue;
    seen.add(key);
    refs.push({ cik, ticker });
  }
  if (refs.length === 0) {
    return { error: "Provide at least one valid company." };
  }
  return refs;
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = parseBody(body);
  if ("error" in parsed) {
    return Response.json({ error: parsed.error }, { status: 400 });
  }
  const refs = parsed;

  const release = await buildGate.acquire(GATE_WAIT_MS);
  if (!release) {
    return Response.json(
      {
        error:
          "Too many workbooks are being generated right now. Try again shortly.",
      },
      { status: 503, headers: { "Retry-After": "10" } }
    );
  }

  try {
    const { ok, errors } = await fetchCompanies(refs);
    if (ok.length === 0) {
      return Response.json(
        {
          error: "Could not load financials for any of the requested companies.",
          failures: errors,
        },
        { status: 502 }
      );
    }

    const wb = buildCompareWorkbook(ok);
    const buffer = await wb.xlsx.writeBuffer();

    const tickers = ok.map((c) => c.ticker).join("_");
    const partial = errors.length > 0;

    return new Response(buffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${safeFilename(
          `compare_${tickers}`
        )}.xlsx"`,
        // Surface partial failures without failing the whole download.
        ...(partial
          ? {
              "X-Compare-Partial": "1",
              "X-Compare-Failures": errors.map((e) => e.ticker).join(","),
            }
          : {}),
      },
    });
  } catch (e) {
    console.error("[excel/compare] failed:", e);
    return Response.json(
      { error: publicErrorMessage(e, "Failed to build comparison workbook.") },
      { status: 502 }
    );
  } finally {
    release();
  }
}
