import { AiModelError, type AiModelErrorCode } from "../ai-model/ai-model.errors";
import type { AiModelProvider } from "../ai-model/ai-model.types";
import type { AuditLogService } from "../audit/audit-log.service";
import { LlmRequestError } from "./llm.errors";

export type LlmGenerationFeature = "qa" | "customer_analysis" | "proposal";

type LlmGenerationAuditInput = {
  actorUserId?: string;
  feature: LlmGenerationFeature;
  provider?: AiModelProvider;
  model?: string;
  elapsedMs: number;
  result: "success" | "failure";
  fallbackUsed: boolean;
  errorCode?: AiModelErrorCode;
};

export function recordLlmGeneration(
  audit: AuditLogService | undefined,
  input: LlmGenerationAuditInput
): void {
  if (!audit) {
    return;
  }

  audit.record({
    action: "llm_generation",
    ...(input.actorUserId ? { actorUserId: input.actorUserId } : {}),
    objectType: "llm_feature",
    objectId: input.feature,
    result: input.result,
    ...(input.errorCode ? { failureReason: input.errorCode } : {}),
    metadata: {
      feature: input.feature,
      ...(input.provider ? { provider: input.provider } : {}),
      ...(input.model ? { model: input.model } : {}),
      elapsedMs: input.elapsedMs,
      generationResult: input.result,
      fallbackUsed: input.fallbackUsed,
      ...(input.errorCode ? { errorCode: input.errorCode } : {})
    }
  });
}

export function modelErrorCode(error: unknown): AiModelErrorCode {
  if (error instanceof LlmRequestError || error instanceof AiModelError) {
    return error.code;
  }
  return "MODEL_PROVIDER_UNAVAILABLE";
}

export function modelElapsedMs(startedAt: number, finishedAt: number): number {
  return Math.max(0, Math.round(finishedAt - startedAt));
}
