import type { ExternalApiBackend } from "../../backend/types.js";
import type { LossyConversionPolicy } from "../../boundary/request.js";
import { dispatchInvocation } from "../dispatch.js";
import { createProtocolAdapter, withProtocolOptions } from "../create.js";
import type { ProtocolAdapter, ProtocolHandler, ProtocolOptions, RouteRegistrar } from "../types.js";
import { contextFromProtocolRequest, joinPath } from "../types.js";
import { encodeGeminiError } from "./errors.js";
import {
  decodeGeminiRequest,
  encodeGeminiResponse,
  geminiWantsStream,
  parseGeminiModelAction
} from "./generate-content.js";
import { encodeGeminiEvent } from "./stream.js";

export function geminiProtocol(options?: ProtocolOptions): ProtocolAdapter {
  return withProtocolOptions(
    createProtocolAdapter({
    id: "gemini",
    version: "0.1.0",
    capabilities: { streaming: true, tools: true },
    registerRoutes(registrar: RouteRegistrar, backend: ExternalApiBackend, options?: ProtocolOptions) {
      const prefix = options?.prefix ?? "";
      const policy: LossyConversionPolicy = options?.lossyConversion ?? "error";
      registrar.route({
        method: "POST",
        path: joinPath(prefix, "/v1beta/models/:modelAction"),
        protocolId: "gemini",
        encodeError: encodeGeminiError,
        handler: generateHandler(backend, policy)
      });
    }
    }),
    options
  );
}

function generateHandler(backend: ExternalApiBackend, policy: LossyConversionPolicy): ProtocolHandler {
  return async (request, reply) => {
    const modelAction = request.params.modelAction ?? "";
    const parsed = parseGeminiModelAction(modelAction);
    const stream = geminiWantsStream(request.query, parsed.action);
    const decoded = decodeGeminiRequest(
      request.body,
      {
        protocol: "gemini",
        endpoint: parsed.action,
        params: request.params,
        query: request.query
      },
      parsed.model,
      stream
    );
    await dispatchInvocation({
      backend,
      request: decoded,
      context: contextFromProtocolRequest(request, "gemini"),
      stream,
      reply,
      policy,
      encodeResponse: encodeGeminiResponse,
      encodeEvent: encodeGeminiEvent,
      protocol: "gemini",
      path: request.path,
      method: request.method
    });
  };
}
