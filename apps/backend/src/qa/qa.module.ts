import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import type { AuditLogService } from "../audit/audit-log.service";
import { AUDIT_LOG } from "../audit/audit.tokens";
import { KnowledgeModule } from "../knowledge/knowledge.module";
import { KNOWLEDGE_DOCUMENT_SERVICE } from "../knowledge/knowledge.tokens";
import type { KnowledgeDocumentService } from "../knowledge/knowledge-document.service";
import { LlmModule } from "../llm/llm.module";
import { LLM_CLIENT } from "../llm/llm.tokens";
import type { LlmClientPort } from "../llm/llm.types";
import { RagflowModule } from "../ragflow/ragflow.module";
import { RAGFLOW_CLIENT } from "../ragflow/ragflow.tokens";
import type { RagflowClient } from "../ragflow/ragflow.client";
import { QaAuditLogService } from "./qa-audit-log.service";
import { QaController } from "./qa.controller";
import { createQaConfig } from "./qa.config";
import { LocalQaDraftProvider } from "./qa-draft.provider";
import { ModelQaDraftProvider } from "./model-qa-draft.provider";
import { QaService } from "./qa.service";
import { QA_AUDIT_LOG, QA_CONFIG, QA_DRAFT_PROVIDER, QA_SERVICE } from "./qa.tokens";
import type { QaConfig, QaDraftProvider } from "./qa.types";

@Module({
  controllers: [QaController],
  imports: [RagflowModule, KnowledgeModule, LlmModule, AuditModule],
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
      useFactory: (llm: LlmClientPort, audit: AuditLogService): QaDraftProvider =>
        new ModelQaDraftProvider(llm, new LocalQaDraftProvider(), audit),
      inject: [LLM_CLIENT, AUDIT_LOG]
    },
    {
      provide: QA_SERVICE,
      useFactory: (
        ragflowClient: RagflowClient,
        draftProvider: QaDraftProvider,
        auditLog: QaAuditLogService,
        config: QaConfig,
        documents: KnowledgeDocumentService
      ): QaService => new QaService(ragflowClient, draftProvider, auditLog, config, documents),
      inject: [RAGFLOW_CLIENT, QA_DRAFT_PROVIDER, QA_AUDIT_LOG, QA_CONFIG, KNOWLEDGE_DOCUMENT_SERVICE]
    }
  ],
  exports: [QA_SERVICE]
})
export class QaModule {}
