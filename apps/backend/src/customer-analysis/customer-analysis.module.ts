import { Module } from "@nestjs/common";
import { CrmModule } from "../crm/crm.module";
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
  imports: [CrmModule, RagflowModule],
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
        config: CustomerAnalysisConfig
      ): CustomerAnalysisService => new CustomerAnalysisService(crmClient, ragflowClient, auditLog, config),
      inject: [CRM_CLIENT, RAGFLOW_CLIENT, CUSTOMER_ANALYSIS_AUDIT_LOG, CUSTOMER_ANALYSIS_CONFIG]
    }
  ],
  exports: [CUSTOMER_ANALYSIS_SERVICE]
})
export class CustomerAnalysisModule {}
