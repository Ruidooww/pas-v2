import { AiModelError } from "./ai-model.errors";
import { normalizeModelEndpoint, validateModelTimeout } from "./ai-model.endpoint-policy";
import type {
  ActiveAiModelConfig,
  AiModelCompletionRequest,
  AiModelTransportCompletion,
  OpenAiCompatibleTransportPort
} from "./ai-model.types";

type FetchResponse = {
  ok: boolean;
  status: number;
  json?: () => Promise<unknown>;
};

type Fetcher = (url: string, init?: RequestInit) => Promise<FetchResponse>;

type ChatCompletionResponse = {
  choices?: Array<{ message?: { content?: string } }>;
  model?: string;
};

export class OpenAiCompatibleTransport implements OpenAiCompatibleTransportPort {
  private readonly fetcher: Fetcher;

  constructor(
    fetcher?: Fetcher,
    private readonly endpointAllowlist: string | undefined = process.env.MODEL_ENDPOINT_ALLOWLIST
  ) {
    this.fetcher = fetcher ?? ((url, init) => fetch(url, init));
  }

  async complete(
    config: ActiveAiModelConfig,
    request: AiModelCompletionRequest
  ): Promise<AiModelTransportCompletion> {
    const baseUrl = normalizeModelEndpoint(config.provider, config.baseUrl, this.endpointAllowlist);
    const timeoutMs = validateModelTimeout(config.timeoutMs);
    const messages: Array<{ role: "system" | "user"; content: string }> = [];
    if (request.system) {
      messages.push({ role: "system", content: request.system });
    }
    messages.push({ role: "user", content: request.prompt });

    let response: FetchResponse;
    try {
      response = await this.fetcher(`${baseUrl}/chat/completions`, {
        method: "POST",
        redirect: "error",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`
        },
        body: JSON.stringify({
          model: config.model,
          messages,
          temperature: request.temperature ?? 0.3,
          max_tokens: request.maxTokens ?? 800,
          stream: false
        }),
        signal: AbortSignal.timeout(timeoutMs)
      });
    } catch (error) {
      if (isTimeoutError(error)) {
        throw new AiModelError("MODEL_REQUEST_TIMEOUT", "Model request timed out");
      }
      throw new AiModelError("MODEL_PROVIDER_UNAVAILABLE", "Model provider is unavailable");
    }

    if (!response.ok) {
      throw errorForHttpStatus(response.status);
    }

    let body: ChatCompletionResponse;
    try {
      body = (await response.json?.()) as ChatCompletionResponse;
    } catch {
      throw invalidResponse();
    }
    const content = body?.choices?.[0]?.message?.content?.trim();
    if (!content) {
      throw invalidResponse();
    }

    return {
      content,
      model: body.model?.trim() || config.model
    };
  }
}

function errorForHttpStatus(status: number): AiModelError {
  if (status === 401 || status === 403) {
    return new AiModelError("MODEL_AUTHENTICATION_FAILED", "Model provider rejected authentication", status);
  }
  if (status === 404) {
    return new AiModelError("MODEL_ENDPOINT_OR_MODEL_NOT_FOUND", "Model endpoint or model was not found", status);
  }
  if (status === 429) {
    return new AiModelError("MODEL_RATE_LIMITED", "Model provider rate limited the request", status);
  }
  if (status >= 500) {
    return new AiModelError("MODEL_PROVIDER_UNAVAILABLE", "Model provider is unavailable", status);
  }
  return new AiModelError("MODEL_RESPONSE_INVALID", "Model provider rejected the request", status);
}

function invalidResponse(): AiModelError {
  return new AiModelError("MODEL_RESPONSE_INVALID", "Model provider returned an invalid response");
}

function isTimeoutError(error: unknown): boolean {
  return error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError");
}
