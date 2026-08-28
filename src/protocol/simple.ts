import type { ExternalApiBackend } from "../backend/types.js";
import { BackendError } from "../boundary/errors.js";
import type { LossyConversionPolicy } from "../boundary/request.js";
import { extractText } from "../util/text.js";
import { createProtocolAdapter } from "./create.js";
import { dispatchInvocation } from "./dispatch.js";
import type { ProtocolAdapter, ProtocolOptions, RouteRegistrar } from "./types.js";
import { contextFromProtocolRequest, joinPath } from "./types.js";
import { isRecord } from "../util/objects.js";

export interface SimpleProtocolOptions extends ProtocolOptions {
  path?: string;
}

export function createSimpleProtocol(options: SimpleProtocolOptions = {}): ProtocolAdapter {
  const path = options.path ?? "/api/generate";
  return createProtocolAdapter({
    id: "simple",
    version: "0.1.0",
    capabilities: { streaming: true, tools: false },
    registerRoutes(registrar: RouteRegistrar, backend: ExternalApiBackend, protocolOptions?: ProtocolOptions) {
      const policy: LossyConversionPolicy = protocolOptions?.lossyConversion ?? options.lossyConversion ?? "error";
      registrar.route({
        method: "POST",
        path: joinPath(protocolOptions?.prefix ?? options.prefix, path),
        protocolId: "simple",
        encodeError: (error) => ({
          status: error.status,
          body: { error: { code: error.code, message: error.message } }
        }),
        handler: async (request, reply) => {
          if (!isRecord(request.body)) {
            throw new BackendError({ code: "invalid_request", message: "JSON object body required" });
          }
          const prompt = typeof request.body.prompt === "string" ? request.body.prompt : "";
          if (!prompt) {
            throw new BackendError({ code: "invalid_request", message: "prompt is required", param: "prompt" });
          }
          const model = typeof request.body.model === "string" ? request.body.model : "default";
          const stream = request.body.stream === true;
          const decoded = {
            model,
            messages: [{ role: "user" as const, content: [{ type: "text" as const, text: prompt }] }],
            stream,
            source: { protocol: "simple", endpoint: path },
            native: { protocol: "simple", payload: request.body },
            raw: request.body
          };
          await dispatchInvocation({
            backend,
            request: decoded,
            context: contextFromProtocolRequest(request, "simple"),
            stream,
            reply,
            policy,
            encodeResponse: (response) => ({
              model: response.model,
              text: extractText(response.message.content),
              finishReason: response.finishReason ?? "stop"
            }),
            encodeEvent: (event) => {
              if (event.type === "text.delta") {
                return { event: "delta", data: JSON.stringify({ delta: event.delta }) };
              }
              if (event.type === "response.end") {
                return { event: "done", data: JSON.stringify({ finishReason: event.finishReason ?? "stop" }) };
              }
              return null;
            },
            protocol: "simple",
            path: request.path,
            method: request.method,
            hooks: protocolOptions?.hooks ?? options.hooks
          });
        }
      });
    }
  });
}
