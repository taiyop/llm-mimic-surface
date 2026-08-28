import type { BackendError, EncodedError } from "../../boundary/errors.js";

export function encodeAnthropicError(error: BackendError): EncodedError {
  return {
    status: error.status,
    body: {
      type: "error",
      error: {
        type: anthropicType(error),
        message: error.message
      }
    }
  };
}

function anthropicType(error: BackendError): string {
  switch (error.code) {
    case "unauthorized":
      return "authentication_error";
    case "model_not_found":
      return "not_found_error";
    case "rate_limit":
      return "rate_limit_error";
    case "backend_unavailable":
      return "overloaded_error";
    case "internal_error":
    case "timeout":
    case "aborted":
      return "api_error";
    default:
      return "invalid_request_error";
  }
}
