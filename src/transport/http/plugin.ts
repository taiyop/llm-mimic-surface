import type { FastifyInstance, FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import type { ExternalApiBackend } from "../../backend/types.js";
import { BackendError, toBackendError, type EncodedError } from "../../boundary/errors.js";
import type { LossyConversionPolicy } from "../../boundary/request.js";
import { runHook, type HttpTransportHooks } from "../../hooks.js";
import { ProtocolRegistry, RouteCollisionError } from "../../protocol/registry.js";
import type { ProtocolAdapter, ProtocolReply, ProtocolRequest, RouteSpec } from "../../protocol/types.js";
import { createSseWriter } from "./sse.js";

export interface LLMMimicSurfacePluginOptions {
  backend: ExternalApiBackend;
  protocols: ProtocolAdapter[];
  hooks?: HttpTransportHooks;
  lossyConversion?: LossyConversionPolicy;
}

/**
 * Registers the external LLM API surface on a Fastify host.
 *
 * The host owns server creation, listen/close, authentication, middleware,
 * logging, TLS, limits, timeouts, and application lifecycle.
 */
export const llmMimicSurfacePlugin: FastifyPluginAsync<LLMMimicSurfacePluginOptions> = async (
  fastify,
  options
) => {
  const registry = createRegistry(options);
  for (const spec of registry.list()) {
    bindRoute(fastify, spec, options);
  }
};

function createRegistry(options: LLMMimicSurfacePluginOptions): ProtocolRegistry {
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
      { lossyConversion: options.lossyConversion, hooks: options.hooks }
    );
  }
  return registry;
}

function bindRoute(
  fastify: FastifyInstance,
  spec: RouteSpec,
  options: LLMMimicSurfacePluginOptions
): void {
  fastify.route({
    method: spec.method,
    url: spec.path,
    handler: async (request, reply) => {
      const started = Date.now();
      const abort = new AbortController();
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

      const protocolRequest = toProtocolRequest(request, abort.signal);
      try {
        await runHook(options.hooks?.onRequest, {
          requestId: protocolRequest.requestId,
          protocol: spec.protocolId,
          method: spec.method,
          path: spec.path,
          remoteAddress: protocolRequest.remoteAddress
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
          streamed: Boolean(
            reply.raw.headersSent && String(reply.raw.getHeader("content-type") ?? "").includes("event-stream")
          )
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

export { RouteCollisionError, BackendError };
