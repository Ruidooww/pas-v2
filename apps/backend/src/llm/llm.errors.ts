export class LlmRequestError extends Error {
  constructor(
    message: string,
    readonly httpStatus?: number
  ) {
    super(message);
    this.name = "LlmRequestError";
  }
}
