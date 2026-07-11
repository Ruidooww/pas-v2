export type AiModelErrorCode =
  | "MODEL_CONFIG_ENCRYPTION_UNAVAILABLE"
  | "MODEL_CONFIGURATION_INVALID"
  | "MODEL_API_KEY_REQUIRED"
  | "MODEL_ENDPOINT_NOT_ALLOWED"
  | "MODEL_PERSISTENCE_UNAVAILABLE"
  | "MODEL_AUTHENTICATION_FAILED"
  | "MODEL_ENDPOINT_OR_MODEL_NOT_FOUND"
  | "MODEL_RATE_LIMITED"
  | "MODEL_PROVIDER_UNAVAILABLE"
  | "MODEL_REQUEST_TIMEOUT"
  | "MODEL_RESPONSE_INVALID";

export class AiModelError extends Error {
  constructor(
    readonly code: AiModelErrorCode,
    message: string,
    readonly httpStatus?: number
  ) {
    super(message);
    this.name = "AiModelError";
  }
}
