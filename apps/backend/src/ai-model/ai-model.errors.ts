export type AiModelErrorCode =
  | "MODEL_CONFIG_ENCRYPTION_UNAVAILABLE"
  | "MODEL_CONFIGURATION_INVALID"
  | "MODEL_ENDPOINT_NOT_ALLOWED"
  | "MODEL_PERSISTENCE_UNAVAILABLE";

export class AiModelError extends Error {
  constructor(
    readonly code: AiModelErrorCode,
    message: string
  ) {
    super(message);
    this.name = "AiModelError";
  }
}
