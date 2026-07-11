import { describe, expect, it, vi } from "vitest";
import type { ActiveAiModelConfig } from "./ai-model.types";
import { OpenAiCompatibleTransport } from "./openai-compatible.transport";

const activeConfig: ActiveAiModelConfig = {
  provider: "openai",
  baseUrl: "https://api.openai.com/v1",
  model: "gpt-test",
  apiKey: "test-key",
  timeoutMs: 30_000
};

describe("OpenAiCompatibleTransport", () => {
  it("sends a non-streaming chat completion with redirects disabled", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: " assistant answer " } }], model: "gpt-test-1" })
    });
    const transport = new OpenAiCompatibleTransport(fetcher, "");

    await expect(
      transport.complete(activeConfig, {
        system: "System instruction",
        prompt: "User prompt",
        temperature: 0.2,
        maxTokens: 123
      })
    ).resolves.toEqual({ content: "assistant answer", model: "gpt-test-1" });

    const [url, init] = fetcher.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.openai.com/v1/chat/completions");
    expect(init).toMatchObject({
      method: "POST",
      redirect: "error",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test-key"
      }
    });
    expect(JSON.parse(String(init.body))).toEqual({
      model: "gpt-test",
      messages: [
        { role: "system", content: "System instruction" },
        { role: "user", content: "User prompt" }
      ],
      temperature: 0.2,
      max_tokens: 123,
      stream: false
    });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("revalidates endpoint policy immediately before the request", async () => {
    const fetcher = vi.fn();
    const transport = new OpenAiCompatibleTransport(fetcher, "");

    await expect(
      transport.complete(
        { ...activeConfig, provider: "custom", baseUrl: "https://models.internal/v1" },
        { prompt: "x" }
      )
    ).rejects.toMatchObject({ code: "MODEL_ENDPOINT_NOT_ALLOWED" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each([
    [401, "MODEL_AUTHENTICATION_FAILED"],
    [403, "MODEL_AUTHENTICATION_FAILED"],
    [404, "MODEL_ENDPOINT_OR_MODEL_NOT_FOUND"],
    [429, "MODEL_RATE_LIMITED"],
    [500, "MODEL_PROVIDER_UNAVAILABLE"],
    [503, "MODEL_PROVIDER_UNAVAILABLE"]
  ])("maps HTTP %s to %s", async (status, code) => {
    const json = vi.fn().mockResolvedValue({ message: "sensitive upstream body" });
    const transport = new OpenAiCompatibleTransport(vi.fn().mockResolvedValue({ ok: false, status, json }), "");

    const error = await captureError(() => transport.complete(activeConfig, { prompt: "x" }));

    expect(error).toMatchObject({ code });
    expect(String((error as Error).message)).not.toContain("sensitive upstream body");
    expect(json).not.toHaveBeenCalled();
  });

  it("maps timeout failures without exposing the fetch error", async () => {
    const fetcher = vi.fn().mockRejectedValue(Object.assign(new Error("secret network detail"), { name: "TimeoutError" }));
    const transport = new OpenAiCompatibleTransport(fetcher, "");

    const error = await captureError(() => transport.complete(activeConfig, { prompt: "x" }));

    expect(error).toMatchObject({ code: "MODEL_REQUEST_TIMEOUT" });
    expect(String((error as Error).message)).not.toContain("secret network detail");
  });

  it.each([
    { choices: [] },
    { choices: [{ message: { content: "   " } }] },
    { choices: [{ message: {} }] }
  ])("rejects an empty or invalid assistant response", async (payload) => {
    const transport = new OpenAiCompatibleTransport(
      vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => payload }),
      ""
    );

    await expect(transport.complete(activeConfig, { prompt: "x" })).rejects.toMatchObject({
      code: "MODEL_RESPONSE_INVALID"
    });
  });
});

async function captureError(action: () => Promise<unknown>): Promise<unknown> {
  try {
    await action();
    throw new Error("Expected action to reject");
  } catch (error) {
    return error;
  }
}
