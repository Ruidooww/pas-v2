export type RagflowClientMode = "real" | "disabled";

export type RagflowConfig = {
  apiKey: string;
  baseUrl: string;
  clientMode: RagflowClientMode;
  fallbackQueryPrefix: string;
  keywordEnabled: boolean;
  pasKbId: string;
  qaKbId: string;
};

type RagflowEnv = Partial<
  Record<
    | "RAGFLOW_API_KEY"
    | "RAGFLOW_BASE_URL"
    | "RAGFLOW_CLIENT_MODE"
    | "RAGFLOW_FALLBACK_QUERY_PREFIX"
    | "RAGFLOW_KEYWORD_ENABLED"
    | "PAS_KB_ID"
    | "QA_KB_ID",
    string
  >
>;

const DEFAULT_RAGFLOW_BASE_URL = "http://host.docker.internal:19380";
const DEFAULT_RAGFLOW_FALLBACK_QUERY_PREFIX = "IP-Guard";

export function createRagflowConfig(env: RagflowEnv = process.env): RagflowConfig {
  const rawMode = env.RAGFLOW_CLIENT_MODE?.trim();

  return {
    apiKey: env.RAGFLOW_API_KEY?.trim() || "",
    baseUrl: normalizeBaseUrl(env.RAGFLOW_BASE_URL || DEFAULT_RAGFLOW_BASE_URL),
    clientMode: rawMode === "disabled" ? "disabled" : "real",
    fallbackQueryPrefix: parseFallbackQueryPrefix(env.RAGFLOW_FALLBACK_QUERY_PREFIX),
    keywordEnabled: parseEnabledDefaultTrue(env.RAGFLOW_KEYWORD_ENABLED),
    pasKbId: env.PAS_KB_ID?.trim() || "",
    qaKbId: env.QA_KB_ID?.trim() || ""
  };
}

function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

function parseEnabledDefaultTrue(value: string | undefined): boolean {
  const normalized = value?.trim().toLowerCase();
  return normalized !== "false" && normalized !== "0";
}

function parseFallbackQueryPrefix(value: string | undefined): string {
  return value === undefined ? DEFAULT_RAGFLOW_FALLBACK_QUERY_PREFIX : value.trim();
}
