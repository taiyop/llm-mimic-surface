import { BackendError } from "../../boundary/errors.js";
import type { InvocationRequest } from "../../boundary/request.js";
import type { InvocationResponse } from "../../boundary/response.js";
import { collectUnknownFields, isRecord } from "../../util/objects.js";
import { unixSeconds } from "../../util/id.js";
import { RESPONSES_KNOWN_KEYS, responsesRequestSchema } from "./schemas.js";
import {
  decodeResponseFormat,
  decodeResponsesInput,
  decodeToolChoice,
  decodeTools,
  encodeResponsesOutput,
  mergeDialectExtensions
} from "./content.js";
import type { OpenAICompatibleDialect } from "./dialect.js";
import type { DecodeMeta } from "../types.js";
import { joinNonEmpty } from "../../util/text.js";

export function decodeResponsesRequest(
  raw: unknown,
  meta: DecodeMeta,
  dialect: OpenAICompatibleDialect
): InvocationRequest {
  const parsed = responsesRequestSchema.safeParse(raw);
  if (!parsed.success) {
    throw new BackendError({
      code: "invalid_request",
      message: parsed.error.issues[0]?.message ?? "Invalid responses request",
      param: parsed.error.issues[0]?.path.join(".") || "body"
    });
  }
  const body = parsed.data;
  const record = isRecord(raw) ? raw : {};
  const messages = decodeResponsesInput(body.input);
  const unknown = collectUnknownFields(record, [...RESPONSES_KNOWN_KEYS, ...dialect.responsesExtraKeys]);
  const dialectUnknown = collectUnknownFields(record, RESPONSES_KNOWN_KEYS);
  const mapped = dialect.mapResponsesExtensions({
    ...(dialectUnknown ?? {}),
    ...(body.include ? { include: body.include } : {}),
    ...(body.store != null ? { store: body.store } : {}),
    ...(body.previous_response_id ? { previous_response_id: body.previous_response_id } : {})
  });
  const reasoningEffort = isRecord(body.reasoning) && typeof body.reasoning.effort === "string" ? body.reasoning.effort : undefined;
  const textFormat = isRecord(body.text) ? body.text.format ?? body.text : undefined;

  const extraInstructions: string[] = [];
  if (typeof body.previous_response_id === "string") {
    extraInstructions.push(`previous_response_id=${body.previous_response_id}`);
  }

  return {
    model: body.model,
    messages,
    instructions: joinNonEmpty([body.instructions, ...extraInstructions]),
    generation: {
      temperature: body.temperature,
      topP: body.top_p,
      maxOutputTokens: body.max_output_tokens
    },
    tools: decodeTools(body.tools, dialect.id),
    toolChoice: decodeToolChoice(body.tool_choice),
    responseFormat: decodeResponseFormat(textFormat),
    reasoning: reasoningEffort
      ? {
          effort: reasoningEffort,
          budgetTokens:
            isRecord(body.reasoning) && typeof body.reasoning.max_tokens === "number"
              ? body.reasoning.max_tokens
              : undefined
        }
      : undefined,
    metadata: {
      ...body.metadata,
      ...(body.previous_response_id ? { previous_response_id: body.previous_response_id } : {}),
      ...(body.store != null ? { store: body.store } : {}),
      ...(body.include ? { include: body.include } : {})
    },
    stream: body.stream,
    extensions: mergeDialectExtensions(dialect.protocolKey, unknown, mapped),
    source: { protocol: dialect.id, endpoint: meta.endpoint },
    native: { protocol: dialect.id, payload: raw },
    raw
  };
}

export function encodeResponsesResponse(
  response: InvocationResponse,
  request: InvocationRequest
): Record<string, unknown> {
  const hasTools = response.message.content.some((part) => part.type === "tool_call");
  return {
    id: response.id,
    object: "response",
    created_at: response.created ?? unixSeconds(),
    status: "completed",
    error: null,
    incomplete_details: null,
    model: response.model || request.model,
    output: encodeResponsesOutput(response.message),
    usage: {
      input_tokens: response.usage?.inputTokens ?? 0,
      output_tokens: response.usage?.outputTokens ?? 0,
      total_tokens:
        response.usage?.totalTokens ?? (response.usage?.inputTokens ?? 0) + (response.usage?.outputTokens ?? 0)
    },
    metadata: request.metadata ?? {},
    ...(hasTools ? { tool_choice: request.toolChoice ?? "auto" } : {})
  };
}
