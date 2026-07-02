// Generates the V0 temporary export templates (docx/pptx/xlsx) with
// docxtemplater-style {tags}. These are placeholder templates only —
// swap in the real company templates under the same file names without
// touching renderer code. Runtime rendering never uses these libraries;
// they exist solely to produce valid OOXML template files.
//
// Usage: node scripts/generate-temp-export-templates.mjs
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import PptxGenJS from "pptxgenjs";
import ExcelJS from "exceljs";

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(backendRoot, "templates", "export", "v0");

const TEMP_MARK = "【V0 临时模板】";

async function generateDocx() {
  const p = (text, options = {}) => new Paragraph({ children: [new TextRun({ text, ...options })] });
  const document = new Document({
    sections: [
      {
        children: [
          new Paragraph({ text: "{title}", heading: HeadingLevel.TITLE }),
          p("客户：{customerName}"),
          p("生成日期：{generatedAt}"),
          p(`${TEMP_MARK}{reviewNotice}`, { bold: true }),
          p(""),
          new Paragraph({ text: "方案章节", heading: HeadingLevel.HEADING_1 }),
          p("{#sections}"),
          new Paragraph({ text: "{index}. {title}", heading: HeadingLevel.HEADING_2 }),
          p("{body}"),
          p("依据：{traceNote}", { italics: true }),
          p("{/sections}"),
          new Paragraph({ text: "引用来源", heading: HeadingLevel.HEADING_1 }),
          p("{#citations}"),
          p("[{index}] {title}（{source} {location}）chunk={chunkId}"),
          p("{/citations}"),
          new Paragraph({ text: "假设与边界", heading: HeadingLevel.HEADING_1 }),
          p("{#assumptions}"),
          p("- {.}"),
          p("{/assumptions}")
        ]
      }
    ]
  });
  await fs.writeFile(path.join(outDir, "proposal.docx"), await Packer.toBuffer(document));
}

async function generatePptx() {
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "WIDE", width: 13.33, height: 7.5 });
  pptx.layout = "WIDE";

  const cover = pptx.addSlide();
  cover.addText("{title}", { x: 0.8, y: 1.6, w: 11.7, h: 1.2, fontSize: 36, bold: true });
  cover.addText("{customerName}", { x: 0.8, y: 3.0, w: 11.7, h: 0.8, fontSize: 24 });
  cover.addText("{generatedAt}", { x: 0.8, y: 3.9, w: 11.7, h: 0.6, fontSize: 16, color: "666666" });
  cover.addText(`${TEMP_MARK}{reviewNotice}`, {
    x: 0.8,
    y: 6.6,
    w: 11.7,
    h: 0.5,
    fontSize: 12,
    color: "C00000"
  });

  const sections = pptx.addSlide();
  sections.addText("方案章节概览", { x: 0.8, y: 0.4, w: 11.7, h: 0.8, fontSize: 28, bold: true });
  sections.addText("{sectionsSummary}", { x: 0.8, y: 1.4, w: 11.7, h: 5.6, fontSize: 13, valign: "top" });

  const citations = pptx.addSlide();
  citations.addText("引用来源", { x: 0.8, y: 0.4, w: 11.7, h: 0.8, fontSize: 28, bold: true });
  citations.addText("{citationsSummary}", { x: 0.8, y: 1.4, w: 11.7, h: 5.6, fontSize: 13, valign: "top" });

  const assumptions = pptx.addSlide();
  assumptions.addText("假设与审核提示", { x: 0.8, y: 0.4, w: 11.7, h: 0.8, fontSize: 28, bold: true });
  assumptions.addText("{assumptionsSummary}", { x: 0.8, y: 1.4, w: 11.7, h: 5.6, fontSize: 13, valign: "top" });

  const buffer = await pptx.write({ outputType: "nodebuffer" });
  await fs.writeFile(path.join(outDir, "proposal.pptx"), buffer);
}

async function generateXlsx() {
  const workbook = new ExcelJS.Workbook();

  const addSheet = (name, headers, widths) => {
    const sheet = workbook.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
    const headerRow = sheet.addRow(headers);
    headerRow.font = { bold: true };
    headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDCE6F1" } };
    widths.forEach((width, index) => {
      sheet.getColumn(index + 1).width = width;
    });
    return sheet;
  };

  addSheet("需求矩阵", ["序号", "章节", "内容", "依据"], [8, 30, 80, 40]);
  addSheet(
    "引用证据清单",
    ["序号", "文档", "来源", "位置", "chunkId", "documentId"],
    [8, 40, 20, 16, 30, 30]
  );
  addSheet("假设与审核提示", [TEMP_MARK + "说明"], [100]);

  await fs.writeFile(path.join(outDir, "proposal.xlsx"), await workbook.xlsx.writeBuffer());
}

await fs.mkdir(outDir, { recursive: true });
await generateDocx();
await generatePptx();
await generateXlsx();
console.log(`temp templates written to ${outDir}`);
