import { Module } from "@nestjs/common";
import { CustomerAnalysisModule } from "./customer-analysis/customer-analysis.module";
import { CrmModule } from "./crm/crm.module";
import { HealthController } from "./health/health.controller";
import { QaModule } from "./qa/qa.module";
import { ProposalModule } from "./proposal/proposal.module";
import { RagflowModule } from "./ragflow/ragflow.module";

@Module({
  controllers: [HealthController],
  imports: [CrmModule, CustomerAnalysisModule, QaModule, ProposalModule, RagflowModule]
})
export class AppModule {}
