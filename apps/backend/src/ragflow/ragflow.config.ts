export type RagflowClientMode = "real" | "disabled";

export type RagflowConfig = {
  apiKey: string;
  baseUrl: string;
  clientMode: RagflowClientMode;
  pasKbId: string;
  qaKbId: string;
};

type RagflowEnv = Partial<
  Record<"RAGFLOW_API_KEY" | "RAGFLOW_BASE_URL" | "RAGFLOW_CLIENT_MODE" | "PAS_KB_ID" | "QA_KB_ID", string>
>;

const DEFAULT_RAGFLOW_BASE_URL = "http://host.docker.internal:19380";

export function createRagflowConfig(env: RagflowEnv = process.env): RagflowConfig {
  const rawMode = env.RAGFLOW_CLIENT_MODE?.trim();

  return {
    apiKey: env.RAGFLOW_API_KEY?.trim() || "",
    baseUrl: normalizeBaseUrl(env.RAGFLOW_BASE_URL || DEFAULT_RAGFLOW_BASE_URL),
    clientMode: rawMode === "disabled" ? "disabled" : "real",
    pasKbId: env.PAS_KB_ID?.trim() || "",
    qaKbId: env.QA_KB_ID?.trim() || ""
  };
}

function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, "");
}
