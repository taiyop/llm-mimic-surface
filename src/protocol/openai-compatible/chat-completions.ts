import { BackendError } from "../../boundary/errors.js";
import type { InvocationRequest } from "../../boundary/request.js";
import type { InvocationResponse } from "../../boundary/response.js";
import { collectUnknownFields, isRecord } from "../../util/objects.js";
import { unixSeconds } from "../../util/id.js";
import { CHAT_KNOWN_KEYS, chatCompletionsRequestSchema } from "./schemas.js";
import {
  decodeChatMessages,
  decodeResponseFormat,
  decodeToolChoice,
  decodeTools,
  encodeAssistantChatMessage,
  finishReasonFor,
  mergeDialectExtensions
} from "./content.js";
import type { OpenAICompatibleDialect } from "./dialect.js";
import type { DecodeMeta } from "../types.js";

export function decodeChatCompletionsRequest(
  raw: unknown,
  meta: DecodeMeta,
  dialect: OpenAICompatibleDialect
): InvocationRequest {
  const parsed = chatCompletionsRequestSchema.safeParse(raw);
  if (!parsed.success) {
    throw new BackendError({
      code: "invalid_request",
      message: parsed.error.issues[0]?.message ?? "Invalid chat completions request",
      param: parsed.error.issues[0]?.path.join(".") || "body"
    });
  }
  const body = parsed.data;
  if (body.n != null && body.n !== 1) {
    throw new BackendError({
      code: "unsupported_feature",
      message: "Only n=1 is supported",
      param: "n"
    });
  }
  const record = isRecord(raw) ? raw : {};
  const { messages, instructions } = decodeChatMessages(body.messages);
  const unknown = collectUnknownFields(record, [...CHAT_KNOWN_KEYS, ...dialect.chatExtraKeys]);
  const dialectUnknown = collectUnknownFields(record, CHAT_KNOWN_KEYS);
  const mapped = dialect.mapChatExtensions(dialectUnknown ?? {});
  const reasoningEffort =
    body.reasoning_effort ??
    (isRecord(body.reasoning) && typeof body.reasoning.effort === "string" ? body.reasoning.effort : undefined);

  return {
    model: body.model,
    messages,
    instructions,
    generation: {
      temperature: body.temperature,
      topP: body.top_p,
      maxOutputTokens: body.max_completion_tokens ?? body.max_tokens,
      stop: typeof body.stop === "string" ? [body.stop] : body.stop,
      presencePenalty: body.presence_penalty,
      frequencyPenalty: body.frequency_penalty,
      seed: body.seed
    },
    tools: decodeTools(body.tools, dialect.id),
    toolChoice: decodeToolChoice(body.tool_choice),
    responseFormat: decodeResponseFormat(body.response_format),
    reasoning: reasoningEffort ? { effort: reasoningEffort } : undefined,
    metadata: body.metadata,
    stream: body.stream,
    extensions: mergeDialectExtensions(dialect.protocolKey, unknown, mapped),
    source: { protocol: dialect.id, endpoint: meta.endpoint },
    native: { protocol: dialect.id, payload: raw },
    raw
  };
}

export function encodeChatCompletionsResponse(
  response: InvocationResponse,
  request: InvocationRequest,
  dialect: OpenAICompatibleDialect
): Record<string, unknown> {
  const finishReason = finishReasonFor(response.message, response.finishReason ?? "stop");
  return {
    id: response.id,
    object: "chat.completion",
    created: response.created ?? unixSeconds(),
    model: response.model || request.model,
    choices: [
      {
        index: 0,
        message: encodeAssistantChatMessage(response.message),
        finish_reason: mapFinishReason(finishReason)
      }
    ],
    usage: {
      prompt_tokens: response.usage?.inputTokens ?? 0,
      completion_tokens: response.usage?.outputTokens ?? 0,
      total_tokens: response.usage?.totalTokens ?? (response.usage?.inputTokens ?? 0) + (response.usage?.outputTokens ?? 0)
    },
    ...(dialect.id === "xai" && response.extensions?.xai ? { ...asRecord(response.extensions.xai) } : {})
  };
}

function mapFinishReason(reason: string): string {
  if (reason === "end_turn" || reason === "STOP") {
    return "stop";
  }
  if (reason === "max_tokens" || reason === "MAX_TOKENS" || reason === "length") {
    return "length";
  }
  if (reason === "tool_use" || reason === "tool_calls") {
    return "tool_calls";
  }
  return reason;
}

function asRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}
