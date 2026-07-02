import ExcelJS from "exceljs";
import type { ExportViewModel } from "../export-view-model";

export const XLSX_SHEETS = {
  requirements: "需求矩阵",
  citations: "引用证据清单",
  assumptions: "假设与审核提示"
} as const;

// Fills the fixed-structure V0 xlsx template: sheet layouts, headers and
// column widths come from the template file; this filler only appends rows.
export async function fillXlsxTemplate(
  templateContent: Buffer,
  viewModel: ExportViewModel
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bufferToArrayBuffer(templateContent));

  const requirements = requireSheet(workbook, XLSX_SHEETS.requirements);
  for (const section of viewModel.sections) {
    requirements.addRow([section.index, section.title, section.body, section.traceNote]);
  }

  const citations = requireSheet(workbook, XLSX_SHEETS.citations);
  for (const citation of viewModel.citations) {
    citations.addRow([
      citation.index,
      citation.title,
      citation.source,
      citation.location,
      citation.chunkId,
      citation.documentId
    ]);
  }

  const assumptions = requireSheet(workbook, XLSX_SHEETS.assumptions);
  assumptions.addRow([viewModel.reviewNotice]);
  for (const assumption of viewModel.assumptions) {
    assumptions.addRow([assumption]);
  }

  const output = await workbook.xlsx.writeBuffer();
  return Buffer.from(output);
}

function requireSheet(workbook: ExcelJS.Workbook, name: string): ExcelJS.Worksheet {
  const sheet = workbook.getWorksheet(name);
  if (!sheet) {
    throw new Error(`xlsx template is missing required worksheet: ${name}`);
  }
  return sheet;
}

function bufferToArrayBuffer(buffer: Buffer): ArrayBuffer {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
}
