import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import ExcelJS from "exceljs";
import PizZip from "pizzip";
import { beforeEach, describe, expect, it } from "vitest";
import type { ExportPackage } from "../proposal/proposal.types";
import { ExportTemplateMissingError } from "./export.errors";
import { XLSX_SHEETS } from "./fillers/xlsx-template.filler";
import { TemplateExportRenderer } from "./template-export.renderer";

const realTemplateRoot = path.resolve(process.cwd(), "templates/export/v0");

const exportPackage: ExportPackage = {
  packageId: "export-package-1",
  proposalDraftId: "proposal-draft-1",
  customerId: "demo-huaxin-manufacturing",
  status: "ready_for_export",
  formats: ["docx", "pptx", "xlsx"],
  payload: {
    customerAnalysisId: "ca-1",
    proposalDraft: {
      draftId: "proposal-draft-1",
      customerId: "demo-huaxin-manufacturing",
      customerName: "Huaxin Precision",
      title: "Huaxin Precision IP-Guard proposal draft",
      reviewRequired: true,
      generatedAt: "2026-07-02T00:00:00.000Z",
      sections: [
        {
          sectionId: "executive-summary",
          title: "Executive summary",
          body: "Review-required draft.",
          traces: [
            {
              source: "human_input",
              inputId: "input-1",
              label: "Customer input",
              note: "Manual context"
            }
          ]
        },
        {
          sectionId: "recommended-solution",
          title: "Recommended IP-Guard solution",
          body: "Terminal control and document encryption.",
          traces: []
        }
      ],
      citations: [
        {
          chunkId: "chunk-1",
          documentId: "doc-1",
          title: "IP-Guard whitepaper",
          source: "ragflow",
          score: 0.92,
          page: 12
        }
      ],
      assumptions: ["Requires human review."]
    }
  }
};

describe("TemplateExportRenderer", () => {
  let renderer: TemplateExportRenderer;

  beforeEach(() => {
    renderer = new TemplateExportRenderer({
      templateRoot: realTemplateRoot,
      templateVersion: "v0-temp-test"
    });
  });

  it("fails explicitly when the requested template file is missing", async () => {
    const emptyRoot = await fs.mkdtemp(path.join(os.tmpdir(), "pas-export-templates-"));
    const missingRenderer = new TemplateExportRenderer({
      templateRoot: emptyRoot,
      templateVersion: "v0-test"
    });
    await expect(missingRenderer.render("docx", exportPackage)).rejects.toBeInstanceOf(
      ExportTemplateMissingError
    );
    await fs.rm(emptyRoot, { recursive: true, force: true });
  });

  it("rejects a corrupt template file instead of returning it unfilled", async () => {
    const corruptRoot = await fs.mkdtemp(path.join(os.tmpdir(), "pas-export-corrupt-"));
    await fs.writeFile(path.join(corruptRoot, "proposal.docx"), Buffer.from("raw-template"));
    const corruptRenderer = new TemplateExportRenderer({
      templateRoot: corruptRoot,
      templateVersion: "v0-test"
    });
    await expect(corruptRenderer.render("docx", exportPackage)).rejects.toThrow();
    await fs.rm(corruptRoot, { recursive: true, force: true });
  });

  it("uses an explicitly selected template file and version", async () => {
    const selectedRoot = await fs.mkdtemp(path.join(os.tmpdir(), "pas-export-selected-"));
    await fs.copyFile(path.join(realTemplateRoot, "proposal.docx"), path.join(selectedRoot, "customer-template.docx"));
    const selectedRenderer = new TemplateExportRenderer({
      templateRoot: selectedRoot,
      templateVersion: "fallback-version"
    });

    const rendered = await selectedRenderer.render("docx", exportPackage, {
      templateId: "customer-docx-template",
      name: "Customer DOCX Template",
      category: "proposal",
      format: "docx",
      fileName: "customer-template.docx",
      version: "customer-v1"
    });

    expect(rendered.templateId).toBe("customer-docx-template");
    expect(rendered.templateVersion).toBe("customer-v1");
    await fs.rm(selectedRoot, { recursive: true, force: true });
  });

  it("renders docx with sections filled and no leftover template tags", async () => {
    const rendered = await renderer.render("docx", exportPackage);
    expect(rendered.contentType).toContain("wordprocessingml");
    const documentXml = new PizZip(rendered.content).file("word/document.xml")?.asText() ?? "";
    expect(documentXml).toContain("Huaxin Precision");
    expect(documentXml).toContain("Recommended IP-Guard solution");
    expect(documentXml).toContain("IP-Guard whitepaper");
    expect(documentXml).not.toContain("{#sections}");
    expect(documentXml).not.toContain("{customerName}");
  });

  it("renders pptx cover and summary slides", async () => {
    const rendered = await renderer.render("pptx", exportPackage);
    expect(rendered.contentType).toContain("presentationml");
    const zip = new PizZip(rendered.content);
    const slidesXml = Object.keys(zip.files)
      .filter((name) => name.startsWith("ppt/slides/slide"))
      .map((name) => zip.file(name)?.asText() ?? "")
      .join("\n");
    expect(slidesXml).toContain("Huaxin Precision");
    expect(slidesXml).toContain("Executive summary");
    expect(slidesXml).not.toContain("{customerName}");
    expect(slidesXml).not.toContain("{sectionsSummary}");
  });

  it("renders xlsx with requirement and citation rows appended", async () => {
    const rendered = await renderer.render("xlsx", exportPackage);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(
      rendered.content.buffer.slice(
        rendered.content.byteOffset,
        rendered.content.byteOffset + rendered.content.byteLength
      ) as ArrayBuffer
    );
    const requirements = workbook.getWorksheet(XLSX_SHEETS.requirements);
    expect(requirements?.getRow(2).getCell(2).value).toBe("Executive summary");
    const citations = workbook.getWorksheet(XLSX_SHEETS.citations);
    expect(citations?.getRow(2).getCell(2).value).toBe("IP-Guard whitepaper");
    expect(workbook.getWorksheet(XLSX_SHEETS.assumptions)).toBeDefined();
  });
});
