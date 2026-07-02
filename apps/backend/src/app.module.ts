import { Module } from "@nestjs/common";
import { CrmModule } from "./crm/crm.module";
import { HealthController } from "./health/health.controller";
import { RagflowModule } from "./ragflow/ragflow.module";

@Module({
  controllers: [HealthController],
  imports: [CrmModule, RagflowModule]
})
export class AppModule {}
