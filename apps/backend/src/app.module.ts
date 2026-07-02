import { Module } from "@nestjs/common";
import { HealthController } from "./health/health.controller";
import { RagflowModule } from "./ragflow/ragflow.module";

@Module({
  controllers: [HealthController],
  imports: [RagflowModule]
})
export class AppModule {}
