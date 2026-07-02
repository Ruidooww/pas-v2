import type { ExportPackage } from "../proposal/proposal.types";

export type ExportFormat = "docx" | "pptx" | "xlsx";

export type ExportCreateRequest = {
  exportPackage: ExportPackage;
  formats?: ExportFormat[];
  userId?: string;
};

export type RenderedExportFile = {
  format: ExportFormat;
  fileName: string;
  contentType: string;
  templateVersion: string;
  content: Buffer;
};

export type ExportRenderer = {
  render(format: ExportFormat, exportPackage: ExportPackage): Promise<RenderedExportFile>;
};

export type ExportFormatFailureReason = "TEMPLATE_MISSING" | "TEMPLATE_FIELD_MISSING" | "RENDER_FAILED";

export type ExportFormatRecord =
  | {
      format: ExportFormat;
      status: "completed";
      fileKey: string;
      fileName: string;
      contentType: string;
      templateVersion: string;
      size: number;
    }
  | {
      format: ExportFormat;
      status: "failed";
      failureReason: ExportFormatFailureReason;
      errorMessage: string;
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
