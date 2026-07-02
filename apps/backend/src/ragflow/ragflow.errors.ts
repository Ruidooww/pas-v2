export type RagflowErrorKind = "timeout" | "network" | "auth" | "upstream" | "unknown";

type HttpFailure = {
  status?: number;
};

export function classifyRagflowError(error: unknown): RagflowErrorKind {
  if (isAbortError(error)) {
    return "timeout";
  }

  if (error instanceof TypeError) {
    return "network";
  }

  const status = typeof error === "object" && error !== null ? (error as HttpFailure).status : undefined;
  if (typeof status === "number") {
    if (status === 401 || status === 403) {
      return "auth";
    }

    return "upstream";
  }

  return "unknown";
}

function isAbortError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "name" in error && error.name === "AbortError";
}
