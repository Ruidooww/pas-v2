import { Module } from "@nestjs/common";
import { createRagflowConfig, type RagflowConfig } from "./ragflow.config";
import { RagflowClient } from "./ragflow.client";
import { RagflowController } from "./ragflow.controller";
import { RAGFLOW_CONFIG } from "./ragflow.tokens";

@Module({
  controllers: [RagflowController],
  providers: [
    {
      provide: RAGFLOW_CONFIG,
      useFactory: (): RagflowConfig => createRagflowConfig()
    },
    {
      provide: RagflowClient,
      useFactory: (config: RagflowConfig): RagflowClient => new RagflowClient(config),
      inject: [RAGFLOW_CONFIG]
    }
  ],
  exports: [RagflowClient]
})
export class RagflowModule {}
