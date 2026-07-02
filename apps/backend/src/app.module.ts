import { Module } from "@nestjs/common";
import { CrmModule } from "./crm/crm.module";
import { HealthController } from "./health/health.controller";
import { QaModule } from "./qa/qa.module";
import { RagflowModule } from "./ragflow/ragflow.module";

@Module({
  controllers: [HealthController],
  imports: [CrmModule, QaModule, RagflowModule]
})
export class AppModule {}
