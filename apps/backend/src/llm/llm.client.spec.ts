import { describe, expect, it, vi } from "vitest";
import { LlmClient } from "./llm.client";
import type { LlmConfig } from "./llm.config";
import { createLlmConfig } from "./llm.config";
import { LlmRequestError } from "./llm.errors";

const realConfig: LlmConfig = {
  mode: "real",
  baseUrl: "http://llm.local/v1",
  apiKey: "test-key",
  model: "qwen-max",
  timeoutMs: 5000
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
  it("returns a deterministic completion in mock mode without network calls", async () => {
    const fetcher = vi.fn();
    const client = new LlmClient({ ...realConfig, mode: "mock" }, fetcher);
    const completion = await client.complete({ prompt: "总结客户情况" });
    expect(completion.mode).toBe("mock");
    expect(completion.content).toContain("[mock-llm]");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("calls the chat completions endpoint in real mode", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: "客户综述内容" } }],
        model: "qwen-max"
      })
    });
    const client = new LlmClient(realConfig, fetcher);
    const completion = await client.complete({ system: "你是售前助手", prompt: "总结" });
    expect(completion.content).toBe("客户综述内容");
    expect(completion.mode).toBe("real");
    const [url, init] = fetcher.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://llm.local/v1/chat/completions");
    expect(init.headers).toMatchObject({ Authorization: "Bearer test-key" });
  });

  it("throws LlmRequestError on provider http failure", async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: false, status: 429 });
    const client = new LlmClient(realConfig, fetcher);
    await expect(client.complete({ prompt: "x" })).rejects.toBeInstanceOf(LlmRequestError);
  });

  it("throws LlmRequestError on empty completion", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ choices: [] })
    });
    const client = new LlmClient(realConfig, fetcher);
    await expect(client.complete({ prompt: "x" })).rejects.toBeInstanceOf(LlmRequestError);
  });
});
