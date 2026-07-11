import { describe, expect, it } from "vitest";
import { MODEL_PROVIDER_PRESETS, normalizeModelEndpoint, validateModelTimeout } from "./ai-model.endpoint-policy";

describe("AI model endpoint policy", () => {
  it.each([
    ["bailian", MODEL_PROVIDER_PRESETS.bailian],
    ["deepseek", MODEL_PROVIDER_PRESETS.deepseek],
    ["openai", MODEL_PROVIDER_PRESETS.openai]
  ] as const)("allows the canonical %s endpoint", (provider, baseUrl) => {
    expect(normalizeModelEndpoint(provider, `${baseUrl}/`, "")).toBe(baseUrl);
  });

  it("allows an exact custom HTTPS host from the deployment allowlist", () => {
    expect(normalizeModelEndpoint("custom", "https://models.internal.example/v1/", "models.internal.example")).toBe(
      "https://models.internal.example/v1"
    );
  });

  it("requires an exact host and port match", () => {
    expect(normalizeModelEndpoint("custom", "https://models.internal:8443/v1", "models.internal:8443")).toBe(
      "https://models.internal:8443/v1"
    );
    expectEndpointRejected("custom", "https://models.internal:8444/v1", "models.internal:8443");
    expectEndpointRejected("custom", "https://child.models.internal/v1", "models.internal");
  });

  it("allows HTTP only for an explicitly allowlisted custom endpoint", () => {
    expect(normalizeModelEndpoint("custom", "http://10.10.0.8:8080/v1", "10.10.0.8:8080")).toBe(
      "http://10.10.0.8:8080/v1"
    );
    expectEndpointRejected("bailian", "http://dashscope.aliyuncs.com/compatible-mode/v1", "dashscope.aliyuncs.com");
    expectEndpointRejected("custom", "http://10.10.0.8:8080/v1", "");
  });

  it("requires an edited provider host to be allowlisted", () => {
    expectEndpointRejected("bailian", "https://workspace.example.com/v1", "");
    expect(normalizeModelEndpoint("bailian", "https://workspace.example.com/v1", "workspace.example.com")).toBe(
      "https://workspace.example.com/v1"
    );
  });

  it.each([
    "https://user:pass@api.openai.com/v1",
    "https://api.openai.com/v1?tenant=one",
    "https://api.openai.com/v1#fragment",
    "ftp://api.openai.com/v1"
  ])("rejects unsafe URL syntax: %s", (baseUrl) => {
    expectEndpointRejected("openai", baseUrl, "");
  });

  it("rejects wildcard allowlist entries", () => {
    expectEndpointRejected("custom", "https://models.example.com/v1", "*.example.com");
  });

  it("rejects blank and malformed URLs", () => {
    expectEndpointRejected("custom", "", "models.internal");
    expectEndpointRejected("custom", "not-a-url", "models.internal");
  });

  it.each([5_000, 30_000, 120_000])("accepts a timeout inside the supported range", (timeoutMs) => {
    expect(validateModelTimeout(timeoutMs)).toBe(timeoutMs);
  });

  it.each([4_999, 120_001, 10_000.5, Number.NaN])("rejects a timeout outside the supported range", (timeoutMs) => {
    expectErrorCode(() => validateModelTimeout(timeoutMs), "MODEL_CONFIGURATION_INVALID");
  });
});

function expectEndpointRejected(
  provider: "bailian" | "deepseek" | "openai" | "custom",
  baseUrl: string,
  allowlist: string
): void {
  expectErrorCode(() => normalizeModelEndpoint(provider, baseUrl, allowlist), "MODEL_ENDPOINT_NOT_ALLOWED");
}

function expectErrorCode(action: () => unknown, code: string): void {
  try {
    action();
    throw new Error("Expected action to throw");
  } catch (error) {
    expect(error).toMatchObject({ code });
  }
}
