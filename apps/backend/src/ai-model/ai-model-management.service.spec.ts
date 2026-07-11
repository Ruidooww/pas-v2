import { describe, expect, it, vi } from "vitest";
import { AuditLogService } from "../audit/audit-log.service";
import type { LlmConfig } from "../llm/llm.config";
import type { RagflowClient } from "../ragflow/ragflow.client";
import { AiModelConfigurationService } from "./ai-model-configuration.service";
import { encryptApiKey } from "./ai-model.crypto";
import { AiModelError } from "./ai-model.errors";
import { AiModelManagementService } from "./ai-model-management.service";
import type {
  AiModelCandidateRequest,
  AiModelConfigurationPersistence,
  OpenAiCompatibleTransportPort,
  PersistedAiModelConfiguration
} from "./ai-model.types";

const ENCRYPTION_KEY = Buffer.alloc(32, 10).toString("base64");
const environmentConfig: LlmConfig = {
  mode: "real",
  baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  apiKey: "environment-secret",
  model: "qwen-env",
  timeoutMs: 30_000
};

describe("AiModelManagementService", () => {
  it("audits an enabled database configuration that fails decryption during hydration", async () => {
    const persisted = createPersistedConfiguration({
      ...encryptApiKey("database-secret", Buffer.alloc(32, 11).toString("base64")),
      enabled: true
    });
    const harness = await createHarness({ persisted });

    expect(harness.configuration.getSnapshot()).toEqual(
      expect.objectContaining({ status: "error", source: "database", errorCode: "MODEL_CONFIG_ENCRYPTION_UNAVAILABLE" })
    );
    expect(harness.audit.list()).toEqual([
      expect.objectContaining({
        action: "ai_model_configuration",
        result: "failure",
        failureReason: "MODEL_CONFIG_ENCRYPTION_UNAVAILABLE",
        metadata: expect.objectContaining({ operation: "hydrate", provider: "bailian", model: "qwen-db" })
      })
    ]);
  });

  it("tests a candidate with the effective environment key without persisting it", async () => {
    const harness = await createHarness();

    await expect(harness.management.testGeneration("admin-1", candidate())).resolves.toEqual(
      expect.objectContaining({ ok: true, provider: "bailian", model: "qwen-plus", elapsedMs: expect.any(Number) })
    );

    expect(harness.transport.complete).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: "environment-secret", model: "qwen-plus" }),
      expect.objectContaining({ temperature: 0, maxTokens: 8 })
    );
    expect(harness.persistence.saveAiModelConfiguration).not.toHaveBeenCalled();
    expect(harness.audit.list()).toEqual([
      expect.objectContaining({
        action: "ai_model_configuration",
        result: "success",
        metadata: expect.objectContaining({ operation: "test", provider: "bailian", model: "qwen-plus" })
      })
    ]);
  });

  it("returns a sanitized failed candidate test without changing saved activation evidence", async () => {
    const persisted = createPersistedConfiguration({ ...encryptApiKey("database-secret", ENCRYPTION_KEY) });
    const harness = await createHarness({ persisted });
    vi.mocked(harness.transport.complete).mockRejectedValue(
      new AiModelError("MODEL_AUTHENTICATION_FAILED", "sanitized authentication failure", 401)
    );

    const result = await harness.management.testGeneration("admin-1", {
      ...candidate(),
      apiKey: "candidate-secret"
    });

    expect(result).toEqual(
      expect.objectContaining({ ok: false, errorCode: "MODEL_AUTHENTICATION_FAILED", elapsedMs: expect.any(Number) })
    );
    expect(harness.persistence.saveAiModelConfiguration).not.toHaveBeenCalled();
    expect(harness.configuration.getPersistedConfiguration()).toEqual(persisted);
    const serializedAudit = JSON.stringify(harness.audit.list());
    expect(serializedAudit).not.toContain("candidate-secret");
    expect(serializedAudit).not.toContain(persisted.encryptedApiKey);
  });

  it("requires an explicitly submitted key for the first database save", async () => {
    const harness = await createHarness();

    await expect(harness.management.saveGeneration("admin-1", candidate())).rejects.toMatchObject({
      code: "MODEL_API_KEY_REQUIRED"
    });
    expect(harness.transport.complete).not.toHaveBeenCalled();
    expect(harness.persistence.saveAiModelConfiguration).not.toHaveBeenCalled();
    expect(harness.configuration.getSnapshot()).toEqual(expect.objectContaining({ source: "environment" }));
  });

  it("leaves persistence and runtime unchanged when the repeated save test fails", async () => {
    const harness = await createHarness();
    const previousSnapshot = harness.configuration.getSnapshot();
    vi.mocked(harness.transport.complete).mockRejectedValue(
      new AiModelError("MODEL_RATE_LIMITED", "sanitized rate limit", 429)
    );

    await expect(
      harness.management.saveGeneration("admin-1", { ...candidate(), apiKey: "new-secret" })
    ).rejects.toMatchObject({ code: "MODEL_RATE_LIMITED" });

    expect(harness.persistence.saveAiModelConfiguration).not.toHaveBeenCalled();
    expect(harness.configuration.getSnapshot()).toBe(previousSnapshot);
  });

  it("preserves an existing disabled database key when save receives a blank key", async () => {
    const encrypted = encryptApiKey("database-secret", ENCRYPTION_KEY);
    const persisted = createPersistedConfiguration({ ...encrypted, enabled: false });
    const harness = await createHarness({ persisted });

    const overview = await harness.management.saveGeneration("admin-2", candidate());

    expect(harness.transport.complete).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: "database-secret" }),
      expect.any(Object)
    );
    expect(harness.persistence.saveAiModelConfiguration).toHaveBeenCalledWith(
      expect.objectContaining({
        ...encrypted,
        enabled: true,
        updatedBy: "admin-2",
        lastTestStatus: "passed"
      })
    );
    expect(harness.configuration.getSnapshot()).toEqual(
      expect.objectContaining({ source: "database", apiKey: "database-secret", model: "qwen-plus" })
    );
    const serialized = JSON.stringify({ overview, audit: harness.audit.list() });
    expect(serialized).not.toContain("database-secret");
    expect(serialized).not.toContain(encrypted.encryptedApiKey);
    expect(serialized).not.toContain(encrypted.apiKeyIv);
    expect(serialized).not.toContain(encrypted.apiKeyAuthTag);
  });

  it("encrypts and activates a replacement key", async () => {
    const existing = createPersistedConfiguration({ ...encryptApiKey("old-secret", ENCRYPTION_KEY) });
    const harness = await createHarness({ persisted: existing });

    await harness.management.saveGeneration("admin-1", { ...candidate(), apiKey: "replacement-secret" });

    const saved = vi.mocked(harness.persistence.saveAiModelConfiguration).mock.calls[0]?.[0];
    expect(saved?.encryptedApiKey).not.toBe(existing.encryptedApiKey);
    expect(saved?.apiKeyIv).not.toBe(existing.apiKeyIv);
    expect(harness.configuration.getSnapshot()).toEqual(expect.objectContaining({ apiKey: "replacement-secret" }));
  });

  it("disables the database row and returns to environment configuration", async () => {
    const persisted = createPersistedConfiguration({ ...encryptApiKey("database-secret", ENCRYPTION_KEY) });
    const harness = await createHarness({ persisted });

    await expect(harness.management.disableGeneration("admin-3")).resolves.toEqual(
      expect.objectContaining({ generation: expect.objectContaining({ source: "environment" }) })
    );
    expect(harness.persistence.saveAiModelConfiguration).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: false, updatedBy: "admin-3" })
    );
  });

  it("keeps RAGFlow healthy when optional model fields are unavailable", async () => {
    const ragflow = {
      checkHealth: vi.fn().mockResolvedValue({ status: "ok", baseUrl: "http://ragflow.local" }),
      getDatasetOverview: vi.fn().mockResolvedValue({
        datasetId: "qa-v0",
        name: "PAS QA",
        embeddingModel: "text-embedding-v3",
        documentCount: 20,
        chunkCount: 500
      })
    } as unknown as RagflowClient;
    const harness = await createHarness({ ragflow });

    await expect(harness.management.getRagflowOverview()).resolves.toEqual(
      expect.objectContaining({
        status: "ok",
        baseUrl: "http://ragflow.local",
        dataset: expect.objectContaining({ datasetId: "qa-v0", embeddingModel: "text-embedding-v3" }),
        unavailableFields: expect.arrayContaining(["rerankerModel", "chatModel", "language", "chunkMethod"])
      })
    );
  });
});

