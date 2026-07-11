import type { LlmConfig } from "../llm/llm.config";
import { decryptApiKey } from "./ai-model.crypto";
import { AiModelError } from "./ai-model.errors";
import { MODEL_PROVIDER_PRESETS, normalizeModelEndpoint, validateModelTimeout } from "./ai-model.endpoint-policy";
import type {
  ActiveAiModelConfig,
  AiModelConfigurationPersistence,
  AiModelProvider,
  AiModelRuntimePort,
  EffectiveAiModelSnapshot,
  PersistedAiModelConfiguration
} from "./ai-model.types";

type ConfigurationOptions = {
  encryptionKey?: string;
  endpointAllowlist?: string;
};

export class AiModelConfigurationService implements AiModelRuntimePort {
  private persistedConfiguration?: PersistedAiModelConfiguration;
  private snapshot: EffectiveAiModelSnapshot;

  constructor(
    private readonly persistence: AiModelConfigurationPersistence,
    private readonly environmentConfig: LlmConfig,
    private readonly options: ConfigurationOptions = {}
  ) {
    this.snapshot = createMockSnapshot(environmentConfig.timeoutMs);
  }

  async initialize(): Promise<void> {
    this.persistedConfiguration = clonePersisted(await this.persistence.loadAiModelConfiguration());
    this.snapshot = this.resolveSnapshot();
  }

  getSnapshot(): EffectiveAiModelSnapshot {
    return this.snapshot;
  }

  getPersistedConfiguration(): PersistedAiModelConfiguration | undefined {
    return clonePersisted(this.persistedConfiguration);
  }

  async activatePersistedConfiguration(
    configuration: PersistedAiModelConfiguration,
    plaintextApiKey: string
  ): Promise<void> {
    const normalized = normalizePersistedConfiguration(configuration, this.options.endpointAllowlist);
    const nextSnapshot = createRunningSnapshot("database", normalized, plaintextApiKey);

    await this.persistence.saveAiModelConfiguration(normalized);
    this.persistedConfiguration = clonePersisted(normalized);
    this.snapshot = nextSnapshot;
  }

  async disablePersistedConfiguration(actorUserId: string): Promise<void> {
    const current = this.persistedConfiguration;
    if (!current) {
      this.snapshot = this.resolveEnvironmentSnapshot();
      return;
    }

    const disabled: PersistedAiModelConfiguration = {
      ...current,
      enabled: false,
      updatedBy: actorUserId,
      updatedAt: new Date().toISOString()
    };
    const nextSnapshot = this.resolveEnvironmentSnapshot();

    await this.persistence.saveAiModelConfiguration(disabled);
    this.persistedConfiguration = disabled;
    this.snapshot = nextSnapshot;
  }

  private resolveSnapshot(): EffectiveAiModelSnapshot {
    const persisted = this.persistedConfiguration;
    if (!persisted?.enabled) {
      return this.resolveEnvironmentSnapshot();
    }

    try {
      const normalized = normalizePersistedConfiguration(persisted, this.options.endpointAllowlist);
      const apiKey = decryptApiKey(normalized, this.options.encryptionKey);
      return createRunningSnapshot("database", normalized, apiKey);
    } catch (error) {
      return createErrorSnapshot("database", persisted, toAiModelError(error));
    }
  }

  private resolveEnvironmentSnapshot(): EffectiveAiModelSnapshot {
    const config = this.environmentConfig;
    if (config.mode !== "real" || !config.apiKey.trim()) {
      return createMockSnapshot(config.timeoutMs);
    }

    const provider = inferProvider(config.baseUrl);
    try {
      const active: ActiveAiModelConfig = {
        provider,
        baseUrl: normalizeModelEndpoint(provider, config.baseUrl, this.options.endpointAllowlist),
        model: requireNonBlank(config.model, "Model identifier is required"),
        apiKey: config.apiKey,
        timeoutMs: validateModelTimeout(config.timeoutMs)
      };
      return Object.freeze({ status: "running", source: "environment", ...active });
    } catch (error) {
      return createErrorSnapshot(
        "environment",
        { provider, baseUrl: config.baseUrl, model: config.model, timeoutMs: config.timeoutMs },
        toAiModelError(error)
      );
    }
  }
}

function normalizePersistedConfiguration(
  configuration: PersistedAiModelConfiguration,
  endpointAllowlist: string | undefined
): PersistedAiModelConfiguration {
  assertProvider(configuration.provider);
  return {
    ...configuration,
    baseUrl: normalizeModelEndpoint(configuration.provider, configuration.baseUrl, endpointAllowlist),
    model: requireNonBlank(configuration.model, "Model identifier is required"),
    timeoutMs: validateModelTimeout(configuration.timeoutMs)
  };
}

function createRunningSnapshot(
  source: "database" | "environment",
  config: Pick<PersistedAiModelConfiguration, "provider" | "baseUrl" | "model" | "timeoutMs">,
  apiKey: string
): EffectiveAiModelSnapshot {
  return Object.freeze({
    status: "running",
    source,
    provider: config.provider,
    baseUrl: config.baseUrl,
    model: config.model,
    apiKey: requireNonBlank(apiKey, "Model API key is required"),
    timeoutMs: config.timeoutMs
  });
}

function createMockSnapshot(timeoutMs: number): EffectiveAiModelSnapshot {
  return Object.freeze({
    status: "not_configured",
    source: "mock",
    timeoutMs: Number.isInteger(timeoutMs) ? timeoutMs : 30_000
  });
}

function createErrorSnapshot(
  source: "database" | "environment",
  config: { provider?: AiModelProvider; baseUrl?: string; model?: string; timeoutMs: number },
  error: AiModelError
): EffectiveAiModelSnapshot {
  return Object.freeze({
    status: "error",
    source,
    ...(config.provider ? { provider: config.provider } : {}),
    ...(config.baseUrl ? { baseUrl: config.baseUrl } : {}),
    ...(config.model ? { model: config.model } : {}),
    timeoutMs: Number.isInteger(config.timeoutMs) ? config.timeoutMs : 30_000,
    errorCode: error.code
  });
}

function inferProvider(baseUrl: string): AiModelProvider {
  let host = "";
  try {
    host = new URL(baseUrl).host.toLowerCase();
  } catch {
    return "custom";
  }

  for (const provider of ["bailian", "deepseek", "openai"] as const) {
    if (host === new URL(MODEL_PROVIDER_PRESETS[provider]).host.toLowerCase()) {
      return provider;
    }
  }
  return "custom";
}

function assertProvider(provider: string): asserts provider is AiModelProvider {
  if (!(provider in MODEL_PROVIDER_PRESETS)) {
    throw new AiModelError("MODEL_CONFIGURATION_INVALID", "Unsupported model provider");
  }
}

function requireNonBlank(value: string, message: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new AiModelError("MODEL_CONFIGURATION_INVALID", message);
  }
  return normalized;
}

function toAiModelError(error: unknown): AiModelError {
  return error instanceof AiModelError
    ? error
    : new AiModelError("MODEL_CONFIGURATION_INVALID", "AI model configuration is invalid");
}

function clonePersisted(
  configuration: PersistedAiModelConfiguration | undefined
): PersistedAiModelConfiguration | undefined {
  return configuration ? { ...configuration } : undefined;
}
