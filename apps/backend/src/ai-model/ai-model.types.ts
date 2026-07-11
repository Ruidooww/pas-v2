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

export type AiModelCandidateRequest = {
  provider: AiModelProvider;
  baseUrl: string;
  model: string;
  apiKey?: string;
  timeoutSeconds: number;
};

export type AiModelTestResult = {
  ok: boolean;
  provider: AiModelProvider;
  model: string;
  elapsedMs: number;
  errorCode?: AiModelErrorCode;
};

export type AiModelGenerationOverview = {
  status: EffectiveAiModelSnapshot["status"];
  source: EffectiveAiModelSnapshot["source"];
  provider?: AiModelProvider;
  baseUrl?: string;
  model?: string;
  keyConfigured: boolean;
  timeoutSeconds: number;
  errorCode?: AiModelErrorCode;
  lastTestStatus?: ModelTestStatus;
  lastTestedAt?: string;
  updatedBy?: string;
  updatedAt?: string;
};

export type SavedAiModelConfigurationOverview = {
  enabled: boolean;
  provider: AiModelProvider;
  baseUrl: string;
  model: string;
  keyConfigured: boolean;
  timeoutSeconds: number;
  lastTestStatus: ModelTestStatus;
  lastTestedAt: string;
  updatedBy: string;
  updatedAt: string;
};

export type AiModelProviderPreset = {
  provider: AiModelProvider;
  label: string;
  defaultBaseUrl: string;
};

export type AiModelOverview = {
  providers: AiModelProviderPreset[];
  generation: AiModelGenerationOverview;
  savedConfiguration?: SavedAiModelConfigurationOverview;
};

export type RagflowDatasetModelOverview = {
  datasetId: string;
  name?: string;
  embeddingModel?: string;
  rerankerModel?: string;
  chatModel?: string;
  language?: string;
  chunkMethod?: string;
  documentCount?: number;
  chunkCount?: number;
};

export type RagflowModelOverview = {
  status: "ok" | "error" | "disabled";
  baseUrl: string;
  dataset?: RagflowDatasetModelOverview;
  unavailableFields: string[];
  errorKind?: string;
  refreshedAt: string;
};
