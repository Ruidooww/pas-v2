import type { AiModelErrorCode } from "./ai-model.errors";

export type AiModelProvider = "bailian" | "deepseek" | "openai" | "custom";

export type ModelTestStatus = "passed" | "failed";

export type PersistedAiModelConfiguration = {
  id: "generation-default";
  provider: AiModelProvider;
  baseUrl: string;
  model: string;
  encryptedApiKey: string;
  apiKeyIv: string;
  apiKeyAuthTag: string;
  timeoutMs: number;
  enabled: boolean;
  lastTestStatus: ModelTestStatus;
  lastTestedAt: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
};

export type EncryptedSecret = Pick<
  PersistedAiModelConfiguration,
  "encryptedApiKey" | "apiKeyIv" | "apiKeyAuthTag"
>;

export type AiModelConfigurationPersistence = {
  loadAiModelConfiguration(): Promise<PersistedAiModelConfiguration | undefined>;
  saveAiModelConfiguration(configuration: PersistedAiModelConfiguration): Promise<void>;
};

export type ActiveAiModelConfig = {
  provider: AiModelProvider;
  baseUrl: string;
  model: string;
  apiKey: string;
  timeoutMs: number;
};

export type EffectiveAiModelSnapshot =
  | (Readonly<ActiveAiModelConfig> & {
      readonly status: "running";
      readonly source: "database" | "environment";
    })
  | Readonly<{
      status: "not_configured";
      source: "mock";
      timeoutMs: number;
    }>
  | Readonly<{
      status: "error";
      source: "database" | "environment";
      provider?: AiModelProvider;
      baseUrl?: string;
      model?: string;
      timeoutMs: number;
      errorCode: AiModelErrorCode;
    }>;

export type AiModelRuntimePort = {
  getSnapshot(): EffectiveAiModelSnapshot;
};

export type AiModelCompletionRequest = {
  system?: string;
  prompt: string;
  temperature?: number;
  maxTokens?: number;
};

export type AiModelTransportCompletion = {
  content: string;
  model: string;
};

export type OpenAiCompatibleTransportPort = {
  complete(
    config: ActiveAiModelConfig,
    request: AiModelCompletionRequest
  ): Promise<AiModelTransportCompletion>;
};
