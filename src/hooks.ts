import type { InvocationEvent } from "./boundary/events.js";
import type { BackendError } from "./boundary/errors.js";

export interface RequestHookInfo {
  requestId: string;
  protocol: string;
  method: string;
  path: string;
  remoteAddress?: string;
}

export interface ResponseHookInfo extends RequestHookInfo {
  statusCode: number;
  durationMs: number;
  streamed?: boolean;
}

export interface ErrorHookInfo extends RequestHookInfo {
  error: BackendError;
}

export interface StreamEventHookInfo extends RequestHookInfo {
  eventType: InvocationEvent["type"];
}

export interface ServerHooks {
  onRequest?: (info: RequestHookInfo) => void | Promise<void>;
  onResponse?: (info: ResponseHookInfo) => void | Promise<void>;
  onError?: (info: ErrorHookInfo) => void | Promise<void>;
  onStreamEvent?: (info: StreamEventHookInfo) => void | Promise<void>;
}

export async function runHook<T>(hook: ((value: T) => void | Promise<void>) | undefined, value: T): Promise<void> {
  if (!hook) {
    return;
  }
  await hook(value);
}
