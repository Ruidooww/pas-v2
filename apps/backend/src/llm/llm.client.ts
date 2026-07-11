import { AiModelError } from "../ai-model/ai-model.errors";
import type {
  ActiveAiModelConfig,
  AiModelRuntimePort,
  OpenAiCompatibleTransportPort
} from "../ai-model/ai-model.types";
import { LlmRequestError } from "./llm.errors";
import type { LlmCompleteRequest, LlmCompletion } from "./llm.types";

export class LlmClient {
  constructor(
    private readonly runtime: AiModelRuntimePort,
    private readonly transport: OpenAiCompatibleTransportPort
  ) {}

  async complete(request: LlmCompleteRequest): Promise<LlmCompletion> {
    const snapshot = this.runtime.getSnapshot();
    if (snapshot.status !== "running") {
      const model = snapshot.status === "error" ? snapshot.model || "mock" : "mock";
      const provider = snapshot.status === "error" ? snapshot.provider : undefined;
      return {
        content: buildMockCompletion(request),
        model,
        mode: "mock",
        ...(provider ? { provider } : {}),
        source: snapshot.source
      };
    }

    const config: ActiveAiModelConfig = {
      provider: snapshot.provider,
      baseUrl: snapshot.baseUrl,
      apiKey: snapshot.apiKey,
      model: snapshot.model,
      timeoutMs: snapshot.timeoutMs
    };

    try {
      const completion = await this.transport.complete(config, request);
      return {
        ...completion,
        mode: "real",
        provider: snapshot.provider,
        source: snapshot.source
      };
    } catch (error) {
      if (error instanceof AiModelError) {
        throw new LlmRequestError(error.code, error.message, error.httpStatus);
      }
      throw new LlmRequestError("MODEL_PROVIDER_UNAVAILABLE", "Model provider is unavailable");
    }
  }
}

function buildMockCompletion(request: LlmCompleteRequest): string {
  const promptHead = request.prompt.replace(/\s+/g, " ").slice(0, 60);
  return `[mock-llm] ${promptHead}`;
}
