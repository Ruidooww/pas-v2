import { AiModelError } from "./ai-model.errors";
import type { AiModelProvider } from "./ai-model.types";

export const MODEL_PROVIDER_PRESETS = {
  bailian: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  deepseek: "https://api.deepseek.com",
  openai: "https://api.openai.com/v1",
  custom: ""
} as const;

const MIN_TIMEOUT_MS = 5_000;
const MAX_TIMEOUT_MS = 120_000;

export function normalizeModelEndpoint(
  provider: AiModelProvider,
  baseUrl: string,
  rawAllowlist: string | undefined = process.env.MODEL_ENDPOINT_ALLOWLIST
): string {
  const url = parseUrl(baseUrl);
  const allowlist = parseAllowlist(rawAllowlist);
  const preset = MODEL_PROVIDER_PRESETS[provider];
  const presetHost = preset ? new URL(preset).host.toLowerCase() : "";
  const host = url.host.toLowerCase();
  const isPresetHost = Boolean(presetHost && host === presetHost);
  const isAllowlisted = allowlist.has(host);

  if (url.username || url.password || url.search || url.hash) {
    throw endpointNotAllowed();
  }
  if (url.protocol === "https:" && (isPresetHost || isAllowlisted)) {
    return stripTrailingSlashes(url.toString());
  }
  if (url.protocol === "http:" && provider === "custom" && isAllowlisted) {
    return stripTrailingSlashes(url.toString());
  }
  throw endpointNotAllowed();
}

export function validateModelTimeout(timeoutMs: number): number {
  if (!Number.isInteger(timeoutMs) || timeoutMs < MIN_TIMEOUT_MS || timeoutMs > MAX_TIMEOUT_MS) {
    throw new AiModelError("MODEL_CONFIGURATION_INVALID", "Model timeout must be between 5 and 120 seconds");
  }
  return timeoutMs;
}

function parseUrl(value: string): URL {
  try {
    if (!value.trim()) {
      throw new Error("blank URL");
    }
    return new URL(value.trim());
  } catch {
    throw endpointNotAllowed();
  }
}

function parseAllowlist(rawValue: string | undefined): Set<string> {
  const entries = (rawValue ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

  if (entries.some((entry) => entry.includes("*") || entry.includes("/") || entry.includes("://"))) {
    throw endpointNotAllowed();
  }
  return new Set(entries);
}

function stripTrailingSlashes(value: string): string {
  return value.replace(/\/+$/, "");
}

function endpointNotAllowed(): AiModelError {
  return new AiModelError("MODEL_ENDPOINT_NOT_ALLOWED", "Model endpoint is not allowed");
}
