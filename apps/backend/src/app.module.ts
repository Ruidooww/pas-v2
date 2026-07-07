import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { AuditModule } from "./audit/audit.module";
import { BusinessFlowModule } from "./business-flow/business-flow.module";
import { PersistenceModule } from "./persistence/persistence.module";
import { PlatformModule } from "./platform/platform.module";
import { AuthModule } from "./auth/auth.module";
import { CustomerAnalysisModule } from "./customer-analysis/customer-analysis.module";
import { CrmModule } from "./crm/crm.module";
import { ExportModule } from "./export/export.module";
import { FeedbackModule } from "./feedback/feedback.module";
import { HealthController } from "./health/health.controller";
import { IntegrationModule } from "./integration/integration.module";
import { KnowledgeModule } from "./knowledge/knowledge.module";
import { MenuModule } from "./menu/menu.module";
import { QaModule } from "./qa/qa.module";
import { ProposalModule } from "./proposal/proposal.module";
import { RagflowModule } from "./ragflow/ragflow.module";
import { SystemModule } from "./system/system.module";
import { WorkbenchModule } from "./workbench/workbench.module";

@Module({
  controllers: [HealthController],
  imports: [
    PersistenceModule,
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: Number(process.env.THROTTLE_LIMIT_PER_MINUTE || 120)
      }
    ]),
    AuditModule,
    AuthModule,
    CrmModule,
    CustomerAnalysisModule,
    QaModule,
    ProposalModule,
    ExportModule,
    FeedbackModule,
    KnowledgeModule,
    MenuModule,
    BusinessFlowModule,
    PlatformModule,
    IntegrationModule,
    RagflowModule,
    SystemModule,
    WorkbenchModule
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard
    }
  ]
})
export class AppModule {}
