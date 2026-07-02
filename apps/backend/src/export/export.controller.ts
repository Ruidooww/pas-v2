import { BadRequestException, Body, Controller, Get, Inject, NotFoundException, Param, Post, Query } from "@nestjs/common";
import { EXPORT_SERVICE } from "./export.tokens";
import {
  ExportFileNotReadyError,
  ExportJobNotFoundError,
  ExportService
} from "./export.service";
import type { ExportCreateRequest, ExportDownloadResponse, ExportFormat, ExportJob } from "./export.types";

@Controller("api/internal/exports")
export class ExportController {
  constructor(@Inject(EXPORT_SERVICE) private readonly exportService: ExportService) {}

  @Post()
  async create(@Body() body: ExportCreateRequest): Promise<ExportJob> {
    if (!body.exportPackage?.packageId) {
      throw new BadRequestException("exportPackage.packageId is required");
    }

    return this.exportService.createExport(body);
  }

  @Get(":jobId")
  getJob(@Param("jobId") jobId: string): ExportJob {
    try {
      return this.exportService.getJobOrThrow(jobId);
    } catch (error) {
      throw mapExportError(error);
    }
  }

  @Get(":jobId/files/:format")
  async download(
    @Param("jobId") jobId: string,
    @Param("format") format: string,
    @Query("userId") userId?: string
  ): Promise<ExportDownloadResponse> {
    const parsedFormat = parseFormat(format);
    try {
      return await this.exportService.download(jobId, parsedFormat, userId);
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

function mapExportError(error: unknown): Error {
  if (error instanceof ExportJobNotFoundError) {
    return new NotFoundException(error.message);
  }

  if (error instanceof ExportFileNotReadyError) {
    return new BadRequestException(error.message);
  }

  return error instanceof Error ? error : new Error("Export request failed");
}
