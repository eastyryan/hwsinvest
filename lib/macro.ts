// Server-only same-day sources for series FRED republishes on a lag:
// - Treasury par yields land on FRED a day or two after Treasury posts them.
// - The effective fed funds rate reaches FRED a day after the NY Fed.
// - FRED holds University of Michigan sentiment back a month under license.
// Each helper returns chronological observations in FRED's shape, or [] on any
// failure, and `withNewer` only appends dates past FRED's last one. FRED stays
// the source of history and a broken upstream here changes nothing.

export type Obs = { date: string; value: number };

const REVALIDATE = 900;

export function withNewer(base: Obs[], fresher: Obs[]): Obs[] {
  const last = base[base.length - 1]?.date ?? "";
  return [...base, ...fresher.filter((o) => o.date > last)];
}

async function text(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { next: { revalidate: REVALIDATE } });
    return res.ok ? await res.text() : null;
  } catch {
    return null;
  }
}

export type TreasuryYields = { DGS2: Obs[]; DGS10: Obs[]; DGS30: Obs[]; T10Y2Y: Obs[] };

// Daily par yield curve from home.treasury.gov, the same numbers FRED's DGS*
// series carry. In January the prior year is fetched too so late-December
// days FRED hasn't posted yet aren't skipped.
export async function getTreasuryYields(): Promise<TreasuryYields> {
  const now = new Date();
  const year = now.getUTCFullYear();
  const years = now.getUTCMonth() === 0 ? [year - 1, year] : [year];
  const out: TreasuryYields = { DGS2: [], DGS10: [], DGS30: [], T10Y2Y: [] };

  const csvs = await Promise.all(
    years.map((y) =>
      text(
        "https://home.treasury.gov/resource-center/data-chart-center/interest-rates/" +
          `daily-treasury-rates.csv/${y}/all?type=daily_treasury_yield_curve` +
          `&field_tdr_date_value=${y}&page&_format=csv`
      )
    )
  );

  const rows: { date: string; y2: number; y10: number; y30: number }[] = [];
  for (const csv of csvs) {
    if (!csv) continue;
    const lines = csv.trim().split(/\r?\n/);
    const head = lines[0].split(",").map((h) => h.replace(/"/g, "").trim());
    const i2 = head.indexOf("2 Yr");
    const i10 = head.indexOf("10 Yr");
    const i30 = head.indexOf("30 Yr");
    if (i2 < 0 || i10 < 0 || i30 < 0) continue;
    for (const line of lines.slice(1)) {
      const cells = line.split(",");
      const [mm, dd, yyyy] = cells[0].split("/");
      const y2 = parseFloat(cells[i2]);
      const y10 = parseFloat(cells[i10]);
      const y30 = parseFloat(cells[i30]);
      if (!yyyy || [y2, y10, y30].some(Number.isNaN)) continue;
      rows.push({ date: `${yyyy}-${mm}-${dd}`, y2, y10, y30 });
    }
  }

  rows.sort((a, b) => a.date.localeCompare(b.date));
  for (const r of rows) {
    out.DGS2.push({ date: r.date, value: r.y2 });
    out.DGS10.push({ date: r.date, value: r.y10 });
    out.DGS30.push({ date: r.date, value: r.y30 });
    out.T10Y2Y.push({ date: r.date, value: Math.round((r.y10 - r.y2) * 100) / 100 });
  }
  return out;
}

// Effective federal funds rate from the New York Fed, which publishes each
// business day's rate the following morning.
export async function getEffr(): Promise<Obs[]> {
  const body = await text("https://markets.newyorkfed.org/api/rates/unsecured/effr/last/10.json");
  if (!body) return [];
  try {
    const rates: { effectiveDate: string; percentRate: number }[] = JSON.parse(body).refRates ?? [];
    return rates
      .filter((r) => r.effectiveDate && typeof r.percentRate === "number")
      .map((r) => ({ date: r.effectiveDate, value: r.percentRate }))
      .sort((a, b) => a.date.localeCompare(b.date));
  } catch {
    return [];
  }
}

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

// Index of Consumer Sentiment straight from the University of Michigan survey.
export async function getUmichSentiment(): Promise<Obs[]> {
  const csv = await text("https://www.sca.isr.umich.edu/files/tbmics.csv");
  if (!csv) return [];
  const obs: Obs[] = [];
  for (const line of csv.trim().split(/\r?\n/).slice(-24)) {
    const [month, year, value] = line.split(",");
    const m = MONTHS.indexOf(month?.trim().toLowerCase());
    const v = parseFloat(value);
    if (m < 0 || !/^\d{4}$/.test(year?.trim() ?? "") || Number.isNaN(v)) continue;
    obs.push({ date: `${year.trim()}-${String(m + 1).padStart(2, "0")}-01`, value: v });
  }
  return obs.sort((a, b) => a.date.localeCompare(b.date));
}
