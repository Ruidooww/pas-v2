export type LlmClientMode = "real" | "mock";

export type LlmConfig = {
  mode: LlmClientMode;
  baseUrl: string;
  apiKey: string;
  model: string;
  timeoutMs: number;
};

type LlmEnv = Partial<
  Record<"LLM_CLIENT_MODE" | "LLM_BASE_URL" | "LLM_API_KEY" | "LLM_MODEL" | "LLM_TIMEOUT_MS", string>
>;

const DEFAULT_LLM_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1";
const DEFAULT_LLM_MODEL = "qwen-max";
const DEFAULT_TIMEOUT_MS = 30_000;

export function createLlmConfig(env: LlmEnv = process.env): LlmConfig {
  const apiKey = env.LLM_API_KEY?.trim() || "";
  const rawMode = env.LLM_CLIENT_MODE?.trim();
  const mode: LlmClientMode = rawMode === "real" && apiKey ? "real" : "mock";

  return {
    mode,
    baseUrl: (env.LLM_BASE_URL?.trim() || DEFAULT_LLM_BASE_URL).replace(/\/+$/, ""),
    apiKey,
    model: env.LLM_MODEL?.trim() || DEFAULT_LLM_MODEL,
    timeoutMs: Number(env.LLM_TIMEOUT_MS?.trim() || DEFAULT_TIMEOUT_MS)
  };
}
