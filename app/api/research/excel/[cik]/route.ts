import ExcelJS from "exceljs";
import { getCompanyFinancials } from "@/lib/research/edgar";
import type { StatementSet, Statement, CompanyFinancials } from "@/lib/research/edgar";
import { buildRatios } from "@/lib/research/ratios";

export const maxDuration = 60;

const NAVY = "FF1F3864";
const LIGHT_BAND = "FFF2F6FC";

function addStatementSheet(
  wb: ExcelJS.Workbook,
  title: string,
  statement: Statement,
  set: StatementSet,
  quarterly: boolean
) {
  const ws = wb.addWorksheet(title, {
    views: [{ state: "frozen", xSplit: 1, ySplit: 4 }],
  });
  const periods = set.periods;

  // Title block
  ws.mergeCells(1, 1, 1, Math.max(2, periods.length + 1));
  const titleCell = ws.getCell(1, 1);
  titleCell.value = statement.title;
  titleCell.font = { bold: true, size: 14, color: { argb: NAVY } };
  ws.getCell(2, 1).value = quarterly ? "Quarterly" : "Annual";
  ws.getCell(2, 1).font = { italic: true, size: 10, color: { argb: "FF6B7280" } };
  ws.getCell(3, 1).value = "USD in millions except per-share amounts";
  ws.getCell(3, 1).font = { italic: true, size: 9, color: { argb: "FF6B7280" } };

  // Header row
  const headerRow = ws.getRow(4);
  headerRow.getCell(1).value = "Line item";
  periods.forEach((p, i) => {
    headerRow.getCell(i + 2).value = p.label;
  });
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
    cell.alignment = { horizontal: "right" };
    cell.border = { bottom: { style: "medium", color: { argb: NAVY } } };
  });
  headerRow.getCell(1).alignment = { horizontal: "left" };

  // Data rows: value row + change row per line item
  let r = 5;
  for (const line of statement.lines) {
    const row = ws.getRow(r);
    row.getCell(1).value = (line.indent ? "    " : "") + line.label;
    const strong = line.style !== "normal";
    row.getCell(1).font = { bold: strong, size: 10 };

    periods.forEach((p, i) => {
      const v = line.values[p.key];
      const cell = row.getCell(i + 2);
      if (v != null) {
        cell.value = line.perShare || line.shares ? v : v / 1e6;
        cell.numFmt = line.perShare
          ? "#,##0.00"
          : line.shares
            ? "#,##0,,"
            : "#,##0;(#,##0)";
      }
      cell.font = { bold: strong, size: 10 };
      if (strong) {
        cell.border = { top: { style: "thin", color: { argb: NAVY } } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: LIGHT_BAND } };
      }
    });
    if (strong) {
      row.getCell(1).border = { top: { style: "thin", color: { argb: NAVY } } };
      row.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: LIGHT_BAND } };
    }
    r++;

    // % change row
    const chRow = ws.getRow(r);
    chRow.getCell(1).value = (line.indent ? "    " : "  ") + "% change YoY";
    chRow.getCell(1).font = { italic: true, size: 8, color: { argb: "FF9CA3AF" } };
    periods.forEach((p, i) => {
      const v = line.yoy[p.key];
      const cell = chRow.getCell(i + 2);
      if (v != null) {
        cell.value = v;
        cell.numFmt = "+0.0%;[Red]-0.0%";
        cell.font = { italic: true, size: 8, color: { argb: v >= 0 ? "FF15803D" : "FFB91C1C" } };
      }
    });
    r++;

    if (quarterly) {
      const qRow = ws.getRow(r);
      qRow.getCell(1).value = (line.indent ? "    " : "  ") + "% change QoQ";
      qRow.getCell(1).font = { italic: true, size: 8, color: { argb: "FF9CA3AF" } };
      periods.forEach((p, i) => {
        const v = line.qoq[p.key];
        const cell = qRow.getCell(i + 2);
        if (v != null) {
          cell.value = v;
          cell.numFmt = "+0.0%;[Red]-0.0%";
          cell.font = { italic: true, size: 8, color: { argb: v >= 0 ? "FF15803D" : "FFB91C1C" } };
        }
      });
      r++;
    }
  }

  ws.getColumn(1).width = 34;
  for (let c = 2; c <= periods.length + 1; c++) ws.getColumn(c).width = 13;
}

