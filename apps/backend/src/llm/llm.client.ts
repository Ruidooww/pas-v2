import type { LlmConfig } from "./llm.config";
import { LlmRequestError } from "./llm.errors";
import type { LlmCompleteRequest, LlmCompletion } from "./llm.types";

type FetchResponse = {
  ok: boolean;
  status: number;
  json?: () => Promise<unknown>;
};

type Fetcher = (url: string, init?: RequestInit) => Promise<FetchResponse>;

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  model?: string;
};

export class LlmClient {
  constructor(
    private readonly config: LlmConfig,
    private readonly fetcher: Fetcher = fetch
  ) {}

  async complete(request: LlmCompleteRequest): Promise<LlmCompletion> {
    if (this.config.mode === "mock") {
      return {
        content: buildMockCompletion(request),
        model: "mock",
        mode: "mock"
      };
    }

    const messages: Array<{ role: string; content: string }> = [];
    if (request.system) {
      messages.push({ role: "system", content: request.system });
    }
    messages.push({ role: "user", content: request.prompt });

    let response: FetchResponse;
    try {
      response = await this.fetcher(`${this.config.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.apiKey}`
        },
        body: JSON.stringify({
          model: this.config.model,
          messages,
          temperature: request.temperature ?? 0.3,
          max_tokens: request.maxTokens ?? 800
        }),
        signal: AbortSignal.timeout(this.config.timeoutMs)
      });
    } catch (error) {
      throw new LlmRequestError(error instanceof Error ? error.message : "LLM request failed");
    }

    if (!response.ok) {
      throw new LlmRequestError(`LLM provider returned HTTP ${response.status}`, response.status);
    }

    const body = (await response.json?.()) as ChatCompletionResponse | undefined;
    const content = body?.choices?.[0]?.message?.content?.trim();
    if (!content) {
      throw new LlmRequestError("LLM provider returned an empty completion");
    }

    return {
      content,
      model: body?.model || this.config.model,
      mode: "real"
    };
  }
}

function buildMockCompletion(request: LlmCompleteRequest): string {
  const promptHead = request.prompt.replace(/\s+/g, " ").slice(0, 60);
  return `[mock-llm] ${promptHead}`;
}
