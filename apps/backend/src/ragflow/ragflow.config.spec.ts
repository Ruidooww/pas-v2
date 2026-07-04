import { describe, expect, it } from "vitest";
import { createRagflowConfig } from "./ragflow.config";
import { classifyRagflowError } from "./ragflow.errors";

describe("createRagflowConfig", () => {
  it("uses V0 defaults when optional environment values are missing", () => {
    expect(createRagflowConfig({})).toEqual({
      apiKey: "",
      baseUrl: "http://host.docker.internal:19380",
      clientMode: "real",
      fallbackQueryPrefix: "IP-Guard",
      keywordEnabled: true,
      pasKbId: "",
      qaKbId: ""
    });
  });

  it("normalizes base URL and keeps dataset ids outside Git-tracked defaults", () => {
    expect(
      createRagflowConfig({
        RAGFLOW_API_KEY: "secret-key",
        RAGFLOW_BASE_URL: "http://localhost:19380/",
        RAGFLOW_CLIENT_MODE: "disabled",
        RAGFLOW_FALLBACK_QUERY_PREFIX: "Custom Product",
        RAGFLOW_KEYWORD_ENABLED: "false",
        PAS_KB_ID: "pas-v0",
        QA_KB_ID: "qa-v0"
      })
    ).toEqual({
      apiKey: "secret-key",
      baseUrl: "http://localhost:19380",
      clientMode: "disabled",
      fallbackQueryPrefix: "Custom Product",
      keywordEnabled: false,
      pasKbId: "pas-v0",
      qaKbId: "qa-v0"
    });
  });
});

describe("classifyRagflowError", () => {
  it("classifies aborts, connection failures, http failures, and unknown errors", () => {
    expect(classifyRagflowError(new DOMException("timeout", "AbortError"))).toBe("timeout");
    expect(classifyRagflowError(new TypeError("fetch failed"))).toBe("network");
    expect(classifyRagflowError({ status: 401 })).toBe("auth");
    expect(classifyRagflowError({ status: 503 })).toBe("upstream");
    expect(classifyRagflowError(new Error("other"))).toBe("unknown");
  });
});
