import { describe, expect, it, vi } from "vitest";
import type {
  AiModelRuntimePort,
  EffectiveAiModelSnapshot,
  OpenAiCompatibleTransportPort
} from "../ai-model/ai-model.types";
import { AiModelError } from "../ai-model/ai-model.errors";
import { LlmClient } from "./llm.client";
import { createLlmConfig } from "./llm.config";
import { LlmRequestError } from "./llm.errors";

const realSnapshot: EffectiveAiModelSnapshot = {
  status: "running",
  source: "database",
  provider: "openai",
  baseUrl: "https://api.openai.com/v1",
  apiKey: "test-key",
  model: "gpt-test",
  timeoutMs: 5_000
};

describe("createLlmConfig", () => {
  it("falls back to mock mode when no api key is configured", () => {
    const config = createLlmConfig({ LLM_CLIENT_MODE: "real" });
    expect(config.mode).toBe("mock");
  });

  it("uses real mode when requested with an api key", () => {
    const config = createLlmConfig({ LLM_CLIENT_MODE: "real", LLM_API_KEY: "k" });
    expect(config.mode).toBe("real");
  });
});

describe("LlmClient", () => {
  it("returns a deterministic completion for a mock snapshot without transport calls", async () => {
    const transport = createTransport();
    const client = new LlmClient(createRuntime({ status: "not_configured", source: "mock", timeoutMs: 30_000 }), transport);

    const completion = await client.complete({ prompt: "总结客户情况" });

    expect(completion.mode).toBe("mock");
    expect(completion.source).toBe("mock");
    expect(completion.content).toContain("[mock-llm]");
    expect(transport.complete).not.toHaveBeenCalled();
  });

  it("delegates a running snapshot to the shared transport", async () => {
    const transport = createTransport({ content: "客户综述内容", model: "gpt-test-1" });
    const client = new LlmClient(createRuntime(realSnapshot), transport);

    const completion = await client.complete({ system: "你是售前助手", prompt: "总结" });

    expect(completion.content).toBe("客户综述内容");
    expect(completion.mode).toBe("real");
    expect(completion).toMatchObject({ provider: "openai", source: "database", model: "gpt-test-1" });
    expect(transport.complete).toHaveBeenCalledWith(
      {
        provider: "openai",
        baseUrl: "https://api.openai.com/v1",
        apiKey: "test-key",
        model: "gpt-test",
        timeoutMs: 5_000
      },
      { system: "你是售前助手", prompt: "总结" }
    );
  });

  it("reads the runtime snapshot again for every completion", async () => {
    let snapshot: EffectiveAiModelSnapshot = { status: "not_configured", source: "mock", timeoutMs: 30_000 };
    const runtime: AiModelRuntimePort = { getSnapshot: () => snapshot };
    const transport = createTransport({ content: "hot reloaded", model: "gpt-test" });
    const client = new LlmClient(runtime, transport);

    await expect(client.complete({ prompt: "first" })).resolves.toMatchObject({ mode: "mock" });
    snapshot = realSnapshot;
    await expect(client.complete({ prompt: "second" })).resolves.toMatchObject({
      mode: "real",
      content: "hot reloaded"
    });
    expect(transport.complete).toHaveBeenCalledTimes(1);
  });

  it("keeps an error snapshot on the deterministic path", async () => {
    const transport = createTransport();
    const client = new LlmClient(
      createRuntime({
        status: "error",
        source: "database",
        provider: "bailian",
        model: "qwen-db",
        timeoutMs: 30_000,
        errorCode: "MODEL_CONFIG_ENCRYPTION_UNAVAILABLE"
      }),
      transport
    );

    await expect(client.complete({ prompt: "x" })).resolves.toMatchObject({ mode: "mock", source: "database" });
    expect(transport.complete).not.toHaveBeenCalled();
  });

  it("wraps transport errors as sanitized LlmRequestError values", async () => {
    const transport = createTransport();
    vi.mocked(transport.complete).mockRejectedValue(
      new AiModelError("MODEL_RATE_LIMITED", "Model provider rate limited the request")
    );
    const client = new LlmClient(createRuntime(realSnapshot), transport);

    const error = await captureError(() => client.complete({ prompt: "x" }));

    expect(error).toBeInstanceOf(LlmRequestError);
    expect(error).toMatchObject({ code: "MODEL_RATE_LIMITED" });
  });
});

function createRuntime(snapshot: EffectiveAiModelSnapshot): AiModelRuntimePort {
  return { getSnapshot: () => snapshot };
}

function createTransport(
  completion: { content: string; model: string } = { content: "unused", model: "unused" }
): OpenAiCompatibleTransportPort {
  return { complete: vi.fn().mockResolvedValue(completion) };
}

async function captureError(action: () => Promise<unknown>): Promise<unknown> {
  try {
    await action();
    throw new Error("Expected action to reject");
  } catch (error) {
    return error;
  }
}
