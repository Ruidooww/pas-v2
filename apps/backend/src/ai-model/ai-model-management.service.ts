import type { AuditLogService } from "../audit/audit-log.service";
import type { RagflowClient, RagflowDatasetOverview } from "../ragflow/ragflow.client";
import { AiModelConfigurationService } from "./ai-model-configuration.service";
import { AiModelError, type AiModelErrorCode } from "./ai-model.errors";
import { MODEL_PROVIDER_PRESETS, normalizeModelEndpoint, validateModelTimeout } from "./ai-model.endpoint-policy";
import type {
  ActiveAiModelConfig,
  AiModelCandidateRequest,
  AiModelOverview,
  AiModelProvider,
  AiModelProviderPreset,
  AiModelTestResult,
  OpenAiCompatibleTransportPort,
  PersistedAiModelConfiguration,
  RagflowModelOverview
} from "./ai-model.types";

const PROVIDER_PRESETS: AiModelProviderPreset[] = [
  { provider: "bailian", label: "百炼 (Bailian)", defaultBaseUrl: MODEL_PROVIDER_PRESETS.bailian },
  { provider: "deepseek", label: "DeepSeek", defaultBaseUrl: MODEL_PROVIDER_PRESETS.deepseek },
  { provider: "openai", label: "OpenAI", defaultBaseUrl: MODEL_PROVIDER_PRESETS.openai },
  { provider: "custom", label: "自定义", defaultBaseUrl: "" }
];

const OPTIONAL_RAGFLOW_FIELDS = [
  "name",
  "embeddingModel",
  "rerankerModel",
  "chatModel",
  "language",
  "chunkMethod",
  "documentCount",
  "chunkCount"
] as const;

export class AiModelManagementService {
  constructor(
    private readonly configuration: AiModelConfigurationService,
    private readonly transport: OpenAiCompatibleTransportPort,
    private readonly audit: AuditLogService,
    private readonly ragflow: RagflowClient,
    private readonly qaDatasetId: string,
    private readonly now: () => number = () => Date.now()
  ) {
    this.recordHydrationFailure();
  }

  getOverview(): AiModelOverview {
    const snapshot = this.configuration.getSnapshot();
    const persisted = this.configuration.getPersistedConfiguration();
    const generation = {
      status: snapshot.status,
      source: snapshot.source,
      ...(snapshot.status !== "not_configured" && snapshot.provider ? { provider: snapshot.provider } : {}),
      ...(snapshot.status !== "not_configured" && snapshot.baseUrl ? { baseUrl: snapshot.baseUrl } : {}),
      ...(snapshot.status !== "not_configured" && snapshot.model ? { model: snapshot.model } : {}),
      keyConfigured: snapshot.status !== "not_configured",
      timeoutSeconds: Math.round(snapshot.timeoutMs / 1000),
      ...(snapshot.status === "error" ? { errorCode: snapshot.errorCode } : {}),
      ...(persisted
        ? {
            lastTestStatus: persisted.lastTestStatus,
            lastTestedAt: persisted.lastTestedAt,
            updatedBy: persisted.updatedBy,
            updatedAt: persisted.updatedAt
          }
        : {})
    };

    return {
      providers: PROVIDER_PRESETS.map((preset) => ({ ...preset })),
      generation,
      ...(persisted
        ? {
            savedConfiguration: {
              enabled: persisted.enabled,
              provider: persisted.provider,
              baseUrl: persisted.baseUrl,
              model: persisted.model,
              keyConfigured: hasEncryptedKey(persisted),
              timeoutSeconds: Math.round(persisted.timeoutMs / 1000),
              lastTestStatus: persisted.lastTestStatus,
              lastTestedAt: persisted.lastTestedAt,
              updatedBy: persisted.updatedBy,
              updatedAt: persisted.updatedAt
            }
          }
        : {})
    };
  }

  async testGeneration(actorUserId: string, request: AiModelCandidateRequest): Promise<AiModelTestResult> {
    const startedAt = this.now();
    let prepared: ActiveAiModelConfig | undefined;
    try {
      prepared = this.prepareCandidate(request, this.resolveTestApiKey(request.apiKey));
      await this.runConnectionTest(prepared);
      const result = successfulTest(prepared, elapsed(startedAt, this.now()));
      this.recordConfigurationAudit(actorUserId, "test", prepared, result);
      return result;
    } catch (error) {
      const modelError = asAiModelError(error, "MODEL_PROVIDER_UNAVAILABLE");
      const result = failedTest(request, elapsed(startedAt, this.now()), modelError.code);
      this.recordConfigurationAudit(actorUserId, "test", prepared ?? request, result);
      return result;
    }
  }

