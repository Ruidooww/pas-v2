import { Module } from "@nestjs/common";
import { createRagflowConfig, type RagflowConfig } from "./ragflow.config";
import { RagflowClient } from "./ragflow.client";
import { RagflowController } from "./ragflow.controller";
import { RAGFLOW_CLIENT, RAGFLOW_CONFIG } from "./ragflow.tokens";

@Module({
  controllers: [RagflowController],
  providers: [
    {
      provide: RAGFLOW_CONFIG,
      useFactory: (): RagflowConfig => createRagflowConfig()
    },
    {
      provide: RAGFLOW_CLIENT,
      useFactory: (config: RagflowConfig): RagflowClient => new RagflowClient(config),
      inject: [RAGFLOW_CONFIG]
    }
  ],
  exports: [RAGFLOW_CLIENT]
})
export class RagflowModule {}
