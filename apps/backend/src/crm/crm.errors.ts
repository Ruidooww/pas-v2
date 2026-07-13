export type CrmErrorCode =
  | "CRM_AUTHENTICATION_FAILED"
  | "CRM_NOT_FOUND"
  | "CRM_RATE_LIMITED"
  | "CRM_UNAVAILABLE"
  | "CRM_RESPONSE_INVALID"
  | "CRM_REQUEST_REJECTED";

export class CrmClientError extends Error {
  constructor(
    readonly code: CrmErrorCode,
    message: string,
    readonly upstreamStatus?: number
  ) {
    super(message);
    this.name = "CrmClientError";
  }
}
