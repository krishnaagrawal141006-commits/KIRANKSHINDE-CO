import fs from "node:fs/promises";
import { pathToFileURL } from "node:url";
const { FileBlob, SpreadsheetFile } = await import(pathToFileURL("C:/Program Files/WindowsApps/OpenAI.CodexPrimaryRuntime.v26-1112-737-0_26.1112.737.0_x64__3k8sg7r9htsxt/dependencies/node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs").href);
const path = "E:/kiran k shinde & co/outputs/2026-11-15-groq-api-cost/groq-api-cost-sheet.xlsx";
const wb = await SpreadsheetFile.importXlsx(await FileBlob.load(path));
const ws = wb.worksheets.getItem("Groq API Cost");
const font = "Aptos";

ws.getRange("B5").values = [[100000]];
ws.getRange("A10").values = [["INVOICE AI COST (based on inputs above)"]];
ws.getRange("A15").values = [["At 100,000 invoices × 2,000 input tokens + 200 output tokens each: GPT OSS 20B ≈ $21/batch (about ₹1,890 at the editable planning FX rate); GPT OSS 120B ≈ $42/batch (about ₹3,780)."]];
ws.getRange("A22:I22").merge();
ws.getRange("A22").values = [["OTHER AI WORKFLOWS — edit green monthly volumes and token assumptions"]];
ws.getRange("A23:I23").values = [["Workflow", "Items / month", "Input tokens / item", "Output tokens / item", "Monthly input tokens", "Monthly output tokens", "20B cost (US$)", "120B cost (US$)", "Notes / estimate basis"]];
ws.getRange("A24:I30").values = [
  ["Bank narration categorisation", 0, 100, 30, null, null, null, null, "Per transaction; rules can handle clear narrations"],
  ["GST mismatch explanation", 0, 1200, 250, null, null, null, null, "Per mismatch explanation; matching itself can be rules-based"],
  ["Unclear reconciliation suggestion", 0, 250, 80, null, null, null, null, "Per candidate match"],
  ["Notice / letter summary", 0, 5000, 700, null, null, null, null, "Per notice; OCR for scans is separate"],
  ["Audit exception explanation", 0, 500, 150, null, null, null, null, "Per flagged exception"],
  ["MIS report summary", 0, 3000, 500, null, null, null, null, "Per generated report summary"],
  ["Client reminder draft", 0, 300, 100, null, null, null, null, "Per reminder draft"]
];
ws.getRange("E24").formulas = [["=B24*C24"]]; ws.getRange("E24:E30").fillDown();
ws.getRange("F24").formulas = [["=B24*D24"]]; ws.getRange("F24:F30").fillDown();
ws.getRange("G24").formulas = [["=E24/1000000*$B$11+F24/1000000*$C$11"]]; ws.getRange("G24:G30").fillDown();
ws.getRange("H24").formulas = [["=E24/1000000*$B$12+F24/1000000*$C$12"]]; ws.getRange("H24:H30").fillDown();
ws.getRange("A32:D32").merge();
ws.getRange("A32").values = [["TOTAL API ESTIMATE — 100,000 invoices + additional workflows above"]];
ws.getRange("E32").formulas = [["=SUM(E24:E30)+$D$11"]];
ws.getRange("F32").formulas = [["=SUM(F24:F30)+$E$11"]];
ws.getRange("G32").formulas = [["=SUM(G24:G30)+$H$11"]];
ws.getRange("H32").formulas = [["=SUM(H24:H30)+$H$12"]];
ws.getRange("I32").formulas = [["=G32*$B$8"]];
ws.getRange("I31").values = [["20B total (₹)"]];
ws.getRange("A34:I34").merge();
ws.getRange("A34").values = [["Additional workflow volumes are set to zero until you enter your actual monthly counts. Token/item figures are starter estimates—replace them with observed usage after a pilot. The 100,000 invoice batch is the volume you asked about; it is not assumed to recur every month."]];

ws.getRange("A10:I10").format = { fill: "#176B54", font: { name: font, size: 10, bold: true, color: "#FFFFFF" } };
ws.getRange("A15:I15").format = { wrapText: true, verticalAlignment: "center", font: { name: font, size: 10, color: "#1F2937" } };
ws.getRange("A15:I15").format.rowHeight = 32;
ws.getRange("A22:I22").format = { fill: "#123B32", font: { name: font, size: 11, bold: true, color: "#FFFFFF" } };
ws.getRange("A23:I23").format = { fill: "#176B54", font: { name: font, size: 9, bold: true, color: "#FFFFFF" }, wrapText: true, verticalAlignment: "center" };
ws.getRange("A23:I23").format.rowHeight = 35;
ws.getRange("A24:I30").format = { fill: "#F8FAFC", font: { name: font, size: 9, color: "#1F2937" }, wrapText: true, verticalAlignment: "center" };
ws.getRange("B24:D30").format = { fill: "#E8F5E9", font: { name: font, size: 9, color: "#166534", bold: true } };
ws.getRange("A24:I30").format.rowHeight = 32;
ws.getRange("A32:I32").format = { fill: "#EAF4EF", font: { name: font, size: 10, bold: true, color: "#123B32" }, wrapText: true, verticalAlignment: "center" };
ws.getRange("A32:I32").format.rowHeight = 34;
ws.getRange("A34:I34").format = { wrapText: true, verticalAlignment: "center", font: { name: font, size: 9, color: "#64748B" } };
ws.getRange("A34:I34").format.rowHeight = 38;
ws.getRange("B24:C30").format.numberFormat = "#,##0";
ws.getRange("D24:D30").format.numberFormat = "#,##0";
ws.getRange("E24:F32").format.numberFormat = "#,##0";
ws.getRange("G24:H32").format.numberFormat = "$0.0000";
ws.getRange("I32").format.numberFormat = "₹#,##0.00";


ws.getRange("I31").format = { fill: "#EAF4EF", font: { name: font, size: 9, bold: true, color: "#176B54" } };

ws.getRange("A:A").format.columnWidth = 34;
ws.getRange("B:B").format.columnWidth = 16;
ws.getRange("C:D").format.columnWidth = 20;
ws.getRange("E:F").format.columnWidth = 20;
ws.getRange("G:H").format.columnWidth = 18;
ws.getRange("I:I").format.columnWidth = 46;

wb.recalculate();
const checks = await wb.inspect({ kind: "region", sheetId: "Groq API Cost", range: "A22:I34", maxChars: 5000 });
console.log(checks.ndjson);
const errors = await wb.inspect({ kind: "match", searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!", options: { useRegex: true, maxResults: 100 }, summary: "formula error scan" });
console.log(errors.ndjson);
const preview = await wb.render({ sheetName: "Groq API Cost", range: "A1:I34", scale: 1, format: "png" });
await fs.writeFile("E:/kiran k shinde & co/outputs/2026-11-15-groq-api-cost/groq-api-cost-preview.png", new Uint8Array(await preview.arrayBuffer()));
const output = await SpreadsheetFile.exportXlsx(wb);
await output.save(path);


