import { getMacroCalendar } from "@/lib/research/macro-server";
import { highImportanceUsd } from "@/lib/research/macro-calendar";
import { publicErrorMessage } from "@/lib/research/http";

export const dynamic = "force-dynamic";
export const maxDuration = 20;

export async function GET() {
  try {
    const events = highImportanceUsd(await getMacroCalendar());
    return Response.json({
      events,
      coverage: "this-week",
      note: "High-importance US releases for the current week. Expectation is the published consensus. Last is the prior release.",
    });
  } catch (e) {
    console.error("[calendar]", e);
    return Response.json(
      { error: publicErrorMessage(e, "Could not load the economic calendar.") },
      { status: 502 }
    );
  }
}