  async saveGeneration(actorUserId: string, request: AiModelCandidateRequest): Promise<AiModelOverview> {
    const startedAt = this.now();
    let prepared: ActiveAiModelConfig | undefined;
    try {
      const existing = this.configuration.getPersistedConfiguration();
      const submittedApiKey = normalizeOptionalSecret(request.apiKey);
      if (!existing && !submittedApiKey) {
        throw new AiModelError("MODEL_API_KEY_REQUIRED", "The first database configuration requires an API key");
      }

      const apiKey = submittedApiKey || this.configuration.getPersistedApiKey();
      if (!apiKey) {
        throw new AiModelError("MODEL_API_KEY_REQUIRED", "A model API key is required");
      }
      prepared = this.prepareCandidate(request, apiKey);
      await this.runConnectionTest(prepared);
      const testedAt = new Date(this.now()).toISOString();
      const encrypted = submittedApiKey
        ? this.configuration.encryptApiKeyForPersistence(submittedApiKey)
        : pickEncryptedKey(existing!);
      const persisted: PersistedAiModelConfiguration = {
        id: "generation-default",
        provider: prepared.provider,
        baseUrl: prepared.baseUrl,
        model: prepared.model,
        ...encrypted,
        timeoutMs: prepared.timeoutMs,
        enabled: true,
        lastTestStatus: "passed",
        lastTestedAt: testedAt,
        updatedBy: actorUserId,
        createdAt: existing?.createdAt ?? testedAt,
        updatedAt: testedAt
      };

      try {
        await this.configuration.activatePersistedConfiguration(persisted, apiKey);
      } catch (error) {
        throw asAiModelError(error, "MODEL_PERSISTENCE_UNAVAILABLE");
      }

      const result = successfulTest(prepared, elapsed(startedAt, this.now()));
      this.recordConfigurationAudit(actorUserId, "save", prepared, result);
      return this.getOverview();
    } catch (error) {
      const modelError = asAiModelError(error, "MODEL_CONFIGURATION_INVALID");
      const result = failedTest(request, elapsed(startedAt, this.now()), modelError.code);
      this.recordConfigurationAudit(actorUserId, "save", prepared ?? request, result);
      throw modelError;
    }
  }

  async disableGeneration(actorUserId: string): Promise<AiModelOverview> {
    const persisted = this.configuration.getPersistedConfiguration();
    try {
      await this.configuration.disablePersistedConfiguration(actorUserId);
      this.recordConfigurationAudit(actorUserId, "disable", persisted, {
        ok: true,
        provider: persisted?.provider ?? "custom",
        model: persisted?.model ?? "",
        elapsedMs: 0
      });
      return this.getOverview();
    } catch (error) {
      const modelError = asAiModelError(error, "MODEL_PERSISTENCE_UNAVAILABLE");
      this.recordConfigurationAudit(actorUserId, "disable", persisted, {
        ok: false,
        provider: persisted?.provider ?? "custom",
        model: persisted?.model ?? "",
        elapsedMs: 0,
        errorCode: modelError.code
      });
      throw modelError;
    }
  }

  async getRagflowOverview(): Promise<RagflowModelOverview> {
    const refreshedAt = new Date(this.now()).toISOString();
    const health = await this.ragflow.checkHealth();
    if (health.status === "disabled") {
      return { status: "disabled", baseUrl: health.baseUrl, unavailableFields: [], refreshedAt };
    }
    if (health.status === "error") {
      return {
        status: "error",
        baseUrl: health.baseUrl,
        unavailableFields: [],
        errorKind: health.errorKind,
        refreshedAt
      };
    }

    const datasetId = this.qaDatasetId.trim();
    if (!datasetId) {
      return {
        status: "ok",
        baseUrl: health.baseUrl,
        unavailableFields: ["dataset"],
        refreshedAt
      };
    }

    let dataset: RagflowDatasetOverview = { datasetId };
    try {
      dataset = (await this.ragflow.getDatasetOverview(datasetId)) ?? dataset;
    } catch {
      // Dataset metadata is optional; retrieval health remains authoritative.
    }
    return {
      status: "ok",
      baseUrl: health.baseUrl,
      dataset,
      unavailableFields: OPTIONAL_RAGFLOW_FIELDS.filter((field) => dataset[field] === undefined),
      refreshedAt
    };
  }

