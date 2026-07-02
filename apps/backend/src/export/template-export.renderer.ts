import fs from "node:fs/promises";
import path from "node:path";
import type { ExportPackage } from "../proposal/proposal.types";
import { ExportTemplateFieldMissingError, ExportTemplateMissingError } from "./export.errors";
import type { ExportFormat, ExportRenderer, RenderedExportFile } from "./export.types";

export type TemplateExportRendererConfig = {
  templateRoot: string;
  templateVersion: string;
};

export class TemplateExportRenderer implements ExportRenderer {
  constructor(private readonly config: TemplateExportRendererConfig) {}

  async render(format: ExportFormat, exportPackage: ExportPackage): Promise<RenderedExportFile> {
    validateRequiredFields(format, exportPackage);
    const templateName = `proposal.${format}`;
    const templatePath = path.join(this.config.templateRoot, templateName);

    try {
      await fs.access(templatePath);
    } catch {
      throw new ExportTemplateMissingError(format, templateName);
    }

    throw new Error(
      `Template renderer is not configured for ${format}. Configure the real docxtemplater, pptx-automizer, or exceljs template filler before enabling export success.`
    );
  }
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
