import type { ExportPackage } from "../proposal/proposal.types";

export type ExportFormat = "docx" | "pptx" | "xlsx";

export type ExportCreateRequest = {
  exportPackage: ExportPackage;
  formats?: ExportFormat[];
  userId?: string;
};

export type ExportTemplateSelection = {
  templateId: string;
  name: string;
  category: "proposal";
  format: ExportFormat;
  version: string;
  fileName: string;
};

export type RenderedExportFile = {
  format: ExportFormat;
  fileName: string;
  contentType: string;
  templateId?: string;
  templateVersion: string;
  content: Buffer;
};

export type ExportRenderer = {
  render(
    format: ExportFormat,
    exportPackage: ExportPackage,
    template?: ExportTemplateSelection
  ): Promise<RenderedExportFile>;
};

export type ExportTemplateCatalog = {
  getAvailableTemplate(format: ExportFormat): Promise<ExportTemplateSelection>;
};

export type ExportDeliverableCheck = {
  code: "template_available" | "file_not_empty";
  status: "passed" | "failed";
  message: string;
};

export type ExportFormatFailureReason =
  | "TEMPLATE_MISSING"
  | "TEMPLATE_FIELD_MISSING"
  | "DELIVERABLE_CHECK_FAILED"
  | "RENDER_FAILED";

export type ExportFormatRecord =
  | {
      format: ExportFormat;
      status: "completed";
      fileKey: string;
      fileName: string;
      contentType: string;
      templateId?: string;
      templateVersion: string;
      size: number;
      checks?: ExportDeliverableCheck[];
    }
  | {
      format: ExportFormat;
      status: "failed";
      failureReason: ExportFormatFailureReason;
      errorMessage: string;
      checks?: ExportDeliverableCheck[];
    };

export type ExportJobStatus = "completed" | "partial" | "failed";

export type ExportJob = {
  jobId: string;
  sourcePackageId: string;
  customerId: string;
  status: ExportJobStatus;
  formats: ExportFormatRecord[];
  createdAt: string;
  updatedAt: string;
};

export type ExportDownloadResponse = {
  fileName: string;
  contentType: string;
  contentBase64: string;
  size: number;
};

export type ExportAuditEvent = {
  event: "export_started" | "export_completed" | "export_downloaded";
  jobId: string;
  userId: string;
  format?: ExportFormat;
  status?: ExportJobStatus;
};
