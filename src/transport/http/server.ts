import { randomUUID } from "node:crypto";
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import { authenticate } from "../../auth/bearer.js";
import type { AuthConfig } from "../../auth/types.js";
import type { ExternalApiBackend } from "../../backend/types.js";
import { BackendError, toBackendError, type EncodedError } from "../../boundary/errors.js";
import type { LossyConversionPolicy } from "../../boundary/request.js";
import { runHook, type ServerHooks } from "../../hooks.js";
import { ProtocolRegistry, RouteCollisionError } from "../../protocol/registry.js";
import type { ProtocolAdapter, ProtocolReply, ProtocolRequest, RouteSpec } from "../../protocol/types.js";
import { applyCors, isPreflight, type CorsConfig } from "./cors.js";
import { createSseWriter } from "./sse.js";

export interface CreateServerOptions {
  backend: ExternalApiBackend;
  protocols: ProtocolAdapter[];
  auth?: AuthConfig;
  cors?: CorsConfig;
  bodyLimit?: number;
  requestTimeoutMs?: number;
  host?: string;
  logger?: boolean;
  hooks?: ServerHooks;
  lossyConversion?: LossyConversionPolicy;
}

export interface ExternalApiServer {
  readonly fastify: FastifyInstance;
  listen(options?: { host?: string; port?: number }): Promise<{ host: string; port: number }>;
  close(): Promise<void>;
  inject: FastifyInstance["inject"];
}

export function createExternalApiServer(options: CreateServerOptions): ExternalApiServer {
  const registry = new ProtocolRegistry();
  for (const protocol of options.protocols) {
    registry.registerAdapter(protocol);
    protocol.registerRoutes(
      {
        route(spec) {
          registry.route(spec);
        }
      },
      options.backend,
      { lossyConversion: options.lossyConversion }
    );
  }

  const fastify = Fastify({
    logger: options.logger ?? false,
    bodyLimit: options.bodyLimit ?? 1_048_576,
    requestTimeout: options.requestTimeoutMs ?? 120_000,
    trustProxy: false
  });

  fastify.addHook("onRequest", async (request, reply) => {
    const requestId = headerString(request.headers["x-request-id"]) ?? randomUUID();
    request.id = requestId;
    reply.header("x-request-id", requestId);
    applyCors(request, reply, options.cors ?? true);
    if (isPreflight(request)) {
      reply.status(204);
      return reply.send();
    }
  });

  fastify.get("/health", async () => ({ ok: true }));

  for (const spec of registry.list()) {
    bindRoute(fastify, spec, options);
  }

  const defaultHost = options.host ?? "127.0.0.1";

  return {
    fastify,
    inject: fastify.inject.bind(fastify),
    async listen(listenOptions) {
      const host = listenOptions?.host ?? defaultHost;
      if (host === "0.0.0.0" && listenOptions?.host === undefined && options.host === undefined) {
        throw new Error("Refusing to bind 0.0.0.0 without an explicit host option");
      }
      const address = await fastify.listen({
        host,
        port: listenOptions?.port ?? 0
      });
      const url = new URL(address);
      return { host: url.hostname, port: Number(url.port) };
    },
    async close() {
      await fastify.close();
    }
  };
}

function bindRoute(fastify: FastifyInstance, spec: RouteSpec, options: CreateServerOptions): void {
  fastify.route({
    method: spec.method,
    url: spec.path,
    handler: async (request, reply) => {
      const started = Date.now();
      const abort = new AbortController();
      const timeoutMs = options.requestTimeoutMs ?? 120_000;
      const timeout = AbortSignal.timeout(timeoutMs);
      const signal = AbortSignal.any([abort.signal, timeout]);
      const onClientGone = () => {
        if (!abort.signal.aborted && !reply.raw.writableEnded) {
          abort.abort();
        }
      };
      request.socket?.once("close", onClientGone);
      reply.raw.once("close", onClientGone);
      const disconnectPoll = setInterval(() => {
        if (request.socket?.readyState === "closed") {
          onClientGone();
        }
      }, 25);
      disconnectPoll.unref();

      const protocolRequest = toProtocolRequest(request, signal);
      await runHook(options.hooks?.onRequest, {
        requestId: protocolRequest.requestId,
        protocol: spec.protocolId,
        method: spec.method,
        path: spec.path,
        remoteAddress: protocolRequest.remoteAddress
      });

      try {
        await authenticate(options.auth ?? false, {
          headers: protocolRequest.headers,
          path: spec.path,
          protocol: spec.protocolId
        });
        const protocolReply = toProtocolReply(reply);
        await spec.handler(protocolRequest, protocolReply);
        await runHook(options.hooks?.onResponse, {
          requestId: protocolRequest.requestId,
          protocol: spec.protocolId,
          method: spec.method,
          path: spec.path,
          remoteAddress: protocolRequest.remoteAddress,
          statusCode: reply.statusCode,
          durationMs: Date.now() - started,
          streamed: Boolean(reply.raw.headersSent && String(reply.raw.getHeader("content-type") ?? "").includes("event-stream"))
        });
      } catch (error) {
        const backendError = toBackendError(error);
        await runHook(options.hooks?.onError, {
          requestId: protocolRequest.requestId,
          protocol: spec.protocolId,
          method: spec.method,
          path: spec.path,
          remoteAddress: protocolRequest.remoteAddress,
          error: backendError
        });
        if (!reply.raw.headersSent && !reply.sent) {
          const encoded = spec.encodeError(backendError);
          sendEncodedError(reply, encoded);
        }
      } finally {
        clearInterval(disconnectPoll);
        request.socket?.off("close", onClientGone);
        reply.raw.off("close", onClientGone);
      }
    }
  });
}

function toProtocolRequest(request: FastifyRequest, signal: AbortSignal): ProtocolRequest {
  const params: Record<string, string> = {};
  for (const [key, value] of Object.entries(request.params as Record<string, unknown>)) {
    if (typeof value === "string") {
      params[key] = value;
    }
  }
  const query: Record<string, string | string[] | undefined> = {};
  for (const [key, value] of Object.entries(request.query as Record<string, unknown>)) {
    if (typeof value === "string" || Array.isArray(value) || value === undefined) {
      query[key] = value as string | string[] | undefined;
    }
  }
  return {
    method: request.method,
    url: request.url,
    path: request.routeOptions.url ?? request.url,
    params,
    query,
    headers: request.headers as Record<string, string | string[] | undefined>,
    body: request.body,
    requestId: request.id,
    signal,
    remoteAddress: request.ip
  };
}

function toProtocolReply(reply: FastifyReply): ProtocolReply {
  return {
    header(name, value) {
      reply.header(name, value);
      return this;
    },
    status(code) {
      reply.status(code);
      return this;
    },
    async send(body) {
      await reply.send(body);
    },
    async sse(init) {
      return createSseWriter(reply, init);
    }
  };
}

function sendEncodedError(reply: FastifyReply, encoded: EncodedError): void {
  for (const [name, value] of Object.entries(encoded.headers ?? {})) {
    reply.header(name, value);
  }
  reply.status(encoded.status).send(encoded.body);
}

function headerString(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

export { RouteCollisionError, BackendError };
