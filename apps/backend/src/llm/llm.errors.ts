import type { AiModelErrorCode } from "../ai-model/ai-model.errors";

export class LlmRequestError extends Error {
  constructor(
    readonly code: AiModelErrorCode,
    message: string,
    readonly httpStatus?: number
  ) {
    super(message);
    this.name = "LlmRequestError";
  }
}
