import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import type { AuditLogService } from "../audit/audit-log.service";
import { AUDIT_LOG } from "../audit/audit.tokens";
import { createLlmConfig } from "../llm/llm.config";
import { PersistenceModule } from "../persistence/persistence.module";
import type { PersistenceSink } from "../persistence/persistence-sink";
import { PERSISTENCE_SINK } from "../persistence/persistence.tokens";
import type { RagflowClient } from "../ragflow/ragflow.client";
import { RagflowModule } from "../ragflow/ragflow.module";
import { RAGFLOW_CLIENT } from "../ragflow/ragflow.tokens";
import { AiModelConfigurationService } from "./ai-model-configuration.service";
import { AiModelController } from "./ai-model.controller";
import { AiModelManagementService } from "./ai-model-management.service";
import { AI_MODEL_CONFIGURATION, AI_MODEL_MANAGEMENT, AI_MODEL_RUNTIME, AI_MODEL_TRANSPORT } from "./ai-model.tokens";
import type { OpenAiCompatibleTransportPort } from "./ai-model.types";
import { OpenAiCompatibleTransport } from "./openai-compatible.transport";

@Module({
  controllers: [AiModelController],
  imports: [PersistenceModule, AuditModule, RagflowModule],
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
    },
    {
      provide: AI_MODEL_MANAGEMENT,
      useFactory: (
        configuration: AiModelConfigurationService,
        transport: OpenAiCompatibleTransportPort,
        audit: AuditLogService,
        ragflow: RagflowClient
      ): AiModelManagementService =>
        new AiModelManagementService(
          configuration,
          transport,
          audit,
          ragflow,
          process.env.QA_KB_ID?.trim() || process.env.PAS_KB_ID?.trim() || ""
        ),
      inject: [AI_MODEL_CONFIGURATION, AI_MODEL_TRANSPORT, AUDIT_LOG, RAGFLOW_CLIENT]
    }
  ],
  exports: [AI_MODEL_CONFIGURATION, AI_MODEL_MANAGEMENT, AI_MODEL_RUNTIME, AI_MODEL_TRANSPORT]
})
export class AiModelModule {}