function addRatiosSheet(wb: ExcelJS.Workbook, fin: CompanyFinancials) {
  const ws = wb.addWorksheet("Ratios", {
    views: [{ state: "frozen", xSplit: 1, ySplit: 4 }],
  });
  const ratios = buildRatios(fin, "annual");

  ws.mergeCells(1, 1, 1, Math.max(2, ratios.periods.length + 1));
  ws.getCell(1, 1).value = "Ratios & Returns";
  ws.getCell(1, 1).font = { bold: true, size: 14, color: { argb: NAVY } };
  ws.getCell(2, 1).value = "Annual";
  ws.getCell(2, 1).font = { italic: true, size: 10, color: { argb: "FF6B7280" } };

  const headerRow = ws.getRow(4);
  headerRow.getCell(1).value = "Ratio";
  ratios.periods.forEach((p, i) => {
    headerRow.getCell(i + 2).value = p.label;
  });
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
    cell.alignment = { horizontal: "right" };
  });
  headerRow.getCell(1).alignment = { horizontal: "left" };

  let r = 5;
  for (const line of ratios.lines) {
    const row = ws.getRow(r);
    row.getCell(1).value = line.label;
    row.getCell(1).font = { size: 10 };
    ratios.periods.forEach((p, i) => {
      const v = line.values[p.key];
      const cell = row.getCell(i + 2);
      if (v != null) {
        cell.value = v;
        cell.numFmt = line.format === "pct" ? "0.0%;[Red]-0.0%" : "0.00\\x";
      }
      cell.font = { size: 10 };
    });
    r++;
  }
  ws.getColumn(1).width = 30;
  for (let c = 2; c <= ratios.periods.length + 1; c++) ws.getColumn(c).width = 11;
}

export async function GET(
  req: Request,
  { params }: { params: { cik: string } }
) {
  const { cik } = params;
  const ticker = (new URL(req.url).searchParams.get("ticker") ?? "").toUpperCase();

  try {
    const fin = await getCompanyFinancials(cik, ticker);
    const wb = new ExcelJS.Workbook();
    wb.creator = "HWS Investment Club";
    wb.created = new Date();

    // Cover sheet
    const cover = wb.addWorksheet("Cover");
    cover.getCell("B2").value = fin.name;
    cover.getCell("B2").font = { bold: true, size: 20, color: { argb: NAVY } };
    cover.getCell("B3").value = `${ticker} - Historical Financial Statements`;
    cover.getCell("B3").font = { size: 12, color: { argb: "FF6B7280" } };
    cover.getCell("B5").value = "Source: SEC EDGAR company filings (10-K, 10-Q)";
    cover.getCell("B6").value = `Generated: ${new Date().toISOString().slice(0, 10)}`;
    cover.getCell("B8").value = "Contents";
    cover.getCell("B8").font = { bold: true, size: 12 };
    const contents = [
      "Income (Annual)",
      "Income (Quarterly)",
      "Balance (Annual)",
      "Balance (Quarterly)",
      "Cash Flow (Annual)",
      "Cash Flow (Quarterly)",
      "Ratios",
    ];
    contents.forEach((c, i) => {
      cover.getCell(9 + i, 2).value = c;
    });
    cover.getColumn(2).width = 60;

    const shortNames = ["Income", "Balance", "Cash Flow"];
    fin.annual.statements.forEach((st, i) => {
      addStatementSheet(wb, `${shortNames[i]} (Annual)`, st, fin.annual, false);
    });
    fin.quarterly.statements.forEach((st, i) => {
      addStatementSheet(wb, `${shortNames[i]} (Quarterly)`, st, fin.quarterly, true);
    });
    addRatiosSheet(wb, fin);

    const buffer = await wb.xlsx.writeBuffer();
    return new Response(buffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${ticker || cik}_financials.xlsx"`,
      },
    });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Failed to build workbook" },
      { status: 502 }
    );
  }
}
