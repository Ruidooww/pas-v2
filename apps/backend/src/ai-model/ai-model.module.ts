import { Module } from "@nestjs/common";
import { createLlmConfig } from "../llm/llm.config";
import { PersistenceModule } from "../persistence/persistence.module";
import type { PersistenceSink } from "../persistence/persistence-sink";
import { PERSISTENCE_SINK } from "../persistence/persistence.tokens";
import { AiModelConfigurationService } from "./ai-model-configuration.service";
import { AI_MODEL_CONFIGURATION, AI_MODEL_RUNTIME, AI_MODEL_TRANSPORT } from "./ai-model.tokens";
import { OpenAiCompatibleTransport } from "./openai-compatible.transport";

@Module({
  imports: [PersistenceModule],
  providers: [
    {
      provide: AI_MODEL_CONFIGURATION,
      useFactory: async (persistence: PersistenceSink): Promise<AiModelConfigurationService> => {
        const service = new AiModelConfigurationService(persistence, createLlmConfig(), {
          encryptionKey: process.env.MODEL_CONFIG_ENCRYPTION_KEY,
          endpointAllowlist: process.env.MODEL_ENDPOINT_ALLOWLIST
        });
        await service.initialize();
        return service;
      },
      inject: [PERSISTENCE_SINK]
    },
    {
      provide: AI_MODEL_RUNTIME,
      useExisting: AI_MODEL_CONFIGURATION
    },
    {
      provide: AI_MODEL_TRANSPORT,
      useFactory: (): OpenAiCompatibleTransport => new OpenAiCompatibleTransport()
    }
  ],
  exports: [AI_MODEL_CONFIGURATION, AI_MODEL_RUNTIME, AI_MODEL_TRANSPORT]
})
export class AiModelModule {}
