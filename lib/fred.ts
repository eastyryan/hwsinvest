// Server-only helpers for FRED (St. Louis Fed). Free key, ~120 req/min.
// https://fred.stlouisfed.org/docs/api/fred/

export type Observation = { date: string; value: string };

const BASE = "https://api.stlouisfed.org/fred";

function key() {
  const k = process.env.FRED_API_KEY;
  if (!k) throw new Error("FRED_API_KEY is not set");
  return k;
}

// Latest single observation for a series, e.g. DGS10. Cached 1h (daily data).
export async function getLatest(
  series: string
): Promise<{ series: string; date: string; value: number } | null> {
  const url =
    `${BASE}/series/observations?series_id=${series}` +
    `&api_key=${key()}&file_type=json&sort_order=desc&limit=1`;
  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) return null;
  const json = await res.json();
  const o: Observation | undefined = json.observations?.[0];
  if (!o || o.value === ".") return null;
  return { series, date: o.date, value: parseFloat(o.value) };
}

// A short recent history for charting a series.
export async function getHistory(
  series: string,
  limit = 60
): Promise<{ date: string; value: number }[]> {
  const url =
    `${BASE}/series/observations?series_id=${series}` +
    `&api_key=${key()}&file_type=json&sort_order=desc&limit=${limit}`;
  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) return [];
  const json = await res.json();
  const obs: Observation[] = json.observations ?? [];
  return obs
    .filter((o) => o.value !== ".")
    .map((o) => ({ date: o.date, value: parseFloat(o.value) }))
    .reverse();
}
