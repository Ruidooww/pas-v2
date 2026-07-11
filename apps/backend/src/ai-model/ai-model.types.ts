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
