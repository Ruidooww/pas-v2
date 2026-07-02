import { Module } from "@nestjs/common";
import { RagflowModule } from "../ragflow/ragflow.module";
import { RAGFLOW_CLIENT } from "../ragflow/ragflow.tokens";
import type { RagflowClient } from "../ragflow/ragflow.client";
import { QaAuditLogService } from "./qa-audit-log.service";
import { QaController } from "./qa.controller";
import { createQaConfig } from "./qa.config";
import { LocalQaDraftProvider } from "./qa-draft.provider";
import { QaService } from "./qa.service";
import { QA_AUDIT_LOG, QA_CONFIG, QA_DRAFT_PROVIDER, QA_SERVICE } from "./qa.tokens";
import type { QaConfig, QaDraftProvider } from "./qa.types";

@Module({
  controllers: [QaController],
  imports: [RagflowModule],
  providers: [
    {
      provide: QA_CONFIG,
      useFactory: (): QaConfig => createQaConfig()
    },
    {
      provide: QA_AUDIT_LOG,
      useFactory: (): QaAuditLogService => new QaAuditLogService()
    },
    {
      provide: QA_DRAFT_PROVIDER,
      useFactory: (): QaDraftProvider => new LocalQaDraftProvider()
    },
    {
      provide: QA_SERVICE,
      useFactory: (
        ragflowClient: RagflowClient,
        draftProvider: QaDraftProvider,
        auditLog: QaAuditLogService,
        config: QaConfig
      ): QaService => new QaService(ragflowClient, draftProvider, auditLog, config),
      inject: [RAGFLOW_CLIENT, QA_DRAFT_PROVIDER, QA_AUDIT_LOG, QA_CONFIG]
    }
  ],
  exports: [QA_SERVICE]
})
export class QaModule {}