  private prepareCandidate(request: AiModelCandidateRequest, apiKey: string): ActiveAiModelConfig {
    assertProvider(request.provider);
    const model = request.model?.trim();
    if (!model) {
      throw new AiModelError("MODEL_CONFIGURATION_INVALID", "Model identifier is required");
    }
    const timeoutMs = validateModelTimeout(Number(request.timeoutSeconds) * 1000);
    return {
      provider: request.provider,
      baseUrl: normalizeModelEndpoint(request.provider, request.baseUrl ?? ""),
      model,
      apiKey,
      timeoutMs
    };
  }

  private resolveTestApiKey(submittedApiKey: string | undefined): string {
    const submitted = normalizeOptionalSecret(submittedApiKey);
    if (submitted) {
      return submitted;
    }

    const persisted = this.configuration.getPersistedConfiguration();
    if (persisted) {
      const persistedApiKey = this.configuration.getPersistedApiKey();
      if (persistedApiKey) {
        return persistedApiKey;
      }
    }

    const snapshot = this.configuration.getSnapshot();
    if (snapshot.status === "running") {
      return snapshot.apiKey;
    }
    throw new AiModelError("MODEL_API_KEY_REQUIRED", "A model API key is required");
  }

  private async runConnectionTest(config: ActiveAiModelConfig): Promise<void> {
    await this.transport.complete(config, {
      system: "Return a short non-empty acknowledgement.",
      prompt: "Reply with OK.",
      temperature: 0,
      maxTokens: 8
    });
  }

  private recordConfigurationAudit(
    actorUserId: string,
    operation: "test" | "save" | "disable",
    config: Pick<AiModelCandidateRequest, "provider" | "model"> | undefined,
    result: AiModelTestResult
  ): void {
    this.audit.record({
      action: "ai_model_configuration",
      actorUserId,
      objectType: "ai_model_configuration",
      objectId: "generation-default",
      result: result.ok ? "success" : "failure",
      ...(result.errorCode ? { failureReason: result.errorCode } : {}),
      metadata: {
        operation,
        provider: config?.provider ?? result.provider,
        model: config?.model?.trim() ?? result.model,
        elapsedMs: result.elapsedMs,
        testResult: result.ok ? "passed" : "failed",
        ...(result.errorCode ? { errorCode: result.errorCode } : {})
      }
    });
  }

  private recordHydrationFailure(): void {
    const snapshot = this.configuration.getSnapshot();
    if (snapshot.status !== "error" || snapshot.source !== "database") {
      return;
    }

    this.audit.record({
      action: "ai_model_configuration",
      objectType: "ai_model_configuration",
      objectId: "generation-default",
      result: "failure",
      failureReason: snapshot.errorCode,
      metadata: {
        operation: "hydrate",
        provider: snapshot.provider ?? "custom",
        model: snapshot.model ?? "",
        elapsedMs: 0,
        testResult: "failed",
        errorCode: snapshot.errorCode
      }
    });
  }
}

function successfulTest(config: ActiveAiModelConfig, elapsedMs: number): AiModelTestResult {
  return { ok: true, provider: config.provider, model: config.model, elapsedMs };
}

function failedTest(
  request: Pick<AiModelCandidateRequest, "provider" | "model">,
  elapsedMs: number,
  errorCode: AiModelErrorCode
): AiModelTestResult {
  return {
    ok: false,
    provider: isProvider(request.provider) ? request.provider : "custom",
    model: request.model?.trim() || "",
    elapsedMs,
    errorCode
  };
}

function assertProvider(provider: string): asserts provider is AiModelProvider {
  if (!isProvider(provider)) {
    throw new AiModelError("MODEL_CONFIGURATION_INVALID", "Unsupported model provider");
  }
}

function isProvider(provider: string): provider is AiModelProvider {
  return provider in MODEL_PROVIDER_PRESETS;
}

function normalizeOptionalSecret(value: string | undefined): string | undefined {
  return value?.trim() || undefined;
}

function pickEncryptedKey(configuration: PersistedAiModelConfiguration) {
  return {
    encryptedApiKey: configuration.encryptedApiKey,
    apiKeyIv: configuration.apiKeyIv,
    apiKeyAuthTag: configuration.apiKeyAuthTag
  };
}

function hasEncryptedKey(configuration: PersistedAiModelConfiguration): boolean {
  return Boolean(configuration.encryptedApiKey && configuration.apiKeyIv && configuration.apiKeyAuthTag);
}

function asAiModelError(error: unknown, fallbackCode: AiModelErrorCode): AiModelError {
  return error instanceof AiModelError ? error : new AiModelError(fallbackCode, "AI model operation failed");
}

function elapsed(startedAt: number, finishedAt: number): number {
  return Math.max(0, Math.round(finishedAt - startedAt));
}
