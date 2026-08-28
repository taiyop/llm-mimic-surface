import { openaiStyleError, type OpenAICompatibleDialect } from "../openai-compatible/dialect.js";
import { isRecord } from "../../util/objects.js";

const OPENAI_CHAT_EXTRA = [
  "logit_bias",
  "logprobs",
  "top_logprobs",
  "stream_options",
  "service_tier",
  "store",
  "prompt_cache_key",
  "audio",
  "modalities",
  "prediction",
  "web_search_options",
  "parallel_tool_calls",
  "functions",
  "function_call"
] as const;

const OPENAI_RESPONSES_EXTRA = [
  "parallel_tool_calls",
  "service_tier",
  "prompt",
  "background",
  "max_tool_calls",
  "prompt_cache_key"
] as const;

export const openAIDialect: OpenAICompatibleDialect = {
  id: "openai",
  version: "0.1.0",
  ownedBy: "openai-compatible",
  protocolKey: "openai",
  capabilities: { streaming: true, tools: true, models: true },
  chatExtraKeys: OPENAI_CHAT_EXTRA,
  responsesExtraKeys: OPENAI_RESPONSES_EXTRA,
  mapChatExtensions(unknown) {
    const openai: Record<string, unknown> = {};
    for (const key of OPENAI_CHAT_EXTRA) {
      if (unknown[key] !== undefined) {
        openai[key] = unknown[key];
      }
    }
    return Object.keys(openai).length > 0 ? { openai } : undefined;
  },
  mapResponsesExtensions(unknown) {
    const openai: Record<string, unknown> = {};
    for (const key of OPENAI_RESPONSES_EXTRA) {
      if (unknown[key] !== undefined) {
        openai[key] = unknown[key];
      }
    }
    if (isRecord(unknown) && unknown.include) {
      openai.include = unknown.include;
    }
    return Object.keys(openai).length > 0 ? { openai } : undefined;
  },
  encodeError(error) {
    return openaiStyleError(error);
  }
};
