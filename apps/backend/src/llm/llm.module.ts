import { Module } from "@nestjs/common";
import { AiModelModule } from "../ai-model/ai-model.module";
import { AI_MODEL_RUNTIME, AI_MODEL_TRANSPORT } from "../ai-model/ai-model.tokens";
import type { AiModelRuntimePort, OpenAiCompatibleTransportPort } from "../ai-model/ai-model.types";
import { LlmClient } from "./llm.client";
import { LLM_CLIENT } from "./llm.tokens";

@Module({
  imports: [AiModelModule],
  providers: [
    {
      provide: LLM_CLIENT,
      useFactory: (runtime: AiModelRuntimePort, transport: OpenAiCompatibleTransportPort): LlmClient =>
        new LlmClient(runtime, transport),
      inject: [AI_MODEL_RUNTIME, AI_MODEL_TRANSPORT]
    }
  ],
  exports: [LLM_CLIENT]
})
export class LlmModule {}
