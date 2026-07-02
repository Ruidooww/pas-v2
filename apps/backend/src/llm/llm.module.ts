import { Module } from "@nestjs/common";
import { LlmClient } from "./llm.client";
import { createLlmConfig, type LlmConfig } from "./llm.config";
import { LLM_CLIENT, LLM_CONFIG } from "./llm.tokens";

@Module({
  providers: [
    {
      provide: LLM_CONFIG,
      useFactory: (): LlmConfig => createLlmConfig()
    },
    {
      provide: LLM_CLIENT,
      useFactory: (config: LlmConfig): LlmClient => new LlmClient(config),
      inject: [LLM_CONFIG]
    }
  ],
  exports: [LLM_CLIENT]
})
export class LlmModule {}
