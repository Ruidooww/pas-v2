import { Module } from "@nestjs/common";
import { FilesModule } from "../files/files.module";
import { FILES_SERVICE } from "../files/files.tokens";
import type { FilesService } from "../files/files.service";
import { ExportAuditLogService } from "./export-audit-log.service";
import { createTemplateExportRendererConfig } from "./export.config";
import { ExportController } from "./export.controller";
import { ExportJobStoreService } from "./export-job-store.service";
import { ExportService } from "./export.service";
import {
  EXPORT_AUDIT_LOG,
  EXPORT_JOB_STORE,
  EXPORT_RENDERER,
  EXPORT_RENDERER_CONFIG,
  EXPORT_SERVICE
} from "./export.tokens";
import type { ExportRenderer } from "./export.types";
import { TemplateExportRenderer, type TemplateExportRendererConfig } from "./template-export.renderer";

@Module({
  controllers: [ExportController],
  imports: [FilesModule],
  providers: [
    {
      provide: EXPORT_RENDERER_CONFIG,
      useFactory: (): TemplateExportRendererConfig => createTemplateExportRendererConfig()
    },
    {
      provide: EXPORT_RENDERER,
      useFactory: (config: TemplateExportRendererConfig): ExportRenderer => new TemplateExportRenderer(config),
      inject: [EXPORT_RENDERER_CONFIG]
    },
    {
      provide: EXPORT_JOB_STORE,
      useFactory: (): ExportJobStoreService => new ExportJobStoreService()
    },
    {
      provide: EXPORT_AUDIT_LOG,
      useFactory: (): ExportAuditLogService => new ExportAuditLogService()
    },
    {
      provide: EXPORT_SERVICE,
      useFactory: (
        renderer: ExportRenderer,
        filesService: FilesService,
        jobStore: ExportJobStoreService,
        auditLog: ExportAuditLogService
      ): ExportService => new ExportService(renderer, filesService, jobStore, auditLog),
      inject: [EXPORT_RENDERER, FILES_SERVICE, EXPORT_JOB_STORE, EXPORT_AUDIT_LOG]
    }
  ],
  exports: [EXPORT_SERVICE]
})
export class ExportModule {}
