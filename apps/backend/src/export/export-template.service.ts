import fs from "node:fs/promises";
import path from "node:path";
import { ForbiddenException, NotFoundException } from "@nestjs/common";
import type { AuditLogService } from "../audit/audit-log.service";
import type { AuthenticatedUser } from "../auth/auth.types";
import type { PersistenceSink } from "../persistence/persistence-sink";
import { ExportTemplateMissingError } from "./export.errors";
import type { TemplateExportRendererConfig } from "./template-export.renderer";
import type { ExportFormat, ExportTemplateSelection } from "./export.types";
import type {
  ExportTemplate,
  ExportTemplateListFilter,
  ExportTemplateStatus,
  UpsertExportTemplateRequest
} from "./export-template.types";

type ExportTemplateServiceConfig = Pick<TemplateExportRendererConfig, "templateRoot">;

export class ExportTemplateService {
  private readonly templates = new Map<string, ExportTemplate>();

  constructor(
    private readonly auditLog: AuditLogService,
    private readonly config: ExportTemplateServiceConfig,
    private readonly sink?: PersistenceSink
  ) {}

  seed(templates: ExportTemplate[]): void {
    for (const template of templates) {
      if (!this.templates.has(template.templateId)) {
        this.templates.set(template.templateId, cloneTemplate(template));
      }
    }
  }

  upsertTemplate(user: AuthenticatedUser, request: UpsertExportTemplateRequest): ExportTemplate {
    assertOperator(user);
    const current = this.templates.get(request.templateId);
    const now = nowIso();
    const normalized = normalizeRequest(request);
    const template: ExportTemplate = {
      ...current,
      ...normalized,
      ownerUserId: current?.ownerUserId ?? user.userId,
      createdAt: current?.createdAt ?? now,
      updatedAt: now,
      disabledReason: normalized.status === "disabled" ? current?.disabledReason : undefined
    };
    this.save(user, template, "export_template_upserted");
    return cloneTemplate(template);
  }

  listTemplates(_user: AuthenticatedUser, filter: ExportTemplateListFilter = {}): ExportTemplate[] {
    return [...this.templates.values()]
      .filter((template) => (filter.format ? template.format === filter.format : true))
      .filter((template) => (filter.status ? template.status === filter.status : true))
      .filter((template) => (filter.category ? template.category === filter.category : true))
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .map(cloneTemplate);
  }

  getTemplate(_user: AuthenticatedUser, templateId: string): ExportTemplate {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new NotFoundException("export template not found");
    }
    return cloneTemplate(template);
  }

  setStatus(
    user: AuthenticatedUser,
    templateId: string,
    status: ExportTemplateStatus,
    reason?: string
  ): ExportTemplate {
    assertOperator(user);
    const current = this.templates.get(templateId);
    if (!current) {
      throw new NotFoundException("export template not found");
    }
    const updated: ExportTemplate = {
      ...current,
      status,
      disabledReason: status === "disabled" ? reason : undefined,
      updatedAt: nowIso()
    };
    this.save(user, updated, `export_template_${status}`);
    return cloneTemplate(updated);
  }

  async getAvailableTemplate(format: ExportFormat): Promise<ExportTemplateSelection> {
    const template = [...this.templates.values()]
      .filter((item) => item.category === "proposal")
      .filter((item) => item.format === format)
      .filter((item) => item.status === "active")
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];

    if (!template) {
      throw new ExportTemplateMissingError(format, `active metadata for proposal.${format}`);
    }

    await this.assertTemplateFileExists(template);

    return {
      templateId: template.templateId,
      name: template.name,
      category: template.category,
      format: template.format,
      version: template.version,
      fileName: template.fileName
    };
  }

  private async assertTemplateFileExists(template: ExportTemplate): Promise<void> {
    const root = path.resolve(this.config.templateRoot);
    const fullPath = path.resolve(root, template.fileName);
    const normalizedRoot = root.toLowerCase();
    const normalizedFullPath = fullPath.toLowerCase();
    if (normalizedFullPath !== normalizedRoot && !normalizedFullPath.startsWith(`${normalizedRoot}${path.sep}`)) {
      throw new ExportTemplateMissingError(template.format, template.fileName);
    }

    try {
      await fs.access(fullPath);
    } catch {
      throw new ExportTemplateMissingError(template.format, template.fileName);
    }
  }

  private save(user: AuthenticatedUser, template: ExportTemplate, reason: string): void {
    this.templates.set(template.templateId, cloneTemplate(template));
    this.sink?.mirrorExportTemplate(template);
    this.auditLog.record({
      action: "export",
      actorUserId: user.userId,
      objectType: "export_template",
      objectId: template.templateId,
      result: "success",
      failureReason: reason
    });
  }
}

export function createDefaultExportTemplates(config: TemplateExportRendererConfig): ExportTemplate[] {
  const now = nowIso();
  return (["docx", "pptx", "xlsx"] as const).map((format) => ({
    templateId: `system-proposal-${format}`,
    name: `System proposal ${format.toUpperCase()}`,
    category: "proposal",
    format,
    version: config.templateVersion,
    fileName: `proposal.${format}`,
    status: "active",
    products: ["IP-Guard"],
    scenarios: ["standard proposal"],
    industries: [],
    tags: ["system-default"],
    ownerUserId: "system",
    createdAt: now,
    updatedAt: now
  }));
}

function normalizeRequest(request: UpsertExportTemplateRequest): UpsertExportTemplateRequest & {
  products: string[];
  scenarios: string[];
  industries: string[];
  tags: string[];
} {
  return {
    templateId: request.templateId.trim(),
    name: request.name.trim(),
    category: request.category,
    format: request.format,
    version: request.version.trim(),
    fileName: request.fileName.trim(),
    status: request.status,
    products: normalizeList(request.products ?? []),
    scenarios: normalizeList(request.scenarios ?? []),
    industries: normalizeList(request.industries ?? []),
    tags: normalizeList(request.tags ?? [])
  };
}

function normalizeList(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function assertOperator(user: AuthenticatedUser): void {
  if (user.role !== "admin" && user.role !== "presales") {
    throw new ForbiddenException("admin or presales role is required");
  }
}

function cloneTemplate(template: ExportTemplate): ExportTemplate {
  return {
    ...template,
    products: [...template.products],
    scenarios: [...template.scenarios],
    industries: [...template.industries],
    tags: [...template.tags]
  };
}

function nowIso(): string {
  return new Date().toISOString();
}
