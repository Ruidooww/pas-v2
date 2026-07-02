import type { FilesService } from "../files/files.service";
import type { ExportPackage } from "../proposal/proposal.types";
import { ExportAuditLogService } from "./export-audit-log.service";
import {
  ExportFileNotReadyError,
  ExportJobNotFoundError,
  ExportTemplateFieldMissingError,
  ExportTemplateMissingError
} from "./export.errors";
import { ExportJobStoreService } from "./export-job-store.service";
import type {
  ExportCreateRequest,
  ExportDownloadResponse,
  ExportFormat,
  ExportFormatFailureReason,
  ExportFormatRecord,
  ExportJob,
  ExportRenderer
} from "./export.types";

export {
  ExportFileNotReadyError,
  ExportJobNotFoundError,
  ExportTemplateFieldMissingError,
  ExportTemplateMissingError
};

export class ExportService {
  constructor(
    private readonly renderer: ExportRenderer,
    private readonly filesService: FilesService,
    private readonly jobStore: ExportJobStoreService,
    private readonly auditLog: ExportAuditLogService
  ) {}

  async createExport(request: ExportCreateRequest): Promise<ExportJob> {
    const userId = request.userId?.trim() || "anonymous-v0";
    const job = this.jobStore.create(request.exportPackage.packageId, request.exportPackage.customerId);
    this.auditLog.record({
      event: "export_started",
      jobId: job.jobId,
      userId
    });

    for (const format of formatsFor(request.exportPackage, request.formats)) {
      this.jobStore.appendFormat(job.jobId, await this.renderFormat(format, request.exportPackage));
    }

    const completed = this.jobStore.finish(job.jobId) ?? this.getJobOrThrow(job.jobId);
    this.auditLog.record({
      event: "export_completed",
      jobId: job.jobId,
      userId,
      status: completed.status
    });
    return completed;
  }

  getJobOrThrow(jobId: string): ExportJob {
    const job = this.jobStore.get(jobId);
    if (!job) {
      throw new ExportJobNotFoundError(jobId);
    }

    return job;
  }

  async download(jobId: string, format: ExportFormat, userId = "anonymous-v0"): Promise<ExportDownloadResponse> {
    const job = this.getJobOrThrow(jobId);
    const record = job.formats.find((item) => item.format === format);
    if (!record || record.status !== "completed") {
      throw new ExportFileNotReadyError(jobId, format);
    }

    const file = await this.filesService.readFile(record.fileKey);
    this.auditLog.record({
      event: "export_downloaded",
      jobId,
      userId,
      format
    });

    return {
      fileName: file.fileName,
      contentType: file.contentType,
      contentBase64: file.content.toString("base64"),
      size: file.size
    };
  }

  private async renderFormat(format: ExportFormat, exportPackage: ExportPackage): Promise<ExportFormatRecord> {
    try {
      const rendered = await this.renderer.render(format, exportPackage);
      const stored = await this.filesService.saveFile({
        format,
        fileName: rendered.fileName,
        contentType: rendered.contentType,
        content: rendered.content,
        metadata: {
          sourcePackageId: exportPackage.packageId,
          templateVersion: rendered.templateVersion
        }
      });

      return {
        format,
        status: "completed",
        fileKey: stored.key,
        fileName: stored.fileName,
        contentType: stored.contentType,
        templateVersion: rendered.templateVersion,
        size: stored.size
      };
    } catch (error) {
      return {
        format,
        status: "failed",
        failureReason: classifyExportError(error),
        errorMessage: error instanceof Error ? error.message : "Export rendering failed"
      };
    }
  }
}

function formatsFor(exportPackage: ExportPackage, requestedFormats?: ExportFormat[]): ExportFormat[] {
  return requestedFormats?.length ? requestedFormats : exportPackage.formats;
}

function classifyExportError(error: unknown): ExportFormatFailureReason {
  if (error instanceof ExportTemplateMissingError) {
    return "TEMPLATE_MISSING";
  }

  if (error instanceof ExportTemplateFieldMissingError) {
    return "TEMPLATE_FIELD_MISSING";
  }

  return "RENDER_FAILED";
}
