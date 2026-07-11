import { describe, expect, it, vi } from "vitest";
import type { LlmConfig } from "../llm/llm.config";
import { encryptApiKey } from "./ai-model.crypto";
import { AiModelConfigurationService } from "./ai-model-configuration.service";
import type { AiModelConfigurationPersistence, PersistedAiModelConfiguration } from "./ai-model.types";

const ENCRYPTION_KEY = Buffer.alloc(32, 9).toString("base64");
const environmentConfig: LlmConfig = {
  mode: "real",
  baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  apiKey: "environment-key",
  model: "qwen-env",
  timeoutMs: 30_000
};

describe("AiModelConfigurationService", () => {
  it("hydrates an enabled decryptable database configuration ahead of environment", async () => {
    const persisted = createPersistedConfiguration({
      ...encryptApiKey("database-key", ENCRYPTION_KEY),
      enabled: true
    });
    const service = createService(createPersistence(persisted));

    await service.initialize();

    expect(service.getSnapshot()).toEqual(
      expect.objectContaining({
        status: "running",
        source: "database",
        provider: "bailian",
        apiKey: "database-key",
        model: "qwen-db"
      })
    );
    expect(Object.isFrozen(service.getSnapshot())).toBe(true);
  });

  it("uses environment configuration when the database row is disabled", async () => {
    const persisted = createPersistedConfiguration({ enabled: false });
    const service = createService(createPersistence(persisted));

    await service.initialize();

    expect(service.getSnapshot()).toEqual(
      expect.objectContaining({
        status: "running",
        source: "environment",
        provider: "bailian",
        apiKey: "environment-key",
        model: "qwen-env"
      })
    );
  });

  it("uses a mock snapshot when no usable environment key exists", async () => {
    const service = createService(createPersistence(undefined), {
      ...environmentConfig,
      mode: "mock",
      apiKey: ""
    });

    await service.initialize();

    expect(service.getSnapshot()).toEqual({
      status: "not_configured",
      source: "mock",
      timeoutMs: 30_000
    });
  });

  it("fails closed when an enabled database row cannot be decrypted", async () => {
    const persisted = createPersistedConfiguration({
      ...encryptApiKey("database-key", Buffer.alloc(32, 4).toString("base64")),
      enabled: true
    });
    const service = createService(createPersistence(persisted));

    await service.initialize();

    expect(service.getSnapshot()).toEqual(
      expect.objectContaining({
        status: "error",
        source: "database",
        provider: "bailian",
        model: "qwen-db",
        errorCode: "MODEL_CONFIG_ENCRYPTION_UNAVAILABLE"
      })
    );
    expect(service.getSnapshot()).not.toHaveProperty("apiKey");
  });

  it("replaces the runtime snapshot only after persistence succeeds", async () => {
    const pendingSave = deferred<void>();
    const persistence = createPersistence(undefined);
    persistence.saveAiModelConfiguration = vi.fn().mockReturnValue(pendingSave.promise);
    const service = createService(persistence);
    await service.initialize();
    const previous = service.getSnapshot();
    const persisted = createPersistedConfiguration({ ...encryptApiKey("database-key", ENCRYPTION_KEY) });

    const activation = service.activatePersistedConfiguration(persisted, "database-key");

    expect(service.getSnapshot()).toBe(previous);
    pendingSave.resolve();
    await activation;
    expect(service.getSnapshot()).not.toBe(previous);
    expect(service.getSnapshot()).toEqual(expect.objectContaining({ source: "database", apiKey: "database-key" }));
  });

  it("keeps the previous snapshot when persistence fails", async () => {
    const persistence = createPersistence(undefined);
    persistence.saveAiModelConfiguration = vi.fn().mockRejectedValue(new Error("database down"));
    const service = createService(persistence);
    await service.initialize();
    const previous = service.getSnapshot();

    await expect(
      service.activatePersistedConfiguration(createPersistedConfiguration(), "database-key")
    ).rejects.toThrow("database down");
    expect(service.getSnapshot()).toBe(previous);
  });

  it("serializes save and disable mutations against the latest persisted configuration", async () => {
    const firstSave = deferred<void>();
    const secondSave = deferred<void>();
    const persisted = createPersistedConfiguration({ ...encryptApiKey("database-key", ENCRYPTION_KEY) });
    const persistence = createPersistence(persisted);
    persistence.saveAiModelConfiguration = vi
      .fn()
      .mockReturnValueOnce(firstSave.promise)
      .mockReturnValueOnce(secondSave.promise);
    const service = createService(persistence);
    await service.initialize();
    const replacement = createPersistedConfiguration({
      ...encryptApiKey("replacement-key", ENCRYPTION_KEY),
      model: "qwen-replacement",
      updatedBy: "admin-save"
    });

    const activation = service.activatePersistedConfiguration(replacement, "replacement-key");
    const disable = service.disablePersistedConfiguration("admin-disable");

    await vi.waitFor(() => expect(persistence.saveAiModelConfiguration).toHaveBeenCalledTimes(1));
    firstSave.resolve();
    await activation;
    await vi.waitFor(() => expect(persistence.saveAiModelConfiguration).toHaveBeenCalledTimes(2));
    expect(persistence.saveAiModelConfiguration).toHaveBeenLastCalledWith(
      expect.objectContaining({ model: "qwen-replacement", enabled: false, updatedBy: "admin-disable" })
    );
    expect(service.getSnapshot()).toEqual(
      expect.objectContaining({ source: "database", model: "qwen-replacement", apiKey: "replacement-key" })
    );

    secondSave.resolve();
    await disable;
    expect(service.getPersistedConfiguration()).toEqual(
      expect.objectContaining({ model: "qwen-replacement", enabled: false, updatedBy: "admin-disable" })
    );
    expect(service.getSnapshot()).toEqual(expect.objectContaining({ source: "environment" }));
  });

  it("disables the database row before activating environment fallback", async () => {
    const persisted = createPersistedConfiguration({ ...encryptApiKey("database-key", ENCRYPTION_KEY) });
    const persistence = createPersistence(persisted);
    const service = createService(persistence);
    await service.initialize();

    await service.disablePersistedConfiguration("admin-2");

    expect(persistence.saveAiModelConfiguration).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: false, updatedBy: "admin-2" })
    );
    expect(service.getSnapshot()).toEqual(expect.objectContaining({ source: "environment", apiKey: "environment-key" }));
  });

  it("fails environment configuration closed when a custom endpoint is not allowlisted", async () => {
    const service = createService(createPersistence(undefined), {
      ...environmentConfig,
      baseUrl: "https://models.internal/v1"
    });

    await service.initialize();

    expect(service.getSnapshot()).toEqual(
      expect.objectContaining({
        status: "error",
        source: "environment",
        errorCode: "MODEL_ENDPOINT_NOT_ALLOWED"
      })
    );
    expect(service.getSnapshot()).not.toHaveProperty("apiKey");
  });
});

function createService(
  persistence: AiModelConfigurationPersistence,
  llmConfig: LlmConfig = environmentConfig
): AiModelConfigurationService {
  return new AiModelConfigurationService(persistence, llmConfig, {
    encryptionKey: ENCRYPTION_KEY,
    endpointAllowlist: ""
  });
}

function createPersistence(
  persisted: PersistedAiModelConfiguration | undefined
): AiModelConfigurationPersistence {
  return {
    loadAiModelConfiguration: vi.fn().mockResolvedValue(persisted),
    saveAiModelConfiguration: vi.fn().mockResolvedValue(undefined)
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
    updatedBy: "admin-1",
    createdAt: "2026-07-11T00:00:00.000Z",
    updatedAt: "2026-07-11T00:00:00.000Z",
    ...overrides
  };
}

function deferred<T>(): { promise: Promise<T>; resolve: (value: T | PromiseLike<T>) => void } {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}
