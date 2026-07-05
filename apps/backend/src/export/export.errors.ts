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

export class ExportDeliverableCheckFailedError extends Error {
  constructor(
    readonly format: ExportFormat,
    readonly checkCode: string,
    message: string
  ) {
    super(`Export deliverable check failed for ${format}: ${checkCode}: ${message}`);
    this.name = "ExportDeliverableCheckFailedError";
  }
}

export class ExportJobNotFoundError extends Error {
  constructor(jobId: string) {
    super(`Export job not found: ${jobId}`);
    this.name = "ExportJobNotFoundError";
  }
}

export class ExportJobAccessDeniedError extends Error {
  constructor(jobId: string) {
    super(`Export job is not accessible: ${jobId}`);
    this.name = "ExportJobAccessDeniedError";
  }
}

export class ExportFileNotReadyError extends Error {
  constructor(jobId: string, format: ExportFormat) {
    super(`Export file is not ready: ${jobId}/${format}`);
    this.name = "ExportFileNotReadyError";
  }
}
