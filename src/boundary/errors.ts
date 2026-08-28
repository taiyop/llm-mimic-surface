export type BackendErrorCode =
  | "invalid_request"
  | "unsupported_feature"
  | "model_not_found"
  | "unauthorized"
  | "rate_limit"
  | "timeout"
  | "aborted"
  | "backend_unavailable"
  | "internal_error";

export interface BackendErrorOptions {
  code: BackendErrorCode;
  message: string;
  status?: number;
  param?: string;
  cause?: unknown;
  details?: Record<string, unknown>;
}

export class BackendError extends Error {
  readonly code: BackendErrorCode;
  readonly status: number;
  readonly param?: string;
  readonly details?: Record<string, unknown>;

  constructor(options: BackendErrorOptions) {
    super(options.message);
    this.name = "BackendError";
    this.code = options.code;
    this.status = options.status ?? defaultStatus(options.code);
    this.param = options.param;
    this.details = options.details;
    if (options.cause !== undefined) {
      this.cause = options.cause;
    }
  }
}

export function defaultStatus(code: BackendErrorCode): number {
  switch (code) {
    case "invalid_request":
    case "unsupported_feature":
      return 400;
    case "unauthorized":
      return 401;
    case "model_not_found":
      return 404;
    case "timeout":
    case "aborted":
      return 408;
    case "rate_limit":
      return 429;
    case "backend_unavailable":
      return 503;
    case "internal_error":
    default:
      return 500;
  }
}

export function toBackendError(error: unknown): BackendError {
  if (error instanceof BackendError) {
    return error;
  }
  if (isAbortError(error)) {
    return new BackendError({
      code: "aborted",
      message: "Request was aborted",
      cause: error
    });
  }
  if (error instanceof Error && error.name === "TimeoutError") {
    return new BackendError({
      code: "timeout",
      message: error.message || "Request timed out",
      cause: error
    });
  }
  if (error instanceof Error) {
    return new BackendError({
      code: "internal_error",
      message: error.message || "Internal error",
      cause: error
    });
  }
  return new BackendError({
    code: "internal_error",
    message: "Internal error",
    cause: error
  });
}

export function isAbortError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  const name = "name" in error ? String(error.name) : "";
  const message = "message" in error ? String(error.message) : "";
  return (
    name === "AbortError" ||
    message.toLowerCase().includes("aborted") ||
    message.toLowerCase().includes("abort")
  );
}

export interface EncodedError {
  status: number;
  headers?: Record<string, string>;
  body: unknown;
}
