import { BadRequestException, Body, Controller, ForbiddenException, Get, Inject, NotFoundException, Param, Post, Req } from "@nestjs/common";
import type { AuthenticatedUser } from "../auth/auth.types";
import { EXPORT_SERVICE } from "./export.tokens";
import {
  ExportFileNotReadyError,
  ExportJobAccessDeniedError,
  ExportJobNotFoundError,
  ExportService
} from "./export.service";
import type { ExportCreateRequest, ExportDownloadResponse, ExportFormat, ExportJob } from "./export.types";

type RequestWithUser = {
  user: AuthenticatedUser;
};

@Controller("api/internal/exports")
export class ExportController {
  constructor(@Inject(EXPORT_SERVICE) private readonly exportService: ExportService) {}

  @Post()
  async create(@Req() request: RequestWithUser, @Body() body: ExportCreateRequest): Promise<ExportJob> {
    if (!body.exportPackage?.packageId) {
      throw new BadRequestException("exportPackage.packageId is required");
    }

    return this.exportService.createExport({
      ...body,
      formats: parseFormats(body.formats),
      userId: request.user.userId
    });
  }

  @Get(":jobId")
  getJob(@Req() request: RequestWithUser, @Param("jobId") jobId: string): ExportJob {
    try {
      return this.exportService.getJobForUser(jobId, request.user);
    } catch (error) {
      throw mapExportError(error);
    }
  }

  @Get(":jobId/files/:format")
  async download(
    @Req() request: RequestWithUser,
    @Param("jobId") jobId: string,
    @Param("format") format: string
  ): Promise<ExportDownloadResponse> {
    const parsedFormat = parseFormat(format);
    try {
      return await this.exportService.download(jobId, parsedFormat, request.user);
    } catch (error) {
      throw mapExportError(error);
    }
  }
}

function parseFormat(format: string): ExportFormat {
  if (format === "docx" || format === "pptx" || format === "xlsx") {
    return format;
  }

  throw new BadRequestException("format must be one of docx, pptx, xlsx");
}

function parseFormats(formats: ExportCreateRequest["formats"]): ExportFormat[] | undefined {
  return formats?.map(parseFormat);
}

function mapExportError(error: unknown): Error {
  if (error instanceof ExportJobNotFoundError) {
    return new NotFoundException(error.message);
  }

  if (error instanceof ExportFileNotReadyError) {
    return new BadRequestException(error.message);
  }

  if (error instanceof ExportJobAccessDeniedError) {
    return new ForbiddenException(error.message);
  }

  return error instanceof Error ? error : new Error("Export request failed");
}
