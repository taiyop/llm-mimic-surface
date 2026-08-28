import type { ExternalApiBackend, InvocationContext } from "../backend/types.js";
import type { ProtocolCapabilities } from "../boundary/capabilities.js";
import type { EncodedError } from "../boundary/errors.js";
import type { EncodedStreamEvent, InvocationEvent } from "../boundary/events.js";

export type { EncodedStreamEvent, InvocationEvent };
import type { InvocationRequest, LossyConversionPolicy } from "../boundary/request.js";
import type { InvocationResponse } from "../boundary/response.js";

export interface ProtocolOptions {
  prefix?: string;
  lossyConversion?: LossyConversionPolicy;
}

export interface ProtocolRequest {
  method: string;
  url: string;
  path: string;
  params: Record<string, string>;
  query: Record<string, string | string[] | undefined>;
  headers: Record<string, string | string[] | undefined>;
  body: unknown;
  requestId: string;
  signal: AbortSignal;
  remoteAddress?: string;
}

export interface StreamWriter {
  write(event: EncodedStreamEvent): Promise<void>;
  writeComment(comment: string): Promise<void>;
  end(): Promise<void>;
}

export interface ProtocolReply {
  header(name: string, value: string): ProtocolReply;
  status(code: number): ProtocolReply;
  send(body: unknown): Promise<void>;
  sse(init?: { keepAliveMs?: number; headers?: Record<string, string> }): Promise<StreamWriter>;
}

export type ProtocolHandler = (request: ProtocolRequest, reply: ProtocolReply) => Promise<void>;

export interface RouteSpec {
  method: "GET" | "POST" | "DELETE" | "OPTIONS";
  path: string;
  protocolId: string;
  handler: ProtocolHandler;
  encodeError: (error: import("../boundary/errors.js").BackendError) => EncodedError;
}

export interface RouteRegistrar {
  route(spec: RouteSpec): void;
}

export interface ProtocolAdapter {
  readonly id: string;
  readonly version: string;
  registerRoutes(
    registrar: RouteRegistrar,
    backend: ExternalApiBackend,
    options?: ProtocolOptions
  ): void;
  capabilities(): ProtocolCapabilities;
}

export interface DecodeMeta {
  protocol: string;
  endpoint: string;
  params: Record<string, string>;
  query: Record<string, string | string[] | undefined>;
}

export interface ProtocolCodec<TResponse = unknown> {
  decodeRequest(raw: unknown, meta: DecodeMeta): InvocationRequest;
  encodeResponse(response: InvocationResponse, request: InvocationRequest): TResponse;
  encodeEvent(
    event: InvocationEvent,
    state: StreamEncodeState
  ): EncodedStreamEvent | EncodedStreamEvent[] | null;
  encodeError(error: import("../boundary/errors.js").BackendError): EncodedError;
}

export interface StreamEncodeState {
  id: string;
  model: string;
  created: number;
  started: boolean;
  textStarted: boolean;
  ended: boolean;
  toolCalls: Map<string, { index: number; name: string; started: boolean; ended: boolean }>;
}

export function createStreamState(id: string, model: string, created: number): StreamEncodeState {
  return {
    id,
    model,
    created,
    started: false,
    textStarted: false,
    ended: false,
    toolCalls: new Map()
  };
}

export function joinPath(prefix: string | undefined, path: string): string {
  const normalizedPrefix = (prefix ?? "").replace(/\/+$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  if (!normalizedPrefix) {
    return normalizedPath;
  }
  return `${normalizedPrefix.startsWith("/") ? normalizedPrefix : `/${normalizedPrefix}`}${normalizedPath}`;
}

export function contextFromProtocolRequest(request: ProtocolRequest, protocol: string): InvocationContext {
  return {
    requestId: request.requestId,
    signal: request.signal,
    headers: request.headers,
    protocol,
    remoteAddress: request.remoteAddress
  };
}
