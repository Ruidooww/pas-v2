import { Module } from "@nestjs/common";
import { AuditModule } from "./audit/audit.module";
import { AuthModule } from "./auth/auth.module";
import { CustomerAnalysisModule } from "./customer-analysis/customer-analysis.module";
import { CrmModule } from "./crm/crm.module";
import { ExportModule } from "./export/export.module";
import { FeedbackModule } from "./feedback/feedback.module";
import { HealthController } from "./health/health.controller";
import { IntegrationModule } from "./integration/integration.module";
import { QaModule } from "./qa/qa.module";
import { ProposalModule } from "./proposal/proposal.module";
import { RagflowModule } from "./ragflow/ragflow.module";

@Module({
  controllers: [HealthController],
  imports: [
    AuditModule,
    AuthModule,
    CrmModule,
    CustomerAnalysisModule,
    QaModule,
    ProposalModule,
    ExportModule,
    FeedbackModule,
    IntegrationModule,
    RagflowModule
  ]
})
export class AppModule {}
