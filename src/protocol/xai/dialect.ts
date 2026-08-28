import { openaiStyleError, type OpenAICompatibleDialect } from "../openai-compatible/dialect.js";
import { XAI_CHAT_EXTRA, XAI_RESPONSES_EXTRA, mapXaiChatExtensions, mapXaiResponsesExtensions } from "./extensions.js";

export const xaiDialect: OpenAICompatibleDialect = {
  id: "xai",
  version: "0.1.0",
  ownedBy: "xai",
  protocolKey: "xai",
  capabilities: { streaming: true, tools: true, models: true },
  chatExtraKeys: XAI_CHAT_EXTRA,
  responsesExtraKeys: XAI_RESPONSES_EXTRA,
  mapChatExtensions: mapXaiChatExtensions,
  mapResponsesExtensions: mapXaiResponsesExtensions,
  encodeError(error) {
    return openaiStyleError(error, {
      type: (code) => {
        if (code === "backend_unavailable") {
          return "server_error";
        }
        if (code === "rate_limit") {
          return "rate_limit_error";
        }
        if (code === "unauthorized") {
          return "invalid_request_error";
        }
        return code === "internal_error" ? "api_error" : "invalid_request_error";
      },
      code: (code) => {
        if (code === "unsupported_feature") {
          return "unsupported_parameter";
        }
        return code;
      }
    });
  }
};
