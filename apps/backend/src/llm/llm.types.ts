export type LlmCompleteRequest = {
  system?: string;
  prompt: string;
  temperature?: number;
  maxTokens?: number;
};

export type LlmCompletion = {
  content: string;
  model: string;
  mode: "real" | "mock";
  provider?: AiModelProvider;
  source: "database" | "environment" | "mock";
};

export type LlmClientPort = {
  complete(request: LlmCompleteRequest): Promise<LlmCompletion>;
};
import type { AiModelProvider } from "../ai-model/ai-model.types";
