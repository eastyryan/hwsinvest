// Turn an uploaded Google Form attendance file (CSV or Excel) into the plain
// text the attendance matcher already understands: one CSV row per response.
//
// Excel parsing uses exceljs (Node-friendly). Call sheetFileToText from the
// browser for CSV; for .xlsx/.xls POST the file to /api/club/attendance/sheet.

function cellText(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    const hh = String(value.getHours()).padStart(2, "0");
    const mm = String(value.getMinutes()).padStart(2, "0");
    const ss = String(value.getSeconds()).padStart(2, "0");
    return `${y}/${m}/${d} ${hh}:${mm}:${ss}`;
  }
  if (typeof value === "number") return String(value);
  return String(value).trim();
}

function csvEscape(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function isExcelAttendanceFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return (
    name.endsWith(".xlsx") ||
    name.endsWith(".xls") ||
    file.type.includes("spreadsheet") ||
    file.type === "application/vnd.ms-excel"
  );
}

/** Server-side: workbook bytes → CSV text (Timestamp, Full Name, Class Year…). */
export async function workbookToCsvText(buffer: ArrayBuffer): Promise<string> {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error("That spreadsheet has no sheets.");

  const lines: string[] = [];
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const values = (row.values as unknown[])
      .slice(1) // exceljs is 1-indexed; index 0 is unused
      .map((v) => cellText(v));
    while (values.length > 0 && !values[values.length - 1]) values.pop();
    if (values.length === 0) return;
    lines.push(values.map(csvEscape).join(","));
  });

  if (lines.length === 0) throw new Error("That spreadsheet looks empty.");
  return lines.join("\n");
}

/**
 * Browser helper: CSV is read locally; Excel is converted via the admin API
 * so exceljs stays off the client bundle.
 */
export async function sheetFileToText(file: File): Promise<string> {
  if (!isExcelAttendanceFile(file)) {
    return file.text();
  }

  const body = new FormData();
  body.append("file", file);
  const res = await fetch("/api/club/attendance/sheet", { method: "POST", body });
  const json = (await res.json().catch(() => ({}))) as { text?: string; error?: string };
  if (!res.ok) {
    throw new Error(json.error || `Could not read spreadsheet (${res.status})`);
  }
  if (typeof json.text !== "string" || !json.text.trim()) {
    throw new Error("That spreadsheet looked empty.");
  }
  return json.text;
}
