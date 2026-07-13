export type CrmClientMode = "mock" | "external";

export type CrmConfig = {
  clientMode: CrmClientMode;
  baseUrl: string;
  apiToken: string;
  timeoutMs: number;
};

type CrmEnv = Partial<
  Record<"CRM_CLIENT_MODE" | "CRM_BASE_URL" | "CRM_API_TOKEN" | "CRM_TIMEOUT_MS", string>
>;

const DEFAULT_TIMEOUT_MS = 10000;
const MIN_TIMEOUT_MS = 1000;
const MAX_TIMEOUT_MS = 30000;

export function createCrmConfig(env: CrmEnv = process.env): CrmConfig {
  const clientMode = env.CRM_CLIENT_MODE?.trim() === "external" ? "external" : "mock";
  const timeoutMs = parseTimeout(env.CRM_TIMEOUT_MS);
  if (clientMode === "mock") {
    return { clientMode, baseUrl: "", apiToken: "", timeoutMs };
  }

  return {
    clientMode,
    baseUrl: normalizeExternalBaseUrl(env.CRM_BASE_URL),
    apiToken: required(env.CRM_API_TOKEN, "CRM_API_TOKEN"),
    timeoutMs
  };
}

function normalizeExternalBaseUrl(value: string | undefined): string {
  const raw = required(value, "CRM_BASE_URL");
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("CRM_BASE_URL is invalid");
  }
  if (
    url.protocol !== "https:" ||
    url.hostname !== "demo.sworditsys.com" ||
    url.port ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname.replace(/\/+$/, "") !== "/api/v1"
  ) {
    throw new Error("CRM_BASE_URL must be https://demo.sworditsys.com/api/v1");
  }
  return "https://demo.sworditsys.com/api/v1";
}

function required(value: string | undefined, name: string): string {
  const normalized = value?.trim() || "";
  if (!normalized) throw new Error(`${name} is required in external mode`);
  return normalized;
}

function parseTimeout(value: string | undefined): number {
  const timeoutMs = value === undefined || value.trim() === "" ? DEFAULT_TIMEOUT_MS : Number(value);
  if (!Number.isInteger(timeoutMs) || timeoutMs < MIN_TIMEOUT_MS || timeoutMs > MAX_TIMEOUT_MS) {
    throw new Error(`CRM_TIMEOUT_MS must be an integer from ${MIN_TIMEOUT_MS} to ${MAX_TIMEOUT_MS}`);
  }
  return timeoutMs;
}
