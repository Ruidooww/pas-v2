import type { AuthenticatedUser } from "../auth/auth.types";
import type { FilesService } from "../files/files.service";
import { DEFAULT_ORGANIZATION_UNIT_IDS } from "../organization/organization.types";
import type { ExportPackage } from "../proposal/proposal.types";
import { ExportAuditLogService } from "./export-audit-log.service";
import {
  ExportDeliverableCheckFailedError,
  ExportFileNotReadyError,
  ExportJobAccessDeniedError,
  ExportJobNotFoundError,
  ExportTemplateFieldMissingError,
  ExportTemplateMissingError
} from "./export.errors";
import { ExportJobStoreService } from "./export-job-store.service";
import type {
  ExportCreateRequest,
  ExportDeliverableCheck,
  ExportDownloadResponse,
  ExportFormat,
  ExportFormatFailureReason,
  ExportFormatRecord,
  ExportJob,
  ExportRenderer,
  ExportTemplateCatalog,
  ExportTemplateSelection
} from "./export.types";

export {
  ExportDeliverableCheckFailedError,
  ExportFileNotReadyError,
  ExportJobAccessDeniedError,
  ExportJobNotFoundError,
  ExportTemplateFieldMissingError,
  ExportTemplateMissingError
};

export class ExportService {
  constructor(
    private readonly renderer: ExportRenderer,
    private readonly filesService: FilesService,
    private readonly jobStore: ExportJobStoreService,
    private readonly auditLog: ExportAuditLogService,
    private readonly templateCatalog?: ExportTemplateCatalog
  ) {}

  async createExport(request: ExportCreateRequest): Promise<ExportJob> {
    const userId = request.userId?.trim() || "anonymous-v0";
    const job = this.jobStore.create(request.exportPackage.packageId, request.exportPackage.customerId, userId);
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

  getJobForUser(jobId: string, actor: AuthenticatedUser): ExportJob {
    const job = this.getJobOrThrow(jobId);
    assertCanAccessJob(job, actor);
    return job;
  }

  listJobsForUser(actor: AuthenticatedUser): ExportJob[] {
    const jobs = this.jobStore.list();
    return actor.role === "admin" ? jobs : jobs.filter((job) => job.userId === actor.userId);
  }

  async download(
    jobId: string,
    format: ExportFormat,
    actor: AuthenticatedUser | string = "anonymous-v0"
  ): Promise<ExportDownloadResponse> {
    const user = typeof actor === "string"
      ? {
          userId: actor,
          username: actor,
          displayName: actor,
          role: "technical" as const,
          organizationUnitId: DEFAULT_ORGANIZATION_UNIT_IDS.technicalPresales,
          projectGroupIds: []
        }
      : actor;
    const job = this.getJobOrThrow(jobId);
    assertCanAccessJob(job, user);
    const record = job.formats.find((item) => item.format === format);
    if (!record || record.status !== "completed") {
      throw new ExportFileNotReadyError(jobId, format);
    }

    const file = await this.filesService.readFile(record.fileKey);
    this.auditLog.record({
      event: "export_downloaded",
      jobId,
      userId: user.userId,
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
    const checks: ExportDeliverableCheck[] = [];
    try {
      const template = await this.resolveTemplate(format, checks);
      const rendered = await this.renderer.render(format, exportPackage, template);
      assertNonEmptyFile(format, rendered.content, checks);
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
        templateId: rendered.templateId ?? template?.templateId,
        templateVersion: rendered.templateVersion,
        size: stored.size,
        checks
      };
    } catch (error) {
      if (checks.length === 0) {
        checks.push({
          code: "template_available",
          status: "failed",
          message: error instanceof Error ? error.message : "Export rendering failed"
        });
      }
      return {
        format,
        status: "failed",
        failureReason: classifyExportError(error),
        errorMessage: error instanceof Error ? error.message : "Export rendering failed",
        checks
      };
    }
  }

  private async resolveTemplate(
    format: ExportFormat,
    checks: ExportDeliverableCheck[]
  ): Promise<ExportTemplateSelection | undefined> {
    if (!this.templateCatalog) {
      return undefined;
    }

    try {
      const template = await this.templateCatalog.getAvailableTemplate(format);
      checks.push({
        code: "template_available",
        status: "passed",
        message: `${template.templateId} (${template.fileName})`
      });
      return template;
    } catch (error) {
      checks.push({
        code: "template_available",
        status: "failed",
        message: error instanceof Error ? error.message : "Template is not available"
      });
      throw error;
    }
  }
}

function assertCanAccessJob(job: ExportJob, actor: AuthenticatedUser): void {
  if (actor.role === "admin" || job.userId === actor.userId) {
    return;
  }
  throw new ExportJobAccessDeniedError(job.jobId);
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

  if (error instanceof ExportDeliverableCheckFailedError) {
    return "DELIVERABLE_CHECK_FAILED";
  }

  return "RENDER_FAILED";
}

function assertNonEmptyFile(format: ExportFormat, content: Buffer, checks: ExportDeliverableCheck[]): void {
  if (content.length === 0) {
    const message = "rendered file is empty";
    checks.push({
      code: "file_not_empty",
      status: "failed",
      message
    });
    throw new ExportDeliverableCheckFailedError(format, "file_not_empty", message);
  }

  checks.push({
    code: "file_not_empty",
    status: "passed",
    message: `${content.length} bytes`
  });
}
