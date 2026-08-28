import type { EncodedError } from "../../boundary/errors.js";
import type { BackendError } from "../../boundary/errors.js";
import type { ProtocolCapabilities } from "../../boundary/capabilities.js";

export interface OpenAICompatibleDialect {
  id: string;
  version: string;
  ownedBy: string;
  protocolKey: string;
  capabilities: ProtocolCapabilities;
  chatExtraKeys: readonly string[];
  responsesExtraKeys: readonly string[];
  mapChatExtensions(unknown: Record<string, unknown>): Record<string, unknown> | undefined;
  mapResponsesExtensions(unknown: Record<string, unknown>): Record<string, unknown> | undefined;
  encodeError(error: BackendError): EncodedError;
}

export function openaiStyleError(
  error: BackendError,
  options?: { type?: (code: BackendError["code"]) => string; code?: (code: BackendError["code"]) => string }
): EncodedError {
  const typeFor = options?.type ?? defaultOpenAIType;
  const codeFor = options?.code ?? defaultOpenAICode;
  return {
    status: error.status,
    body: {
      error: {
        message: error.message,
        type: typeFor(error.code),
        param: error.param ?? null,
        code: codeFor(error.code)
      }
    }
  };
}

function defaultOpenAIType(code: BackendError["code"]): string {
  switch (code) {
    case "unauthorized":
      return "invalid_request_error";
    case "rate_limit":
      return "rate_limit_error";
    case "timeout":
    case "aborted":
      return "timeout";
    case "backend_unavailable":
    case "internal_error":
      return "api_error";
    default:
      return "invalid_request_error";
  }
}

function defaultOpenAICode(code: BackendError["code"]): string {
  switch (code) {
    case "unsupported_feature":
      return "unsupported_value";
    case "model_not_found":
      return "model_not_found";
    case "unauthorized":
      return "invalid_api_key";
    case "rate_limit":
      return "rate_limit_exceeded";
    case "timeout":
      return "timeout";
    case "aborted":
      return "cancelled";
    default:
      return code;
  }
}
