// Current-week economic calendar. Import only from API routes.
// The public feed covers this week. It publishes consensus and the prior print.

import { fetchJson, singleFlight } from "./http";
import { cached } from "./cache";
import { normalizeMacroRows, type MacroPrint } from "./macro-calendar";

const FEED = "https://nfs.faireconomy.media/ff_calendar_thisweek.json";
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

/** Normalized prints for the current week. Throws when the feed is down. */
export async function getMacroCalendar(): Promise<MacroPrint[]> {
  const key = "macro:v1";
  return singleFlight(key, () =>
    cached(key, { ttl: 3_600, tags: ["macro"] }, async () => {
      const rows = await fetchJson<unknown>(FEED, {
        source: "Economic calendar",
        headers: { "User-Agent": UA, Accept: "application/json" },
        timeoutMs: 8_000,
        retries: 1,
        nullOn: [404, 403],
      });
      if (!Array.isArray(rows)) {
        throw new Error("Economic calendar was empty.");
      }
      return normalizeMacroRows(rows);
    })
  );
}
