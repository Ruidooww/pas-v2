import { Module } from "@nestjs/common";
import type { AuditLogService } from "../audit/audit-log.service";
import { AuditModule } from "../audit/audit.module";
import { AUDIT_LOG } from "../audit/audit.tokens";
import type { PersistenceSink } from "../persistence/persistence-sink";
import { PERSISTENCE_SINK } from "../persistence/persistence.tokens";
import { FilesModule } from "../files/files.module";
import { FILES_SERVICE } from "../files/files.tokens";
import type { FilesService } from "../files/files.service";
import { ExportTemplateController } from "./export-template.controller";
import { createDefaultExportTemplates, ExportTemplateService } from "./export-template.service";
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
  EXPORT_SERVICE,
  EXPORT_TEMPLATE_SERVICE
} from "./export.tokens";
import type { ExportRenderer } from "./export.types";
import { TemplateExportRenderer, type TemplateExportRendererConfig } from "./template-export.renderer";

@Module({
  controllers: [ExportController, ExportTemplateController],
  imports: [AuditModule, FilesModule],
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
      useFactory: async (sink: PersistenceSink): Promise<ExportJobStoreService> => {
        const store = new ExportJobStoreService(sink);
        store.seed(await sink.loadExportJobs());
        return store;
      },
      inject: [PERSISTENCE_SINK]
    },
    {
      provide: EXPORT_AUDIT_LOG,
      useFactory: (): ExportAuditLogService => new ExportAuditLogService()
    },
    {
      provide: EXPORT_TEMPLATE_SERVICE,
      useFactory: async (
        auditLog: AuditLogService,
        sink: PersistenceSink,
        config: TemplateExportRendererConfig
      ): Promise<ExportTemplateService> => {
        const service = new ExportTemplateService(auditLog, config, sink);
        service.seed(await sink.loadExportTemplates());
        service.seed(createDefaultExportTemplates(config));
        return service;
      },
      inject: [AUDIT_LOG, PERSISTENCE_SINK, EXPORT_RENDERER_CONFIG]
    },
    {
      provide: EXPORT_SERVICE,
      useFactory: (
        renderer: ExportRenderer,
        filesService: FilesService,
        jobStore: ExportJobStoreService,
        auditLog: ExportAuditLogService,
        templateService: ExportTemplateService
      ): ExportService => new ExportService(renderer, filesService, jobStore, auditLog, templateService),
      inject: [EXPORT_RENDERER, FILES_SERVICE, EXPORT_JOB_STORE, EXPORT_AUDIT_LOG, EXPORT_TEMPLATE_SERVICE]
    }
  ],
  exports: [EXPORT_SERVICE, EXPORT_TEMPLATE_SERVICE]
})
export class ExportModule {}
