import type { BackendError, EncodedError } from "../../boundary/errors.js";

export function encodeGeminiError(error: BackendError): EncodedError {
  return {
    status: error.status,
    body: {
      error: {
        code: error.status,
        message: error.message,
        status: geminiStatus(error)
      }
    }
  };
}

function geminiStatus(error: BackendError): string {
  switch (error.code) {
    case "unauthorized":
      return "UNAUTHENTICATED";
    case "model_not_found":
      return "NOT_FOUND";
    case "rate_limit":
      return "RESOURCE_EXHAUSTED";
    case "timeout":
    case "aborted":
      return "DEADLINE_EXCEEDED";
    case "backend_unavailable":
      return "UNAVAILABLE";
    case "internal_error":
      return "INTERNAL";
    default:
      return "INVALID_ARGUMENT";
  }
}