type HarnessOptions = {
  persisted?: PersistedAiModelConfiguration;
  ragflow?: RagflowClient;
};

async function createHarness(options: HarnessOptions = {}) {
  const persistence: AiModelConfigurationPersistence = {
    loadAiModelConfiguration: vi.fn().mockResolvedValue(options.persisted),
    saveAiModelConfiguration: vi.fn().mockResolvedValue(undefined)
  };
  const configuration = new AiModelConfigurationService(persistence, environmentConfig, {
    encryptionKey: ENCRYPTION_KEY,
    endpointAllowlist: ""
  });
  await configuration.initialize();
  const transport: OpenAiCompatibleTransportPort = {
    complete: vi.fn().mockResolvedValue({ content: "OK", model: "tested-model" })
  };
  const audit = new AuditLogService();
  const ragflow =
    options.ragflow ??
    ({
      checkHealth: vi.fn().mockResolvedValue({ status: "disabled", baseUrl: "http://ragflow.local" }),
      getDatasetOverview: vi.fn()
    } as unknown as RagflowClient);
  const management = new AiModelManagementService(
    configuration,
    transport,
    audit,
    ragflow,
    "qa-v0",
    () => Date.parse("2026-07-11T01:00:00.000Z")
  );
  return { management, configuration, persistence, transport, audit };
}

function candidate(): AiModelCandidateRequest {
  return {
    provider: "bailian",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    model: "qwen-plus",
    timeoutSeconds: 30
  };
}

function createPersistedConfiguration(
  overrides: Partial<PersistedAiModelConfiguration> = {}
): PersistedAiModelConfiguration {
  return {
    id: "generation-default",
    provider: "bailian",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    model: "qwen-db",
    encryptedApiKey: "ciphertext",
    apiKeyIv: "iv",
    apiKeyAuthTag: "tag",
    timeoutMs: 30_000,
    enabled: true,
    lastTestStatus: "passed",
    lastTestedAt: "2026-07-11T00:00:00.000Z",
    updatedBy: "admin-0",
    createdAt: "2026-07-11T00:00:00.000Z",
    updatedAt: "2026-07-11T00:00:00.000Z",
    ...overrides
  };
}
