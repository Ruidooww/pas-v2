import type { ExportFormat, ExportTemplateSelection } from "./export.types";

export type ExportTemplateStatus = "draft" | "active" | "disabled";

export type ExportTemplateCategory = "proposal";

export type UpsertExportTemplateRequest = {
  templateId: string;
  name: string;
  category: ExportTemplateCategory;
  format: ExportFormat;
  version: string;
  fileName: string;
  status: ExportTemplateStatus;
  products?: string[];
  scenarios?: string[];
  industries?: string[];
  tags?: string[];
};

export type ExportTemplate = ExportTemplateSelection & {
  status: ExportTemplateStatus;
  products: string[];
  scenarios: string[];
  industries: string[];
  tags: string[];
  ownerUserId: string;
  createdAt: string;
  updatedAt: string;
  disabledReason?: string;
};

export type ExportTemplateListFilter = {
  format?: ExportFormat;
  status?: ExportTemplateStatus;
  category?: ExportTemplateCategory;
};

export type ExportTemplateStatusRequest = {
  status: ExportTemplateStatus;
  reason?: string;
};
