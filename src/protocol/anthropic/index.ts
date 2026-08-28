import type { ExternalApiBackend } from "../../backend/types.js";
import type { LossyConversionPolicy } from "../../boundary/request.js";
import { dispatchInvocation } from "../dispatch.js";
import { createProtocolAdapter, withProtocolOptions } from "../create.js";
import type { ProtocolAdapter, ProtocolHandler, ProtocolOptions, RouteRegistrar } from "../types.js";
import { contextFromProtocolRequest, joinPath } from "../types.js";
import { encodeAnthropicError } from "./errors.js";
import { decodeAnthropicRequest, encodeAnthropicResponse } from "./messages.js";
import { encodeAnthropicEvent } from "./stream.js";

export function anthropicProtocol(options?: ProtocolOptions): ProtocolAdapter {
  return withProtocolOptions(
    createProtocolAdapter({
    id: "anthropic",
    version: "0.1.0",
    capabilities: { streaming: true, tools: true },
    registerRoutes(registrar: RouteRegistrar, backend: ExternalApiBackend, options?: ProtocolOptions) {
      const prefix = options?.prefix ?? "";
      const policy: LossyConversionPolicy = options?.lossyConversion ?? "error";
      registrar.route({
        method: "POST",
        path: joinPath(prefix, "/v1/messages"),
        protocolId: "anthropic",
        encodeError: encodeAnthropicError,
        handler: messagesHandler(backend, policy)
      });
    }
    }),
    options
  );
}

function messagesHandler(backend: ExternalApiBackend, policy: LossyConversionPolicy): ProtocolHandler {
  return async (request, reply) => {
    const decoded = decodeAnthropicRequest(request.body, {
      protocol: "anthropic",
      endpoint: "messages",
      params: request.params,
      query: request.query
    });
    await dispatchInvocation({
      backend,
      request: decoded,
      context: contextFromProtocolRequest(request, "anthropic"),
      stream: decoded.stream === true,
      reply,
      policy,
      encodeResponse: encodeAnthropicResponse,
      encodeEvent: encodeAnthropicEvent,
      protocol: "anthropic",
      path: request.path,
      method: request.method
    });
  };
}
