import fs from "node:fs/promises";
import path from "node:path";
import type { ExportPackage } from "../proposal/proposal.types";
import { ExportTemplateFieldMissingError, ExportTemplateMissingError } from "./export.errors";
import { buildExportViewModel } from "./export-view-model";
import { fillDocxTemplate } from "./fillers/docx-template.filler";
import { fillPptxTemplate } from "./fillers/pptx-template.filler";
import { fillXlsxTemplate } from "./fillers/xlsx-template.filler";
import type { ExportFormat, ExportRenderer, RenderedExportFile } from "./export.types";

export type TemplateExportRendererConfig = {
  templateRoot: string;
  templateVersion: string;
};

const CONTENT_TYPES: Record<ExportFormat, string> = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
};

export class TemplateExportRenderer implements ExportRenderer {
  constructor(private readonly config: TemplateExportRendererConfig) {}

  async render(format: ExportFormat, exportPackage: ExportPackage): Promise<RenderedExportFile> {
    validateRequiredFields(format, exportPackage);
    const templateName = `proposal.${format}`;
    const templatePath = path.join(this.config.templateRoot, templateName);

    let templateContent: Buffer;
    try {
      templateContent = await fs.readFile(templatePath);
    } catch {
      throw new ExportTemplateMissingError(format, templateName);
    }

    const viewModel = buildExportViewModel(exportPackage);
    const content = await fillTemplate(format, templateContent, viewModel);
    const draft = exportPackage.payload.proposalDraft;

    return {
      format,
      fileName: buildFileName(draft.customerName, format),
      contentType: CONTENT_TYPES[format],
      templateVersion: this.config.templateVersion,
      content
    };
  }
}

async function fillTemplate(
  format: ExportFormat,
  templateContent: Buffer,
  viewModel: ReturnType<typeof buildExportViewModel>
): Promise<Buffer> {
  switch (format) {
    case "docx":
      return fillDocxTemplate(templateContent, viewModel);
    case "pptx":
      return fillPptxTemplate(templateContent, viewModel);
    case "xlsx":
      return fillXlsxTemplate(templateContent, viewModel);
  }
}

function buildFileName(customerName: string, format: ExportFormat): string {
  const datePart = new Date().toISOString().slice(0, 10);
  const safeCustomer = customerName.replace(/[\\/:*?"<>|\s]+/g, "-");
  return `${safeCustomer}-IP-Guard-proposal-${datePart}.${format}`;
}

function validateRequiredFields(format: ExportFormat, exportPackage: ExportPackage): void {
  const draft = exportPackage.payload?.proposalDraft;
  if (!exportPackage.packageId) {
    throw new ExportTemplateFieldMissingError(format, "packageId");
  }
  if (!draft?.customerName) {
    throw new ExportTemplateFieldMissingError(format, "proposalDraft.customerName");
  }
  if (!draft.title) {
    throw new ExportTemplateFieldMissingError(format, "proposalDraft.title");
  }
  if (!draft.sections?.length) {
    throw new ExportTemplateFieldMissingError(format, "proposalDraft.sections");
  }
}
