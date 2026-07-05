import { BadRequestException, Body, Controller, Get, Inject, Param, Post, Query, Req } from "@nestjs/common";
import type { AuthenticatedUser } from "../auth/auth.types";
import { EXPORT_TEMPLATE_SERVICE } from "./export.tokens";
import type { ExportFormat } from "./export.types";
import { ExportTemplateService } from "./export-template.service";
import type {
  ExportTemplate,
  ExportTemplateCategory,
  ExportTemplateListFilter,
  ExportTemplateStatus,
  ExportTemplateStatusRequest,
  UpsertExportTemplateRequest
} from "./export-template.types";

type RequestWithUser = {
  user: AuthenticatedUser;
};

type ExportTemplateListQuery = {
  format?: ExportFormat;
  status?: ExportTemplateStatus;
  category?: ExportTemplateCategory;
};

@Controller("api/internal/export-templates")
export class ExportTemplateController {
  constructor(@Inject(EXPORT_TEMPLATE_SERVICE) private readonly templates: ExportTemplateService) {}

  @Post()
  upsert(@Req() request: RequestWithUser, @Body() body: UpsertExportTemplateRequest): ExportTemplate {
    validateTemplateBody(body);
    return this.templates.upsertTemplate(request.user, body);
  }

  @Get()
  list(@Req() request: RequestWithUser, @Query() query: ExportTemplateListQuery): ExportTemplate[] {
    return this.templates.listTemplates(request.user, toFilter(query));
  }

  @Get(":templateId")
  get(@Req() request: RequestWithUser, @Param("templateId") templateId: string): ExportTemplate {
    return this.templates.getTemplate(request.user, templateId);
  }

  @Post(":templateId/status")
  setStatus(
    @Req() request: RequestWithUser,
    @Param("templateId") templateId: string,
    @Body() body: ExportTemplateStatusRequest
  ): ExportTemplate {
    if (!isStatus(body.status)) {
      throw new BadRequestException("status must be draft, active, or disabled");
    }
    return this.templates.setStatus(request.user, templateId, body.status, body.reason);
  }
}

function validateTemplateBody(body: UpsertExportTemplateRequest): void {
  if (!body.templateId?.trim()) throw new BadRequestException("templateId is required");
  if (!body.name?.trim()) throw new BadRequestException("name is required");
  if (body.category !== "proposal") throw new BadRequestException("category must be proposal");
  if (!isFormat(body.format)) throw new BadRequestException("format must be docx, pptx, or xlsx");
  if (!body.version?.trim()) throw new BadRequestException("version is required");
  if (!body.fileName?.trim()) throw new BadRequestException("fileName is required");
  if (!isStatus(body.status)) throw new BadRequestException("status must be draft, active, or disabled");
}

function toFilter(query: ExportTemplateListQuery): ExportTemplateListFilter {
  return {
    format: query.format && isFormat(query.format) ? query.format : undefined,
    status: query.status && isStatus(query.status) ? query.status : undefined,
    category: query.category === "proposal" ? query.category : undefined
  };
}

function isFormat(format: unknown): format is ExportFormat {
  return format === "docx" || format === "pptx" || format === "xlsx";
}

function isStatus(status: unknown): status is ExportTemplateStatus {
  return status === "draft" || status === "active" || status === "disabled";
}
