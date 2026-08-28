import type { ExternalApiBackend } from "../../backend/types.js";
import type { ProtocolCapabilities } from "../../boundary/capabilities.js";
import type { LossyConversionPolicy } from "../../boundary/request.js";
import { dispatchInvocation } from "../dispatch.js";
import type { ProtocolAdapter, ProtocolHandler, ProtocolOptions, RouteRegistrar } from "../types.js";
import { contextFromProtocolRequest, joinPath } from "../types.js";
import { decodeChatCompletionsRequest, encodeChatCompletionsResponse } from "./chat-completions.js";
import type { OpenAICompatibleDialect } from "./dialect.js";
import type { HttpTransportHooks } from "../../hooks.js";
import { encodeModelsList } from "./models.js";
import { decodeResponsesRequest, encodeResponsesResponse } from "./responses.js";
import { DONE_EVENT, encodeChatCompletionsEvent, encodeResponsesEvent } from "./stream.js";
import { isRecord } from "../../util/objects.js";

export function createOpenAICompatibleProtocol(dialect: OpenAICompatibleDialect): ProtocolAdapter {
  return {
    id: dialect.id,
    version: dialect.version,
    capabilities(): ProtocolCapabilities {
      return dialect.capabilities;
    },
    registerRoutes(registrar: RouteRegistrar, backend: ExternalApiBackend, options?: ProtocolOptions) {
      const prefix = options?.prefix ?? "";
      const policy: LossyConversionPolicy = options?.lossyConversion ?? "error";

      registrar.route({
        method: "POST",
        path: joinPath(prefix, "/v1/chat/completions"),
        protocolId: dialect.id,
        encodeError: (error) => dialect.encodeError(error),
        handler: chatHandler(backend, dialect, policy, options?.hooks)
      });
      registrar.route({
        method: "POST",
        path: joinPath(prefix, "/v1/responses"),
        protocolId: dialect.id,
        encodeError: (error) => dialect.encodeError(error),
        handler: responsesHandler(backend, dialect, policy, options?.hooks)
      });
      registrar.route({
        method: "GET",
        path: joinPath(prefix, "/v1/models"),
        protocolId: dialect.id,
        encodeError: (error) => dialect.encodeError(error),
        handler: modelsHandler(backend, dialect)
      });
    }
  };
}

function chatHandler(
  backend: ExternalApiBackend,
  dialect: OpenAICompatibleDialect,
  policy: LossyConversionPolicy,
  hooks?: HttpTransportHooks
): ProtocolHandler {
  return async (request, reply) => {
    const decoded = decodeChatCompletionsRequest(request.body, {
      protocol: dialect.id,
      endpoint: "chat.completions",
      params: request.params,
      query: request.query
    }, dialect);
    await dispatchInvocation({
      backend,
      request: decoded,
      context: contextFromProtocolRequest(request, dialect.id),
      stream: decoded.stream === true,
      reply,
      policy,
      encodeResponse: (response, invocation) => encodeChatCompletionsResponse(response, invocation, dialect),
      encodeEvent: encodeChatCompletionsEvent,
      trailer: [DONE_EVENT],
      protocol: dialect.id,
      path: request.path,
      method: request.method,
      hooks
    });
  };
}

function responsesHandler(
  backend: ExternalApiBackend,
  dialect: OpenAICompatibleDialect,
  policy: LossyConversionPolicy,
  hooks?: HttpTransportHooks
): ProtocolHandler {
  return async (request, reply) => {
    const decoded = decodeResponsesRequest(request.body, {
      protocol: dialect.id,
      endpoint: "responses",
      params: request.params,
      query: request.query
    }, dialect);
    await dispatchInvocation({
      backend,
      request: decoded,
      context: contextFromProtocolRequest(request, dialect.id),
      stream: decoded.stream === true,
      reply,
      policy,
      encodeResponse: (response, invocation) => encodeResponsesResponse(response, invocation),
      encodeEvent: encodeResponsesEvent,
      protocol: dialect.id,
      path: request.path,
      method: request.method,
      hooks
    });
  };
}

function modelsHandler(backend: ExternalApiBackend, dialect: OpenAICompatibleDialect): ProtocolHandler {
  return async (request, reply) => {
    const models = backend.listModels
      ? await backend.listModels(contextFromProtocolRequest(request, dialect.id))
      : [{ id: "default", ownedBy: dialect.ownedBy }];
    await reply.send(encodeModelsList(models, dialect));
  };
}

export function wantsStream(body: unknown): boolean {
  return isRecord(body) && body.stream === true;
}
