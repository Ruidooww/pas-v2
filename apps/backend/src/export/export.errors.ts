import type { ExportFormat } from "./export.types";

export class ExportTemplateMissingError extends Error {
  constructor(
    readonly format: ExportFormat,
    readonly templateName: string
  ) {
    super(`Template missing for ${format}: ${templateName}`);
    this.name = "ExportTemplateMissingError";
  }
}

export class ExportTemplateFieldMissingError extends Error {
  constructor(
    readonly format: ExportFormat,
    readonly fieldName: string
  ) {
    super(`Template field missing for ${format}: ${fieldName}`);
    this.name = "ExportTemplateFieldMissingError";
  }
}

export class ExportJobNotFoundError extends Error {
  constructor(jobId: string) {
    super(`Export job not found: ${jobId}`);
    this.name = "ExportJobNotFoundError";
  }
}

export class ExportFileNotReadyError extends Error {
  constructor(jobId: string, format: ExportFormat) {
    super(`Export file is not ready: ${jobId}/${format}`);
    this.name = "ExportFileNotReadyError";
  }
}
