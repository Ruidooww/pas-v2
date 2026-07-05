import { Module } from "@nestjs/common";
import { CrmModule } from "../crm/crm.module";
import { KnowledgeModule } from "../knowledge/knowledge.module";
import type { KnowledgeDocumentService } from "../knowledge/knowledge-document.service";
import { KNOWLEDGE_DOCUMENT_SERVICE } from "../knowledge/knowledge.tokens";
import { LlmModule } from "../llm/llm.module";
import { LLM_CLIENT } from "../llm/llm.tokens";
import type { LlmClient } from "../llm/llm.client";
import { CRM_CLIENT } from "../crm/crm.tokens";
import type { CrmClient } from "../crm/crm.types";
import { RAGFLOW_CLIENT } from "../ragflow/ragflow.tokens";
import { RagflowModule } from "../ragflow/ragflow.module";
import type { RagflowClient } from "../ragflow/ragflow.client";
import { CustomerAnalysisAuditLogService } from "./customer-analysis-audit-log.service";
import { createCustomerAnalysisConfig } from "./customer-analysis.config";
import { CustomerAnalysisController } from "./customer-analysis.controller";
import { CustomerAnalysisService } from "./customer-analysis.service";
import {
  CUSTOMER_ANALYSIS_AUDIT_LOG,
  CUSTOMER_ANALYSIS_CONFIG,
  CUSTOMER_ANALYSIS_SERVICE
} from "./customer-analysis.tokens";
import type { CustomerAnalysisConfig } from "./customer-analysis.types";

@Module({
  controllers: [CustomerAnalysisController],
  imports: [CrmModule, LlmModule, RagflowModule, KnowledgeModule],
  providers: [
    {
      provide: CUSTOMER_ANALYSIS_CONFIG,
      useFactory: (): CustomerAnalysisConfig => createCustomerAnalysisConfig()
    },
    {
      provide: CUSTOMER_ANALYSIS_AUDIT_LOG,
      useFactory: (): CustomerAnalysisAuditLogService => new CustomerAnalysisAuditLogService()
    },
    {
      provide: CUSTOMER_ANALYSIS_SERVICE,
      useFactory: (
        crmClient: CrmClient,
        ragflowClient: RagflowClient,
        auditLog: CustomerAnalysisAuditLogService,
        config: CustomerAnalysisConfig,
        llmClient: LlmClient,
        documents: KnowledgeDocumentService
      ): CustomerAnalysisService =>
        new CustomerAnalysisService(crmClient, ragflowClient, auditLog, config, llmClient, documents),
      inject: [
        CRM_CLIENT,
        RAGFLOW_CLIENT,
        CUSTOMER_ANALYSIS_AUDIT_LOG,
        CUSTOMER_ANALYSIS_CONFIG,
        LLM_CLIENT,
        KNOWLEDGE_DOCUMENT_SERVICE
      ]
    }
  ],
  exports: [CUSTOMER_ANALYSIS_SERVICE]
})
export class CustomerAnalysisModule {}
